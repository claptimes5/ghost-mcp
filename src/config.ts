import { execSync } from 'child_process';

// Desktop Extension (.mcpb) hosts may pass an unfilled optional setting through as
// its literal placeholder; treat that the same as an unset variable.
const env = (name: string): string | undefined => {
    const value = process.env[name];
    return value && !/^\$\{user_config\.\w+\}$/.test(value) ? value : undefined;
};

// Read configuration values directly from process.env
export const GHOST_API_URL: string = env('GHOST_API_URL') as string;
export const GHOST_API_VERSION: string = env('GHOST_API_VERSION') || 'v5.0'; // Default to v5.0

// The key can be given directly, or fetched from a password manager or keychain with a
// command (e.g. `pass show ghost/token`) so it isn't stored in the MCP config file.
function loadAdminApiKey(): string | undefined {
    const command = env('GHOST_ADMIN_API_KEY_COMMAND');
    if (!command) return env('GHOST_ADMIN_API_KEY');
    try {
        return execSync(command, { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'inherit'] }).trim();
    } catch {
        console.error("Error: GHOST_ADMIN_API_KEY_COMMAND failed.");
        process.exit(1);
    }
}
export const GHOST_ADMIN_API_KEY: string = loadAdminApiKey() as string;

// Basic validation to ensure required environment variables are set
if (!GHOST_API_URL) {
    console.error("Error: GHOST_API_URL environment variable is not set.");
    process.exit(1);
}

if (!GHOST_ADMIN_API_KEY) {
    console.error("Error: set GHOST_ADMIN_API_KEY or GHOST_ADMIN_API_KEY_COMMAND.");
    process.exit(1);
}

// Tool guardrails. The Admin API key has full admin rights, so these are the only
// way to limit what an LLM (or a prompt injected into content it reads) can do.
const parseList = (value: string | undefined): string[] =>
    (value ?? '').split(',').map(s => s.trim()).filter(Boolean);

// Only register browse/read tools.
export const READ_ONLY: boolean = env('GHOST_MCP_READ_ONLY') === 'true';

// Optional allowlist of tool names; when set, every other tool is removed.
export const ENABLED_TOOLS: string[] = parseList(env('GHOST_MCP_TOOLS'));

// High-risk capabilities that are off by default:
//   publish            - setting a post's status to published or scheduled
//   webhooks           - webhooks_add/edit/delete (can send member data to any URL)
//   code_injection     - codeinjection_head/foot on posts (arbitrary scripts on the public site)
//   privileged_invites - invites for roles above Editor (e.g. Administrator)
//   staff_email        - changing a staff user's email (enables password-reset takeover)
export const ALLOW_OPTIONS = ['publish', 'webhooks', 'code_injection', 'privileged_invites', 'staff_email'] as const;
export type AllowOption = typeof ALLOW_OPTIONS[number];
const allowed = parseList(env('GHOST_MCP_ALLOW'));
for (const option of allowed) {
    if (!(ALLOW_OPTIONS as readonly string[]).includes(option)) {
        console.error(`Error: unknown GHOST_MCP_ALLOW value "${option}". Valid values: ${ALLOW_OPTIONS.join(', ')}`);
        process.exit(1);
    }
}
export const isAllowed = (option: AllowOption): boolean => allowed.includes(option);
