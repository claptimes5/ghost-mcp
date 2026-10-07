# Ghost MCP Server

A Model Context Protocol (MCP) server for interacting with Ghost CMS through LLM interfaces like Claude. This server provides secure and comprehensive access to your Ghost blog, leveraging JWT authentication and a rich set of MCP tools for managing posts, users, members, tiers, offers, and newsletters.

![demo](./assets/ghost-mcp-demo.gif)

## Features

- Secure Ghost Admin API requests with `@tryghost/admin-api`
- Comprehensive entity access including posts, users, members, tiers, offers, and newsletters
- Advanced search functionality with both fuzzy and exact matching options
- Detailed, human-readable output for Ghost entities
- Robust error handling using custom `GhostError` exceptions
- Integrated logging support via MCP context for enhanced troubleshooting

## Usage

Build the server from a local clone of this repository:

```bash
git clone https://github.com/claptimes5/ghost-mcp.git
cd ghost-mcp
npm install
```

Then add it to your MCP client config, for instance Claude Desktop's `claude_desktop_config.json`:
```json
{
  "mcpServers": {
      "ghost-mcp": {
        "command": "node",
        "args": ["/absolute/path/to/ghost-mcp/build/server.js"],
        "env": {
            "GHOST_API_URL": "https://yourblog.com",
            "GHOST_ADMIN_API_KEY": "your_admin_api_key",
            "GHOST_API_VERSION": "v5.0",
            "GHOST_MCP_READ_ONLY": "true"
        }
      }
    }
}
```

> Running `npx @fanyangmeng/ghost-mcp` installs the upstream npm package, not this fork, and gives the upstream publisher code execution with your Admin API key. Run a local build (or a pinned commit) instead.

## Security

A Ghost Admin API key has full administrator rights and can't be scoped down. Anything the LLM reads (post content, member names and notes) could contain instructions planted by a third party, so this server limits what the LLM can do with the key:

| Variable | Effect |
| --- | --- |
| `GHOST_MCP_READ_ONLY=true` | Only expose browse/read tools. Recommended unless you need the LLM to make changes. |
| `GHOST_MCP_TOOLS=posts_browse,posts_add,...` | Allowlist; every tool not listed is removed. |
| `GHOST_MCP_ALLOW=...` | Comma-separated list of high-risk capabilities to enable (all off by default). |

`GHOST_MCP_ALLOW` options:

- `webhooks`: the `webhooks_*` tools. A webhook can send member data to any URL.
- `code_injection`: `codeinjection_head`/`codeinjection_foot` on posts, which put arbitrary scripts on your public site.
- `privileged_invites`: invites for roles above Editor (e.g. Administrator). Without it, only Contributor, Author and Editor invites are allowed.
- `staff_email`: changing a staff user's email with `users_edit`, which would let the new address reset that user's password.

Every tool also carries MCP annotations (`readOnlyHint`, `destructiveHint`), so clients can ask for confirmation before edits and deletes.

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
- **Read Post**: Retrieve a post by ID or slug.
- **Add Post**: Create a new post with title, content, and status.
- **Edit Post**: Update an existing post by ID.
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
- **Edit Offer**: Update offer details.
- **Delete Offer**: Remove an offer.

### Invites
- **Browse Invites**: List invites.
- **Add Invite**: Create a new invite.
- **Delete Invite**: Remove an invite.

### Roles
- **Browse Roles**: List roles.
- **Read Role**: Retrieve a role by ID.

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
- **Edit Tier**: Update tier details.
- **Delete Tier**: Remove a tier.

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


## Error Handling

Ghost MCP Server employs a custom `GhostError` exception to handle API communication errors and processing issues. This ensures clear and descriptive error messages to assist with troubleshooting.

## Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Create pull request

## License

MIT
