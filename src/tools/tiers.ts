// src/tools/tiers.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tiersApi } from "../ghostApi";
import { registerTool, jsonResult } from "../toolPolicy";

// Parameter schemas as ZodRawShape (object literals)
const browseParams = {
  filter: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  order: z.string().optional(),
};
const readParams = {
  id: z.string(),
};
const tierMutableFields = {
  description: z.string().optional(),
  welcome_page_url: z.string().optional(),
  visibility: z.enum(["public", "none"]).optional(),
  monthly_price: z.number().optional(),
  yearly_price: z.number().optional(),
  currency: z.string().optional(),
  benefits: z.array(z.string()).optional(),
  trial_days: z.number().optional(),
};
const addParams = {
  name: z.string(),
  ...tierMutableFields,
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  active: z.boolean().optional(),
  ...tierMutableFields,
};

export function registerTierTools(server: McpServer) {
  // Browse tiers
  registerTool(
    server,
    "tiers_browse",
    { description: "List membership tiers.", inputSchema: browseParams },
    async (args) => {
      const tiers = await tiersApi.browse(args);
      return jsonResult(tiers);
    }
  );

  // Read tier
  registerTool(
    server,
    "tiers_read",
    { description: "Read a tier by id.", inputSchema: readParams },
    async (args) => {
      const tier = await tiersApi.read(args.id);
      return jsonResult(tier);
    }
  );

  // Add tier
  registerTool(
    server,
    "tiers_add",
    { description: "Create a paid membership tier. Prices are in the smallest currency unit (e.g. cents).", inputSchema: addParams },
    async (args) => {
      const tier = await tiersApi.add(args);
      return jsonResult(tier);
    }
  );

  // Edit tier (Ghost has no delete endpoint for tiers; archive with active: false)
  registerTool(
    server,
    "tiers_edit",
    { description: "Update a tier. Set active to false to archive it (Ghost does not delete tiers).", inputSchema: editParams },
    async ({ id, ...tier }) => {
      const updated = await tiersApi.edit(id, tier);
      return jsonResult(updated);
    }
  );
}
