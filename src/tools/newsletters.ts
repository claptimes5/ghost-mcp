// src/tools/newsletters.ts
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
  sender_reply_to: z.string().optional(),
  status: z.string().optional(),
  subscribe_on_signup: z.boolean().optional(),
  show_header_icon: z.boolean().optional(),
  show_header_title: z.boolean().optional(),
  show_header_name: z.boolean().optional(),
  title_font_category: z.string().optional(),
  title_alignment: z.string().optional(),
  show_feature_image: z.boolean().optional(),
  body_font_category: z.string().optional(),
  show_badge: z.boolean().optional(),
  // Add more fields as needed
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  sender_name: z.string().optional(),
  sender_email: z.string().optional(),
  sender_reply_to: z.string().optional(),
  status: z.string().optional(),
  subscribe_on_signup: z.boolean().optional(),
  sort_order: z.number().optional(),
  header_image: z.string().optional(),
  show_header_icon: z.boolean().optional(),
  show_header_title: z.boolean().optional(),
  title_font_category: z.string().optional(),
  title_alignment: z.string().optional(),
  show_feature_image: z.boolean().optional(),
  body_font_category: z.string().optional(),
  footer_content: z.string().optional(),
  show_badge: z.boolean().optional(),
  show_header_name: z.boolean().optional(),
  // Add more fields as needed
};
const deleteParams = {
  id: z.string(),
};

export function registerNewsletterTools(server: McpServer) {
  // Browse newsletters
  registerTool(
    server,
    "newsletters_browse",
    { description: "List newsletters.", inputSchema: browseParams },
    async (args) => {
      const newsletters = await ghostApiClient.newsletters.browse(args);
      return jsonResult(newsletters);
    }
  );

  // Read newsletter
  registerTool(
    server,
    "newsletters_read",
    { description: "Read a newsletter by id or slug.", inputSchema: readParams },
    async (args) => {
      const newsletter = await ghostApiClient.newsletters.read(args);
      return jsonResult(newsletter);
    }
  );

  // Add newsletter
  registerTool(
    server,
    "newsletters_add",
    { description: "Create a newsletter.", inputSchema: addParams },
    async (args) => {
      const newsletter = await ghostApiClient.newsletters.add(args);
      return jsonResult(newsletter);
    }
  );

  // Edit newsletter
  registerTool(
    server,
    "newsletters_edit",
    { description: "Update a newsletter.", inputSchema: editParams },
    async (args) => {
      const newsletter = await ghostApiClient.newsletters.edit(args);
      return jsonResult(newsletter);
    }
  );

  // Delete newsletter
  registerTool(
    server,
    "newsletters_delete",
    { description: "Delete a newsletter.", inputSchema: deleteParams },
    async (args) => {
      await ghostApiClient.newsletters.delete(args);
      return textResult(`Newsletter with id ${args.id} deleted.`);
    }
  );
}