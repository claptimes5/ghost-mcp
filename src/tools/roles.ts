// src/tools/roles.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rolesApi } from "../ghostApi";
import { registerTool, jsonResult } from "../toolPolicy";

// Parameter schemas as ZodRawShape (object literals)
const browseParams = {
  permissions: z.literal("assign").optional().describe("Only return roles the API key is allowed to assign"),
};
const readParams = {
  id: z.string(),
};

export function registerRoleTools(server: McpServer) {
  // Browse roles
  registerTool(
    server,
    "roles_browse",
    { description: "List staff roles and their ids.", inputSchema: browseParams },
    async (args) => {
      const roles = await rolesApi.browse(args);
      return jsonResult(roles);
    }
  );

  // Read role
  registerTool(
    server,
    "roles_read",
    { description: "Read a staff role by id.", inputSchema: readParams },
    async (args) => {
      const role = await rolesApi.read(args.id);
      if (!role) {
        throw new Error(`Role with id ${args.id} not found.`);
      }
      return jsonResult(role);
    }
  );
}
