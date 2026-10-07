import { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodRawShape } from "zod";
import { READ_ONLY, ENABLED_TOOLS, isAllowed } from './config';

const isReadTool = (name: string) => /_(browse|read)$/.test(name);

// Whether the configured guardrails expose this tool.
export function isToolAllowed(name: string): boolean {
    if (READ_ONLY && !isReadTool(name)) return false;
    if (ENABLED_TOOLS.length > 0 && !ENABLED_TOOLS.includes(name)) return false;
    if (name.startsWith('webhooks_') && !isAllowed('webhooks')) return false;
    return true;
}

// Asks the person (not the model) to confirm through MCP elicitation. Clients without
// elicitation support fall back to their own tool-approval prompt.
async function confirmedByUser(server: McpServer, message: string): Promise<boolean> {
    if (!server.server.getClientCapabilities()?.elicitation) return true;
    const result = await server.server.elicitInput({
        message,
        requestedSchema: {
            type: 'object',
            properties: {
                confirm: { type: 'boolean', title: 'Yes, delete it permanently' },
            },
            required: ['confirm'],
        },
    });
    return result.action === 'accept' && result.content?.confirm === true;
}

// Registers a tool if the guardrails allow it, with MCP annotations derived from its name.
// Deletes can't be undone, so they also require confirmation from the person.
export function registerTool<Args extends ZodRawShape>(
    server: McpServer,
    name: string,
    config: { description: string; inputSchema: Args },
    cb: ToolCallback<Args>
) {
    if (!isToolAllowed(name)) return;
    if (name.endsWith('_delete')) {
        const handler = cb as (args: any, extra: any) => any;
        const resource = name.replace(/s_delete$/, '');
        cb = (async (args: { id: string }, extra: unknown) => {
            if (!(await confirmedByUser(server, `Permanently delete ${resource} ${args.id}? This can't be undone.`))) {
                return { ...textResult(`Deleting ${resource} ${args.id} was cancelled by the user.`), isError: true };
            }
            return handler(args, extra);
        }) as ToolCallback<Args>;
    }
    const readOnly = isReadTool(name);
    server.registerTool(name, {
        ...config,
        annotations: {
            readOnlyHint: readOnly,
            destructiveHint: /_(edit|delete)$/.test(name),
            idempotentHint: readOnly || name.endsWith('_delete'),
            openWorldHint: false,
        },
    }, cb);
}

// Member data plus a way to publish or send content out is the combination prompt
// injection needs to leak data, so call it out when both are enabled.
const MEMBER_DATA_TOOLS = ['members_browse', 'members_read'];
const OUTBOUND_TOOLS = ['posts_add', 'posts_edit', 'tags_add', 'tags_edit', 'newsletters_add', 'newsletters_edit', 'offers_add', 'offers_edit', 'tiers_add', 'tiers_edit', 'users_edit', 'webhooks_add', 'webhooks_edit'];

export function warnOnRiskyCombination() {
    const memberTools = MEMBER_DATA_TOOLS.filter(isToolAllowed);
    const outboundTools = OUTBOUND_TOOLS.filter(isToolAllowed);
    if (memberTools.length && outboundTools.length) {
        console.error(
            `Warning: member data (${memberTools.join(', ')}) and tools that write public content (${outboundTools.join(', ')}) ` +
            'are both enabled, so injected instructions could leak member data. Consider separate server instances ' +
            'via GHOST_MCP_TOOLS or GHOST_MCP_READ_ONLY.'
        );
    }
}

// Formats an API response as an MCP tool result.
export const jsonResult = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

export const textResult = (text: string) => ({
    content: [{ type: "text" as const, text }],
});
