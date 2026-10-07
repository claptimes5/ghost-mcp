// src/tools/offers.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { offersApi } from "../ghostApi";
import { registerTool, jsonResult } from "../toolPolicy";

// Parameter schemas as ZodRawShape (object literals)
const browseParams = {
  filter: z.string().optional(),
};
const readParams = {
  id: z.string(),
};
const addParams = {
  name: z.string(),
  code: z.string(),
  type: z.enum(["percent", "fixed", "trial"]),
  cadence: z.enum(["month", "year"]),
  duration: z.enum(["once", "repeating", "forever", "trial"]),
  amount: z.number().describe("Percent off, fixed amount in the smallest currency unit, or trial length in days"),
  tier_id: z.string(),
  display_title: z.string().optional(),
  display_description: z.string().optional(),
  duration_in_months: z.number().optional().describe("Required when duration is repeating"),
  currency: z.string().optional().describe("Required when type is fixed"),
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  code: z.string().optional(),
  display_title: z.string().optional(),
  display_description: z.string().optional(),
  status: z.enum(["active", "archived"]).optional(),
  // Only a subset of fields are editable per Ghost API docs
};

export function registerOfferTools(server: McpServer) {
  // Browse offers
  registerTool(
    server,
    "offers_browse",
    { description: "List offers.", inputSchema: browseParams },
    async (args) => {
      const offers = await offersApi.browse(args);
      return jsonResult(offers);
    }
  );

  // Read offer
  registerTool(
    server,
    "offers_read",
    { description: "Read an offer by id.", inputSchema: readParams },
    async (args) => {
      const offer = await offersApi.read(args.id);
      return jsonResult(offer);
    }
  );

  // Add offer
  registerTool(
    server,
    "offers_add",
    { description: "Create an offer (discount or free trial) for a tier.", inputSchema: addParams },
    async ({ tier_id, ...offer }) => {
      // Ghost references the tier as an object rather than an id field
      const created = await offersApi.add({ ...offer, tier: { id: tier_id } });
      return jsonResult(created);
    }
  );

  // Edit offer (Ghost has no delete endpoint for offers; archive with status: "archived")
  registerTool(
    server,
    "offers_edit",
    { description: "Update an offer. Set status to \"archived\" to archive it (Ghost does not delete offers).", inputSchema: editParams },
    async ({ id, ...offer }) => {
      const updated = await offersApi.edit(id, offer);
      return jsonResult(updated);
    }
  );
}
