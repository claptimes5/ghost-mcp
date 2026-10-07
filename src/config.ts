// Read configuration values directly from process.env
export const GHOST_API_URL: string = process.env.GHOST_API_URL as string;
export const GHOST_ADMIN_API_KEY: string = process.env.GHOST_ADMIN_API_KEY as string;
export const GHOST_API_VERSION: string = process.env.GHOST_API_VERSION as string || 'v5.0'; // Default to v5.0

// Basic validation to ensure required environment variables are set
if (!GHOST_API_URL) {
    console.error("Error: GHOST_API_URL environment variable is not set.");
    process.exit(1);
}

if (!GHOST_ADMIN_API_KEY) {
    console.error("Error: GHOST_ADMIN_API_KEY environment variable is not set.");
    process.exit(1);
}

// Tool guardrails. The Admin API key has full admin rights, so these are the only
// way to limit what an LLM (or a prompt injected into content it reads) can do.
const parseList = (value: string | undefined): string[] =>
    (value ?? '').split(',').map(s => s.trim()).filter(Boolean);

// Only register browse/read tools.
export const READ_ONLY: boolean = process.env.GHOST_MCP_READ_ONLY === 'true';

// Optional allowlist of tool names; when set, every other tool is removed.
export const ENABLED_TOOLS: string[] = parseList(process.env.GHOST_MCP_TOOLS);

// High-risk capabilities that are off by default:
//   webhooks           - webhooks_add/edit/delete (can send member data to any URL)
//   code_injection     - codeinjection_head/foot on posts (arbitrary scripts on the public site)
//   privileged_invites - invites for roles above Editor (e.g. Administrator)
//   staff_email        - changing a staff user's email (enables password-reset takeover)
export const ALLOW_OPTIONS = ['webhooks', 'code_injection', 'privileged_invites', 'staff_email'] as const;
export type AllowOption = typeof ALLOW_OPTIONS[number];
const allowed = parseList(process.env.GHOST_MCP_ALLOW);
for (const option of allowed) {
    if (!(ALLOW_OPTIONS as readonly string[]).includes(option)) {
        console.error(`Error: unknown GHOST_MCP_ALLOW value "${option}". Valid values: ${ALLOW_OPTIONS.join(', ')}`);
        process.exit(1);
    }
}
export const isAllowed = (option: AllowOption): boolean => allowed.includes(option);
