// src/tools/invites.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { invitesApi, rolesApi } from "../ghostApi";
import { registerTool, jsonResult, textResult } from "../toolPolicy";
import { isAllowed } from "../config";

// Roles the LLM may invite people into. Anything else (Administrator, Super Editor,
// roles added in future Ghost versions) needs GHOST_MCP_ALLOW=privileged_invites.
const UNPRIVILEGED_ROLES = ["Contributor", "Author", "Editor"];

// Parameter schemas as ZodRawShape (object literals)
const browseParams = {
  filter: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  order: z.string().optional(),
};
const addParams = {
  role_id: z.string(),
  email: z.string(),
};
const deleteParams = {
  id: z.string(),
};

export function registerInviteTools(server: McpServer) {
  // Browse invites
  registerTool(
    server,
    "invites_browse",
    { description: "List pending staff invites.", inputSchema: browseParams },
    async (args) => {
      const invites = await invitesApi.browse(args);
      return jsonResult(invites);
    }
  );

  // Add invite
  registerTool(
    server,
    "invites_add",
    { description: "Invite a new staff user by email with the given role_id (see roles_browse).", inputSchema: addParams },
    async (args) => {
      if (!isAllowed("privileged_invites")) {
        const role = await rolesApi.read(args.role_id);
        if (!role || !UNPRIVILEGED_ROLES.includes(role.name)) {
          throw new Error(
            `Inviting users with the "${role?.name ?? args.role_id}" role is disabled. Allowed roles: ${UNPRIVILEGED_ROLES.join(", ")}.`
          );
        }
      }
      const invite = await invitesApi.add(args);
      return jsonResult(invite);
    }
  );

  // Delete invite
  registerTool(
    server,
    "invites_delete",
    { description: "Revoke a pending staff invite.", inputSchema: deleteParams },
    async (args) => {
      await invitesApi.delete(args.id);
      return textResult(`Invite with id ${args.id} deleted.`);
    }
  );
}