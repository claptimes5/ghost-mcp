// End-to-end tests: runs the built server over stdio against a mock Ghost Admin API.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const KEY_ID = '0123456789abcdef01234567';
const SECRET = 'ab'.repeat(32);
const SERVER = path.join(__dirname, '..', 'build', 'server.js');

const ROLES = [
    { id: 'role-admin', name: 'Administrator' },
    { id: 'role-author', name: 'Author' },
];

// Mock Ghost: records requests, rejects anything without a valid Admin API token.
let ghostUrl;
let requests = [];
const ghost = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
        const url = new URL(req.url, 'http://ghost');
        const body = raw ? JSON.parse(raw) : undefined;
        requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, headers: req.headers });
        const send = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };

        try {
            const token = (req.headers.authorization ?? '').replace(/^Ghost /, '');
            const { header } = jwt.decode(token, { complete: true });
            assert.equal(header.kid, KEY_ID);
            jwt.verify(token, Buffer.from(SECRET, 'hex'), { audience: '/admin/', algorithms: ['HS256'] });
        } catch {
            return send(401, { errors: [{ type: 'UnauthorizedError', message: 'Invalid token' }] });
        }

        const p = url.pathname.replace('/ghost/api/admin/', '');
        if (p === 'roles/') return send(200, { roles: ROLES });
        if (p === 'invites/' && req.method === 'POST') return send(201, { invites: [{ id: 'inv1', ...body.invites[0] }] });
        if (p.startsWith('invites/') && req.method === 'DELETE') { res.writeHead(204); return res.end(); }
        if (p === 'tiers/' && req.method === 'GET') return send(200, { tiers: [{ id: 't1' }, { id: 't2' }], meta: { pagination: {} } });
        if (p === 'tiers/missing/') return send(404, { errors: [{ type: 'NotFoundError', message: 'Tier not found.' }] });
        if (p.startsWith('tiers/') && req.method === 'PUT') return send(200, { tiers: [body.tiers[0]] });
        if (p === 'offers/' && req.method === 'POST') return send(201, { offers: [body.offers[0]] });
        if (p.startsWith('posts/')) return send(200, { posts: [{ id: 'p1', title: 'Hello', html: '<p>Body</p>', updated_at: 'u1' }] });
        if (p === 'site/') return send(200, { site: { title: 'Test Blog' } });
        send(404, { errors: [{ type: 'NotFoundError', message: `No mock for ${req.method} ${p}` }] });
    });
});
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
before(async () => { ghostUrl = await listen(ghost); });
after(() => ghost.close());

async function connect(env = {}) {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [SERVER],
        env: { PATH: process.env.PATH, GHOST_API_URL: ghostUrl, GHOST_ADMIN_API_KEY: `${KEY_ID}:${SECRET}`, ...env },
        stderr: 'ignore',
    });
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(transport);
    return client;
}

async function withClient(env, fn) {
    const client = await connect(env);
    try { return await fn(client); } finally { await client.close(); }
}

const toolNames = async client => (await client.listTools()).tools.map(t => t.name);
const call = (client, name, args) => client.callTool({ name, arguments: args });
const resultJson = result => JSON.parse(result.content[0].text);

describe('guardrails', () => {
    test('defaults hide webhooks, code injection and staff email changes', () => withClient({}, async client => {
        const { tools } = await client.listTools();
        const names = tools.map(t => t.name);
        assert.equal(names.length, 37);
        assert.ok(!names.some(n => n.startsWith('webhooks_')));
        const props = name => Object.keys(tools.find(t => t.name === name).inputSchema.properties);
        assert.ok(!props('posts_edit').includes('codeinjection_head'));
        assert.ok(!props('users_edit').includes('email'));
    }));

    test('tools carry read-only and destructive annotations', () => withClient({}, async client => {
        const { tools } = await client.listTools();
        const annotations = name => tools.find(t => t.name === name).annotations;
        assert.equal(annotations('posts_browse').readOnlyHint, true);
        assert.equal(annotations('posts_add').destructiveHint, false);
        assert.equal(annotations('posts_edit').destructiveHint, true);
        assert.equal(annotations('posts_delete').destructiveHint, true);
        assert.ok(tools.every(t => t.description));
    }));

    test('GHOST_MCP_READ_ONLY only exposes browse/read tools and matching resources', () => withClient({ GHOST_MCP_READ_ONLY: 'true' }, async client => {
        const names = await toolNames(client);
        assert.ok(names.length > 0);
        assert.ok(names.every(n => /_(browse|read)$/.test(n)), names.join());
        const { resourceTemplates } = await client.listResourceTemplates();
        assert.equal(resourceTemplates.length, 6);
    }));

    test('GHOST_MCP_TOOLS allowlist removes everything else, including resources and prompts', () => withClient({ GHOST_MCP_TOOLS: 'tags_browse, posts_add' }, async client => {
        assert.deepEqual((await toolNames(client)).sort(), ['posts_add', 'tags_browse']);
        assert.equal((await client.listResourceTemplates()).resourceTemplates.length, 0);
        assert.equal(client.getServerCapabilities().prompts, undefined);
    }));

    test('GHOST_MCP_ALLOW enables the high-risk capabilities', () => withClient({ GHOST_MCP_ALLOW: 'webhooks,code_injection,privileged_invites,staff_email' }, async client => {
        const { tools } = await client.listTools();
        assert.equal(tools.length, 40);
        const props = name => Object.keys(tools.find(t => t.name === name).inputSchema.properties);
        assert.ok(props('posts_edit').includes('codeinjection_head'));
        assert.ok(props('users_edit').includes('email'));
    }));

    test('unknown GHOST_MCP_ALLOW values stop the server', async () => {
        await assert.rejects(connect({ GHOST_MCP_ALLOW: 'bogus' }));
    });
});

