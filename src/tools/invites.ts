// src/tools/invites.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
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
  server.tool(
    "invites_browse",
    browseParams,
    async (args, _extra) => {
      const invites = await ghostApiClient.invites.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(invites, null, 2),
          },
        ],
      };
    }
  );

  // Add invite
  server.tool(
    "invites_add",
    addParams,
    async (args, _extra) => {
      if (!isAllowed("privileged_invites")) {
        const role = await ghostApiClient.roles.read({ id: args.role_id });
        if (!UNPRIVILEGED_ROLES.includes(role.name)) {
          throw new Error(
            `Inviting users with the "${role.name}" role is disabled. Allowed roles: ${UNPRIVILEGED_ROLES.join(", ")}.`
          );
        }
      }
      const invite = await ghostApiClient.invites.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(invite, null, 2),
          },
        ],
      };
    }
  );

  // Delete invite
  server.tool(
    "invites_delete",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.invites.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Invite with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}