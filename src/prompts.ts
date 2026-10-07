// src/prompts.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "./ghostApi";
import { isToolAllowed } from "./toolPolicy";

// Example prompt: summarize-post
export function registerPrompts(server: McpServer) {
  // The prompt embeds post content, so it follows the posts_read guardrail.
  if (!isToolAllowed("posts_read")) return;

  server.registerPrompt(
    "summarize-post",
    {
      description: "Summarize a Ghost post",
      argsSchema: { postId: z.string() },
    },
    async ({ postId }) => {
      // Fetch the post by ID (the Admin API only returns html when asked)
      const post = await ghostApiClient.posts.read({ id: postId }, { formats: "html" });
      const title = post.title || "";
      const excerpt = post.excerpt || "";
      const html = post.html || "";

      // Compose a summary message
      const summary = `Title: ${title}\nExcerpt: ${excerpt}\n\nContent Preview:\n${html.slice(0, 300)}...`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Summarize the following Ghost post:\n\n${summary}`,
            },
          },
        ],
      };
    }
  );
}
