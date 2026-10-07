import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { READ_ONLY, ENABLED_TOOLS, isAllowed } from './config';

const isReadTool = (name: string) => /_(browse|read)$/.test(name);

// Wraps server.tool so every tool registered afterwards gets MCP annotations
// derived from its name, and is removed if the configured guardrails exclude it.
export function applyToolPolicy(server: McpServer) {
    const registerTool = server.tool.bind(server) as (...args: any[]) => ReturnType<McpServer['tool']>;

    server.tool = ((name: string, ...rest: any[]) => {
        const registered = registerTool(name, ...rest);
        const readOnly = isReadTool(name);

        registered.update({
            annotations: {
                readOnlyHint: readOnly,
                destructiveHint: /_(edit|delete)$/.test(name),
                idempotentHint: readOnly || name.endsWith('_delete'),
            },
        });

        const excluded =
            (READ_ONLY && !readOnly) ||
            (ENABLED_TOOLS.length > 0 && !ENABLED_TOOLS.includes(name)) ||
            (name.startsWith('webhooks_') && !isAllowed('webhooks'));
        if (excluded) {
            registered.remove();
        }
        return registered;
    }) as McpServer['tool'];
}