describe('invites', () => {
    test('blocks privileged roles without calling Ghost', () => withClient({}, async client => {
        requests = [];
        const result = await call(client, 'invites_add', { role_id: 'role-admin', email: 'x@example.com' });
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /"Administrator" role is disabled/);
        assert.ok(!requests.some(r => r.method === 'POST'));
    }));

    test('allows unprivileged roles', () => withClient({}, async client => {
        requests = [];
        const result = await call(client, 'invites_add', { role_id: 'role-author', email: 'a@example.com' });
        assert.equal(result.isError, undefined);
        const post = requests.find(r => r.method === 'POST');
        assert.equal(post.path, '/ghost/api/admin/invites/');
        assert.deepEqual(post.body, { invites: [{ role_id: 'role-author', email: 'a@example.com' }] });
    }));

    test('privileged_invites allows admin invites', () => withClient({ GHOST_MCP_ALLOW: 'privileged_invites' }, async client => {
        const result = await call(client, 'invites_add', { role_id: 'role-admin', email: 'x@example.com' });
        assert.equal(result.isError, undefined);
    }));

    test('invites_delete calls the delete endpoint', () => withClient({}, async client => {
        requests = [];
        await call(client, 'invites_delete', { id: 'inv1' });
        assert.deepEqual(requests.map(r => `${r.method} ${r.path}`), ['DELETE /ghost/api/admin/invites/inv1/']);
    }));
});

describe('resources not covered by @tryghost/admin-api', () => {
    test('roles_read finds a role from the browse endpoint', () => withClient({}, async client => {
        assert.deepEqual(resultJson(await call(client, 'roles_read', { id: 'role-author' })), ROLES[1]);
    }));

    test('tiers_browse sends version header and query params', () => withClient({}, async client => {
        requests = [];
        const tiers = resultJson(await call(client, 'tiers_browse', { filter: 'type:paid', limit: 5 }));
        assert.equal(tiers.length, 2);
        assert.deepEqual(requests[0].query, { filter: 'type:paid', limit: '5' });
        assert.equal(requests[0].headers['accept-version'], 'v5.0');
    }));

    test('tiers_edit archives via PUT', () => withClient({}, async client => {
        requests = [];
        await call(client, 'tiers_edit', { id: 't1', active: false });
        assert.equal(requests[0].path, '/ghost/api/admin/tiers/t1/');
        assert.deepEqual(requests[0].body, { tiers: [{ active: false }] });
    }));

    test('offers_add references the tier as an object', () => withClient({}, async client => {
        requests = [];
        await call(client, 'offers_add', { name: 'BF', code: 'bf', type: 'percent', cadence: 'year', duration: 'once', amount: 10, tier_id: 't1' });
        assert.deepEqual(requests[0].body.offers[0].tier, { id: 't1' });
        assert.equal(requests[0].body.offers[0].tier_id, undefined);
    }));

    test('Ghost errors are surfaced as tool errors', () => withClient({}, async client => {
        const result = await call(client, 'tiers_read', { id: 'missing' });
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /NotFoundError: Tier not found/);
    }));
});

describe('posts, resources and prompts', () => {
    test('posts_read returns html by default', () => withClient({}, async client => {
        requests = [];
        const post = resultJson(await call(client, 'posts_read', { id: 'p1' }));
        assert.equal(post.html, '<p>Body</p>');
        assert.equal(requests[0].query.formats, 'html');
    }));

    test('post and blog-info resources return Ghost data', () => withClient({}, async client => {
        const post = await client.readResource({ uri: 'post://p1' });
        assert.equal(JSON.parse(post.contents[0].text).title, 'Hello');
        const site = await client.readResource({ uri: 'blog://info' });
        assert.equal(JSON.parse(site.contents[0].text).title, 'Test Blog');
    }));

    test('summarize-post prompt includes the post html', () => withClient({}, async client => {
        const prompt = await client.getPrompt({ name: 'summarize-post', arguments: { postId: 'p1' } });
        assert.match(prompt.messages[0].content.text, /<p>Body<\/p>/);
    }));
});
