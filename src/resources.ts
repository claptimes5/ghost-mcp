import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient, tiersApi, offersApi } from './ghostApi';
import { isToolAllowed } from './toolPolicy';

type Variables = Record<string, string | string[]>;

const jsonContents = (uri: URL, data: unknown) => ({
    contents: [{
        uri: uri.href,
        text: JSON.stringify(data, null, 2),
        mimeType: 'application/json'
    }]
});

// Each template resource reads one entity by id, e.g. post://{post_id}.
const templates: { name: string; readTool: string; fetch: (id: string) => Promise<unknown> }[] = [
    { name: 'user', readTool: 'users_read', fetch: id => ghostApiClient.users.read({ id }) },
    { name: 'member', readTool: 'members_read', fetch: id => ghostApiClient.members.read({ id }) },
    { name: 'tier', readTool: 'tiers_read', fetch: id => tiersApi.read(id) },
    { name: 'offer', readTool: 'offers_read', fetch: id => offersApi.read(id) },
    { name: 'newsletter', readTool: 'newsletters_read', fetch: id => ghostApiClient.newsletters.read({ id }) },
    { name: 'post', readTool: 'posts_read', fetch: id => ghostApiClient.posts.read({ id }, { formats: 'html' }) },
];

export function registerResources(server: McpServer) {
    for (const { name, readTool, fetch } of templates) {
        // Resources expose the same data as the matching read tool, so they follow its guardrails.
        if (!isToolAllowed(readTool)) continue;
        const param = `${name}_id`;
        server.registerResource(
            name,
            new ResourceTemplate(`${name}://{${param}}`, { list: undefined }),
            { description: `A Ghost ${name} by id`, mimeType: 'application/json' },
            async (uri: URL, variables: Variables) => {
                const id = variables[param];
                if (typeof id !== 'string' || !id) {
                    throw new Error(`Missing ${param} parameter`);
                }
                return jsonContents(uri, await fetch(id));
            }
        );
    }

    server.registerResource(
        'blog-info',
        'blog://info',
        { description: 'Ghost site title, description, URL and version', mimeType: 'application/json' },
        async (uri: URL) => jsonContents(uri, await ghostApiClient.site.read())
    );
}
