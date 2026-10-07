# Ghost MCP Server

A Model Context Protocol (MCP) server for interacting with Ghost CMS through LLM interfaces like Claude. This server provides secure and comprehensive access to your Ghost blog, leveraging JWT authentication and a rich set of MCP tools for managing posts, users, members, tiers, offers, and newsletters.

![demo](./assets/ghost-mcp-demo.gif)

## Features

- Ghost Admin API access via `@tryghost/admin-api`, plus direct calls for tiers, offers, roles and invites
- Tools for posts, members, users, tags, tiers, offers, newsletters, invites, roles and webhooks
- Filtering with Ghost's NQL syntax, pagination and ordering
- Configurable guardrails (read-only mode, tool allowlist, opt-in high-risk capabilities); see [Security](#security)

## Usage

### 1. Create a limited Ghost credential

A Ghost Admin API key from a custom integration has full administrator rights, so prefer a **staff access token**: it signs requests the same way, but Ghost limits it to that staff user's role.

1. In Ghost Admin, go to **Settings → Staff** and invite a user for the AI with the least powerful role that fits. To edit any post, that's **Editor**, which can't access members, site settings or integrations. Authors can only edit their own posts, and Contributors only their own drafts.
2. Sign in as that user, open their profile and copy the **Staff access token**.

The guardrails below still apply on top of the role, but the role is what Ghost itself enforces.

#### Store the token

Keep the token in a password manager rather than in an MCP config file. On Linux or WSL, [`pass`](https://www.passwordstore.org/) works well:

```bash
sudo apt install pass
gpg --quick-generate-key "Your Name <you@example.com>"
pass init you@example.com
pass insert ghost/staff-token
```

`gpg --quick-generate-key` asks for a passphrase to protect the store, and `pass insert` asks you to paste the token. Skip this if you already use `pass` or another password manager with a command-line tool.

MCP clients start the server in the background, where there's no terminal to type a passphrase into. Unless your system has a graphical passphrase prompt, the server can only fetch the token while GPG has your passphrase cached, so unlock the store before starting your client:

```bash
pass show ghost/staff-token > /dev/null
```

GPG forgets the passphrase after 10 minutes by default; the server only needs it at startup. If your client restarts the server later, it fails with `GHOST_ADMIN_API_KEY_COMMAND failed` until you unlock the store again. To keep the passphrase cached longer, set `default-cache-ttl` and `max-cache-ttl` (in seconds) in `~/.gnupg/gpg-agent.conf`.

### 2. Install the server

Build it from a local clone of this repository:

```bash
git clone https://github.com/claptimes5/ghost-mcp.git
cd ghost-mcp
pnpm install
```

> Running `npx @fanyangmeng/ghost-mcp` installs the upstream npm package, not this fork, and gives the upstream publisher code execution with your Ghost credential. Run a local build instead.

### 3. Connect your MCP client

**Claude Desktop.** Run `pnpm pack:mcpb` and open `dist/ghost-mcp.mcpb` to install it as an extension. Desktop asks for your settings and keeps the token in your OS keychain rather than a config file.

**Claude Code.** Keep the token in a password manager and give the server a command that prints it, so it never appears in your config:

```bash
claude mcp add ghost --scope user \
  -e GHOST_API_URL=https://yourblog.com \
  -e GHOST_ADMIN_API_KEY_COMMAND="pass show ghost/staff-token" \
  -e GHOST_MCP_TOOLS=posts_browse,posts_read,posts_edit \
  -- node /absolute/path/to/ghost-mcp/build/server.js
```

`GHOST_ADMIN_API_KEY_COMMAND` runs through your shell, so any secret store with a CLI works, for example `op read "op://Private/Ghost/credential"` (1Password), `security find-generic-password -s ghost-mcp -w` (macOS Keychain) or `secret-tool lookup service ghost-mcp` (GNOME Keyring).

Check that it connected:

```bash
claude mcp list
```

**Other clients.** Add the server to the client's MCP config, for example:
```json
{
  "mcpServers": {
      "ghost-mcp": {
        "command": "node",
        "args": ["/absolute/path/to/ghost-mcp/build/server.js"],
        "env": {
            "GHOST_API_URL": "https://yourblog.com",
            "GHOST_ADMIN_API_KEY_COMMAND": "pass show ghost/staff-token",
            "GHOST_MCP_READ_ONLY": "true"
        }
      }
    }
}
```

`GHOST_ADMIN_API_KEY` can hold the token directly instead, but then it sits in plain text in that file. `GHOST_API_VERSION` defaults to `v5.0`.

### 4. Try it read-only first

Before letting the AI change anything, ask it something that only reads, such as "list my five most recent posts". If that works, your URL, token and role are set up correctly. Then try an edit on a draft before a published post: edits to a published post go live immediately.

## Security

Anything the AI reads (post content, member names and notes) could contain instructions planted by a third party. No MCP server can fully prevent that, so this one limits what those instructions could do.

| Variable | Effect |
| --- | --- |
| `GHOST_MCP_READ_ONLY=true` | Only expose browse/read tools. |
| `GHOST_MCP_TOOLS=posts_browse,posts_read,...` | Allowlist; every tool not listed is removed, along with its resources and prompts. |
| `GHOST_MCP_ALLOW=...` | Comma-separated list of high-risk capabilities to enable (all off by default). |

`GHOST_MCP_ALLOW` options:

- `publish`: setting a post's status to `published` or `scheduled`. Without it, the AI can only save drafts, and you publish from Ghost Admin. Edits to posts that are already published still go live immediately.
- `webhooks`: the `webhooks_*` tools. A webhook can send member data to any URL.
- `code_injection`: `codeinjection_head`/`codeinjection_foot` on posts, which put arbitrary scripts on your public site.
- `privileged_invites`: invites for roles above Editor (e.g. Administrator). Without it, only Contributor, Author and Editor invites are allowed.
- `staff_email`: changing a staff user's email with `users_edit`, which would let the new address reset that user's password.

The server also:

- **Asks before deleting.** Delete tools ask the person to confirm through MCP elicitation. This is enforced by the server, not the AI. Clients without elicitation support fall back to their own tool-approval prompt, so keep approvals on for this server rather than auto-approving its tools.
- **Warns about risky combinations.** If member data and tools that write public content are enabled together, it logs a warning at startup. That pairing lets injected instructions copy member data into something public. Use separate, narrower server instances instead.
- **Labels every tool** with MCP annotations (`readOnlyHint`, `destructiveHint`) so clients can treat edits and deletes with more care.

For editing existing posts, a good setup is a staff token for an Editor user plus `GHOST_MCP_TOOLS=posts_browse,posts_read,posts_edit`.

## Available Resources

The following Ghost CMS resources are available through this MCP server:

- **Posts**: Articles and content published on your Ghost site.
- **Members**: Registered users and subscribers of your site.
- **Newsletters**: Email newsletters managed and sent via Ghost.
- **Offers**: Promotional offers and discounts for members.
- **Invites**: Invitations for new users or staff to join your Ghost site.
- **Roles**: User roles and permissions within the Ghost admin.
- **Tags**: Organizational tags for posts and content.
- **Tiers**: Subscription tiers and plans for members.
- **Users**: Admin users and staff accounts.
- **Webhooks**: Automated event notifications to external services.

## Available Tools

This MCP server exposes a comprehensive set of tools for managing your Ghost CMS via the Model Context Protocol. Each resource provides a set of operations, typically including browsing, reading, creating, editing, and deleting entities. Below is a summary of the available tools:

### Posts
- **Browse Posts**: List posts with optional filters, pagination, and ordering.
- **Read Post**: Retrieve a post by ID or slug, as HTML by default (`formats` can request `lexical` or `plaintext`).
- **Add Post**: Create a new post with title, content, and status.
- **Edit Post**: Update an existing post by ID. Requires the post's current `updated_at`, and sending `html` replaces the whole post body.
- **Delete Post**: Remove a post by ID.

### Members
- **Browse Members**: List members with filters and pagination.
- **Read Member**: Retrieve a member by ID or email.
- **Add Member**: Create a new member.
- **Edit Member**: Update member details.
- **Delete Member**: Remove a member.

### Newsletters
- **Browse Newsletters**: List newsletters.
- **Read Newsletter**: Retrieve a newsletter by ID.
- **Add Newsletter**: Create a new newsletter.
- **Edit Newsletter**: Update newsletter details.
- **Delete Newsletter**: Remove a newsletter.

### Offers
- **Browse Offers**: List offers.
- **Read Offer**: Retrieve an offer by ID.
- **Add Offer**: Create a new offer.
- **Edit Offer**: Update offer details. Ghost can't delete offers; set `status` to `archived` instead.

### Invites
- **Browse Invites**: List invites.
- **Add Invite**: Create a new invite.
- **Delete Invite**: Remove an invite.

### Roles
- **Browse Roles**: List roles.
- **Read Role**: Retrieve a role by ID.

### Images

- **Upload Image**: Download an image from an http(s) URL and store it in Ghost, returning the Ghost-hosted URL. Local file paths aren't accepted, so content can't be copied from your machine onto the site.

### Tags
- **Browse Tags**: List tags.
- **Read Tag**: Retrieve a tag by ID or slug.
- **Add Tag**: Create a new tag.
- **Edit Tag**: Update tag details.
- **Delete Tag**: Remove a tag.

### Tiers
- **Browse Tiers**: List tiers.
- **Read Tier**: Retrieve a tier by ID.
- **Add Tier**: Create a new tier.
- **Edit Tier**: Update tier details. Ghost can't delete tiers; set `active` to `false` to archive one.

### Users
- **Browse Users**: List users.
- **Read User**: Retrieve a user by ID or slug.
- **Edit User**: Update user details.
- **Delete User**: Remove a user.

### Webhooks
Disabled unless `GHOST_MCP_ALLOW` includes `webhooks`.
- **Add Webhook**: Create a new webhook.
- **Edit Webhook**: Update a webhook.
- **Delete Webhook**: Remove a webhook.

> Each tool is accessible via the MCP protocol and can be invoked from compatible clients. For detailed parameter schemas and usage, see the source code in `src/tools/`.


## Resources and Prompts

Resources return Ghost data as JSON: `post://{post_id}`, `member://{member_id}`, `user://{user_id}`, `tier://{tier_id}`, `offer://{offer_id}`, `newsletter://{newsletter_id}` and `blog://info`. Each one follows the guardrails of its matching read tool (for example, `member://` is hidden if `members_read` is excluded).

The `summarize-post` prompt builds a summary request from a post's title, excerpt and opening HTML.

## Error Handling

Errors from the Ghost API are returned as MCP tool errors carrying Ghost's error type and message (for example `NotFoundError: Tier not found.`).

## Development

```bash
pnpm install
pnpm test
```

`pnpm test` builds the server and runs end-to-end tests in `test/` against a mock Ghost Admin API. `pnpm pack:mcpb` builds the Claude Desktop extension in `dist/`; keep the `version` in `manifest.json` in step with `package.json`.

## Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Create pull request

## License

MIT
