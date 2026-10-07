#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from './resources';
import { warnOnRiskyCombination } from './toolPolicy';
import { registerPrompts } from "./prompts";
import { registerPostTools } from "./tools/posts";
import { registerMemberTools } from "./tools/members";
import { registerUserTools } from "./tools/users";
import { registerTagTools } from "./tools/tags";
import { registerTierTools } from "./tools/tiers";
import { registerOfferTools } from "./tools/offers";
import { registerNewsletterTools } from "./tools/newsletters";
import { registerInviteTools } from "./tools/invites";
import { registerRoleTools } from "./tools/roles";
import { registerWebhookTools } from "./tools/webhooks";
import { registerImageTools } from "./tools/images";

const { version } = require('../package.json');

// Create an MCP server instance
const server = new McpServer({
    name: "ghost-mcp-ts",
    version,
}, {
    capabilities: {
        // Tool, resource and prompt capabilities are added by the SDK as they're registered,
        // so a guardrail that removes all prompts doesn't leave an unhandled capability.
        logging: {} // Enable logging capability
    }
});

registerResources(server);

// Register tools (each registration is filtered by the guardrails in toolPolicy.ts)
registerPostTools(server);
registerMemberTools(server);
registerUserTools(server);
registerTagTools(server);
registerTierTools(server);
registerOfferTools(server);
registerNewsletterTools(server);
registerInviteTools(server);
registerRoleTools(server);
registerWebhookTools(server);
registerImageTools(server);

registerPrompts(server);
warnOnRiskyCombination();

// Set up and connect to the standard I/O transport
async function startServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Ghost MCP TypeScript Server running on stdio"); // Log to stderr
}

// Start the server
startServer().catch((error: any) => { // Add type annotation for error
    console.error("Fatal error starting server:", error);
    process.exit(1);
});
