// src/tools/tags.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { registerTool, jsonResult, textResult } from "../toolPolicy";

// Parameter schemas as ZodRawShape (object literals)
const browseParams = {
  filter: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  order: z.string().optional(),
};
const readParams = {
  id: z.string().optional(),
  slug: z.string().optional(),
};
const addParams = {
  name: z.string(),
  description: z.string().optional(),
  slug: z.string().optional(),
  // Add more fields as needed
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  slug: z.string().optional(),
  // Add more fields as needed
};
const deleteParams = {
  id: z.string(),
};

export function registerTagTools(server: McpServer) {
  // Browse tags
  registerTool(
    server,
    "tags_browse",
    { description: "List tags.", inputSchema: browseParams },
    async (args) => {
      const tags = await ghostApiClient.tags.browse(args);
      return jsonResult(tags);
    }
  );

  // Read tag
  registerTool(
    server,
    "tags_read",
    { description: "Read a tag by id or slug.", inputSchema: readParams },
    async (args) => {
      const tag = await ghostApiClient.tags.read(args);
      return jsonResult(tag);
    }
  );

  // Add tag
  registerTool(
    server,
    "tags_add",
    { description: "Create a tag.", inputSchema: addParams },
    async (args) => {
      const tag = await ghostApiClient.tags.add(args);
      return jsonResult(tag);
    }
  );

  // Edit tag
  registerTool(
    server,
    "tags_edit",
    { description: "Update a tag.", inputSchema: editParams },
    async (args) => {
      const tag = await ghostApiClient.tags.edit(args);
      return jsonResult(tag);
    }
  );

  // Delete tag
  registerTool(
    server,
    "tags_delete",
    { description: "Permanently delete a tag.", inputSchema: deleteParams },
    async (args) => {
      await ghostApiClient.tags.delete(args);
      return textResult(`Tag with id ${args.id} deleted.`);
    }
  );
}