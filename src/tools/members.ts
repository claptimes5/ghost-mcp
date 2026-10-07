// src/tools/members.ts
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
  email: z.string().optional(),
};
const addParams = {
  email: z.string(),
  name: z.string().optional(),
  note: z.string().optional(),
  labels: z.array(z.object({ name: z.string(), slug: z.string().optional() })).optional(),
  newsletters: z.array(z.object({ id: z.string() })).optional(),
};
const editParams = {
  id: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  note: z.string().optional(),
  labels: z.array(z.object({ name: z.string(), slug: z.string().optional() })).optional(),
  newsletters: z.array(z.object({ id: z.string() })).optional(),
};
const deleteParams = {
  id: z.string(),
};

export function registerMemberTools(server: McpServer) {
  // Browse members
  registerTool(
    server,
    "members_browse",
    { description: "List members. Supports Ghost NQL filters, pagination and ordering.", inputSchema: browseParams },
    async (args) => {
      const members = await ghostApiClient.members.browse(args);
      return jsonResult(members);
    }
  );

  // Read member
  registerTool(
    server,
    "members_read",
    { description: "Read a single member by id or email.", inputSchema: readParams },
    async (args) => {
      const member = await ghostApiClient.members.read(args);
      return jsonResult(member);
    }
  );

  // Add member
  registerTool(
    server,
    "members_add",
    { description: "Create a member.", inputSchema: addParams },
    async (args) => {
      const member = await ghostApiClient.members.add(args);
      return jsonResult(member);
    }
  );

  // Edit member
  registerTool(
    server,
    "members_edit",
    { description: "Update a member.", inputSchema: editParams },
    async (args) => {
      const member = await ghostApiClient.members.edit(args);
      return jsonResult(member);
    }
  );

  // Delete member
  registerTool(
    server,
    "members_delete",
    { description: "Permanently delete a member.", inputSchema: deleteParams },
    async (args) => {
      await ghostApiClient.members.delete(args);
      return textResult(`Member with id ${args.id} deleted.`);
    }
  );
}