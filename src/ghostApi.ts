import GhostAdminAPI from '@tryghost/admin-api';
import jwt from 'jsonwebtoken';
import { GHOST_API_URL, GHOST_ADMIN_API_KEY, GHOST_API_VERSION } from './config';

// Initialize and export the Ghost Admin API client instance.
// Configuration is loaded from src/config.ts.
export const ghostApiClient = new GhostAdminAPI({
    url: GHOST_API_URL,
    key: GHOST_ADMIN_API_KEY,
    version: GHOST_API_VERSION
});

// @tryghost/admin-api only covers posts, pages, tags, webhooks, members, users and
// newsletters. The resources below are called directly, authenticated the same way.

// Ghost v2-v4 put the version in the URL; v5+ only uses the Accept-Version header.
const legacyVersion = /^(v[2-4])(\.\d+)?$/.exec(GHOST_API_VERSION)?.[1];
const apiPrefix = legacyVersion ? `/${legacyVersion}/admin/` : '/admin/';

function adminToken(): string {
    const [id, secret] = GHOST_ADMIN_API_KEY.split(':');
    return jwt.sign({}, Buffer.from(secret, 'hex'), {
        keyid: id,
        algorithm: 'HS256',
        expiresIn: '5m',
        audience: apiPrefix
    });
}

type QueryParams = Record<string, string | number | boolean | undefined>;

async function ghostRequest(method: string, path: string, params: QueryParams = {}, body?: unknown): Promise<any> {
    const url = new URL(`${GHOST_API_URL}/ghost/api${apiPrefix}${path}`);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
        method,
        // Never follow redirects: they could forward the Authorization header elsewhere.
        redirect: 'error',
        headers: {
            Authorization: `Ghost ${adminToken()}`,
            'Accept-Version': GHOST_API_VERSION,
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
        const ghostError = data.errors?.[0];
        throw new Error(ghostError?.message
            ? `${ghostError.type ?? 'GhostError'}: ${ghostError.message}${ghostError.context ? ` (${ghostError.context})` : ''}`
            : `Ghost API request failed: ${method} ${path} -> ${response.status}`);
    }
    return data;
}

// Mirrors the response unwrapping done by @tryghost/admin-api.
function unwrap(resource: string, data: any): any {
    const items = data[resource];
    if (!Array.isArray(items)) return items;
    if (items.length === 1 && !data.meta) return items[0];
    return Object.assign(items, { meta: data.meta });
}

function resourceApi(resource: string) {
    return {
        browse: async (params: QueryParams = {}) => unwrap(resource, await ghostRequest('GET', `${resource}/`, params)),
        read: async (id: string) => unwrap(resource, await ghostRequest('GET', `${resource}/${encodeURIComponent(id)}/`)),
        add: async (item: object) => unwrap(resource, await ghostRequest('POST', `${resource}/`, {}, { [resource]: [item] })),
        edit: async (id: string, item: object) =>
            unwrap(resource, await ghostRequest('PUT', `${resource}/${encodeURIComponent(id)}/`, {}, { [resource]: [item] })),
        delete: async (id: string) => { await ghostRequest('DELETE', `${resource}/${encodeURIComponent(id)}/`); },
    };
}

export const tiersApi = resourceApi('tiers');
export const offersApi = resourceApi('offers');
export const invitesApi = resourceApi('invites');
export const rolesApi = {
    // Ghost only exposes a browse endpoint for roles.
    browse: resourceApi('roles').browse,
    async read(id: string) {
        const roles = await rolesApi.browse();
        return ([] as any[]).concat(roles).find(role => role.id === id);
    },
};
