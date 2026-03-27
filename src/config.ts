export const MCP_ROUTE = "/mcp";
export const OPENAI_APPS_CHALLENGE_ROUTE = "/.well-known/openai-apps-challenge";
export const PROTECTED_RESOURCE_WELL_KNOWN =
	"/.well-known/oauth-protected-resource";
export const SSE_ROUTE = "/sse";

export const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers":
		"Content-Type, Accept, Authorization, mcp-session-id, MCP-Protocol-Version",
	"Access-Control-Expose-Headers": "WWW-Authenticate, mcp-session-id",
	"Access-Control-Max-Age": "86400",
};

export const SCOPES_SUPPORTED = ["offline_access", "email"];
export const SERVICE_DOCUMENTATION_URL = new URL(
	"https://developer.sumup.com/tools/llms",
);
