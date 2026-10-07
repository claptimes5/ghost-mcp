// src/tools/webhooks.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { registerTool, jsonResult, textResult } from "../toolPolicy";

// Parameter schemas as ZodRawShape (object literals)
const addParams = {
  event: z.string(),
  target_url: z.string(),
  name: z.string().optional(),
  secret: z.string().optional(),
  api_version: z.string().optional(),
  integration_id: z.string().optional(), // Required for user-authenticated requests
};
const editParams = {
  id: z.string(),
  event: z.string().optional(),
  target_url: z.string().optional(),
  name: z.string().optional(),
  api_version: z.string().optional(),
};
const deleteParams = {
  id: z.string(),
};

export function registerWebhookTools(server: McpServer) {
  // Add webhook
  registerTool(
    server,
    "webhooks_add",
    { description: "Create a webhook that POSTs to target_url when the event fires.", inputSchema: addParams },
    async (args) => {
      const webhook = await ghostApiClient.webhooks.add(args);
      return jsonResult(webhook);
    }
  );

  // Edit webhook
  registerTool(
    server,
    "webhooks_edit",
    { description: "Update a webhook.", inputSchema: editParams },
    async (args) => {
      const webhook = await ghostApiClient.webhooks.edit(args);
      return jsonResult(webhook);
    }
  );

  // Delete webhook
  registerTool(
    server,
    "webhooks_delete",
    { description: "Delete a webhook.", inputSchema: deleteParams },
    async (args) => {
      await ghostApiClient.webhooks.delete(args);
      return textResult(`Webhook with id ${args.id} deleted.`);
    }
  );
}