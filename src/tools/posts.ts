// src/tools/posts.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { registerTool, jsonResult, textResult } from "../toolPolicy";
import { isAllowed } from "../config";

// Parameter schemas as ZodRawShape (object literals)
const formats = z
  .string()
  .optional()
  .describe("Comma-separated content formats to return: html, lexical, plaintext");
const browseParams = {
  filter: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  order: z.string().optional(),
  formats,
};
const readParams = {
  id: z.string().optional(),
  slug: z.string().optional(),
  formats,
};
// Shared mutable post fields — accepted by both posts_add and posts_edit.
// Mirrors the Ghost Admin API post resource:
// https://ghost.org/docs/admin-api/#the-post-object
const tagRef = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    slug: z.string().optional(),
    name: z.string().optional(),
  }),
]);
const authorRef = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    slug: z.string().optional(),
    email: z.string().optional(),
  }),
]);
const postMutableFields = {
  html: z.string().optional(),
  lexical: z.string().optional(),
  // Publishing makes content public (and is a way to leak data), so it's opt-in.
  status: isAllowed("publish")
    ? z.enum(["draft", "published", "scheduled"]).optional()
    : z
        .literal("draft")
        .optional()
        .describe("Only draft is allowed; publish from Ghost Admin. Edits to already-published posts go live immediately."),
  slug: z.string().optional(),
  visibility: z.string().optional(),
  featured: z.boolean().optional(),
  email_only: z.boolean().optional(),
  published_at: z.string().optional(),
  custom_excerpt: z.string().optional(),
  feature_image: z.string().optional(),
  feature_image_alt: z.string().optional(),
  feature_image_caption: z.string().optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  og_title: z.string().optional(),
  og_description: z.string().optional(),
  og_image: z.string().optional(),
  twitter_title: z.string().optional(),
  twitter_description: z.string().optional(),
  twitter_image: z.string().optional(),
  canonical_url: z.string().optional(),
  tags: z.array(tagRef).optional(),
  authors: z.array(authorRef).optional(),
  // Injects raw HTML/JS into the public site, so only exposed when explicitly allowed.
  ...(isAllowed("code_injection")
    ? {
        codeinjection_head: z.string().optional(),
        codeinjection_foot: z.string().optional(),
      }
    : {}),
};
const addParams = {
  title: z.string(),
  ...postMutableFields,
};
const editParams = {
  id: z.string(),
  updated_at: z.string(),
  title: z.string().optional(),
  ...postMutableFields,
};
const deleteParams = {
  id: z.string(),
};

export function registerPostTools(server: McpServer) {
  // Browse posts
  registerTool(
    server,
    "posts_browse",
    { description: "List posts. Supports Ghost NQL filters (e.g. \"status:draft\"), pagination and ordering. Use formats to choose content formats (html, lexical, plaintext).", inputSchema: browseParams },
    async (args) => {
      const posts = await ghostApiClient.posts.browse(args);
      return jsonResult(posts);
    }
  );

  // Read post
  registerTool(
    server,
    "posts_read",
    { description: "Read a single post by id or slug. Returns html by default; pass formats to request lexical or plaintext.", inputSchema: readParams },
    async (args) => {
      const { formats = "html", ...identifier } = args;
      const post = await ghostApiClient.posts.read(identifier, { formats });
      return jsonResult(post);
    }
  );

  // Add post
  registerTool(
    server,
    "posts_add",
    { description: "Create a post. Provide content as html (converted by Ghost) or lexical JSON. Status defaults to draft.", inputSchema: addParams },
    async (args) => {
      // If html is present, use source: "html" to ensure Ghost uses the html content
      const options = args.html ? { source: "html" } : undefined;
      const post = await ghostApiClient.posts.add(args, options);
      return jsonResult(post);
    }
  );

  // Edit post
  registerTool(
    server,
    "posts_edit",
    { description: "Update a post. Requires the current updated_at from posts_read (Ghost rejects stale edits). Sending html replaces the whole post body.", inputSchema: editParams },
    async (args) => {
      // If html is present, use source: "html" to ensure Ghost uses the html content for updates
      const options = args.html ? { source: "html" } : undefined;
      const post = await ghostApiClient.posts.edit(args, options);
      return jsonResult(post);
    }
  );

  // Delete post
  registerTool(
    server,
    "posts_delete",
    { description: "Permanently delete a post.", inputSchema: deleteParams },
    async (args) => {
      await ghostApiClient.posts.delete(args);
      return textResult(`Post with id ${args.id} deleted.`);
    }
  );
}