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

// Registers a tool if the guardrails allow it, with MCP annotations derived from its name.
export function registerTool<Args extends ZodRawShape>(
    server: McpServer,
    name: string,
    config: { description: string; inputSchema: Args },
    cb: ToolCallback<Args>
) {
    if (!isToolAllowed(name)) return;
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

// Formats an API response as an MCP tool result.
export const jsonResult = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

export const textResult = (text: string) => ({
    content: [{ type: "text" as const, text }],
});
