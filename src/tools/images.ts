// src/tools/images.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ghostApiClient } from "../ghostApi";
import { registerTool, jsonResult } from "../toolPolicy";

// Ghost picks the stored file type from the extension, so it's derived from the response type.
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

// Only remote URLs, never local paths: a local path would let injected instructions
// copy files from this machine onto the public site.
const uploadParams = {
  url: z.string().url().refine(u => /^https?:/.test(u), "Must be an http(s) URL")
    .describe("Image to copy into Ghost's storage"),
  name: z.string().optional()
    .describe("File name to store it under, without extension (e.g. entrelibros-ourense)"),
};

export function registerImageTools(server: McpServer) {
  registerTool(
    server,
    "images_upload",
    { description: "Download an image from a URL and upload it to Ghost. Returns the Ghost-hosted url to use in posts.", inputSchema: uploadParams },
    async ({ url, name }) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Downloading ${url} failed with HTTP ${response.status}.`);
      const type = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
      const ext = EXTENSIONS[type];
      if (!ext) throw new Error(`${url} is not a supported image (content-type "${type}").`);

      const dir = await mkdtemp(join(tmpdir(), "ghost-mcp-"));
      try {
        const file = join(dir, `${(name ?? "image").replace(/[^\w-]+/g, "-")}.${ext}`);
        await writeFile(file, Buffer.from(await response.arrayBuffer()));
        return jsonResult(await ghostApiClient.images.upload({ file }));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  );
}
