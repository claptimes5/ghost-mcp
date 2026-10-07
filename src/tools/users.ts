// src/tools/users.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { registerTool, jsonResult, textResult } from "../toolPolicy";
import { isAllowed } from "../config";

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
  slug: z.string().optional(),
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  // Changing a staff email lets the new address trigger a password reset, so it's opt-in.
  ...(isAllowed("staff_email") ? { email: z.string().optional() } : {}),
  slug: z.string().optional(),
  bio: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  facebook: z.string().optional(),
  twitter: z.string().optional(),
  // Add more fields as needed
};
const deleteParams = {
  id: z.string(),
};

export function registerUserTools(server: McpServer) {
  // Browse users
  registerTool(
    server,
    "users_browse",
    { description: "List staff users.", inputSchema: browseParams },
    async (args) => {
      const users = await ghostApiClient.users.browse(args);
      return jsonResult(users);
    }
  );

  // Read user
  registerTool(
    server,
    "users_read",
    { description: "Read a staff user by id, email or slug.", inputSchema: readParams },
    async (args) => {
      const user = await ghostApiClient.users.read(args);
      return jsonResult(user);
    }
  );

  // Edit user
  registerTool(
    server,
    "users_edit",
    { description: "Update a staff user's profile.", inputSchema: editParams },
    async (args) => {
      const user = await ghostApiClient.users.edit(args);
      return jsonResult(user);
    }
  );

  // Delete user
  registerTool(
    server,
    "users_delete",
    { description: "Permanently delete a staff user.", inputSchema: deleteParams },
    async (args) => {
      await ghostApiClient.users.delete(args);
      return textResult(`User with id ${args.id} deleted.`);
    }
  );
}