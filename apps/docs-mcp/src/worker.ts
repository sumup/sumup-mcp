import { type DocsEnv, DocsMcpAgent } from "./agent";

const MCP_ROUTE = "/mcp";
const SSE_ROUTE = "/sse";

const mcpHandler = DocsMcpAgent.serve(MCP_ROUTE, {
	binding: "SUMUP_DOCS_MCP_AGENT",
});

const sseHandler = DocsMcpAgent.serveSSE(SSE_ROUTE, {
	binding: "SUMUP_DOCS_MCP_AGENT",
});

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers":
		"Content-Type, Accept, Authorization, mcp-session-id, MCP-Protocol-Version",
	"Access-Control-Max-Age": "86400",
};

export default {
	async fetch(
		request: Request,
		env: DocsEnv,
		ctx: ExecutionContext,
	): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: CORS_HEADERS,
			});
		}

		const url = new URL(request.url);

		if (url.pathname !== MCP_ROUTE && url.pathname !== SSE_ROUTE) {
			return new Response("Not Found", { status: 404 });
		}

		if (url.pathname.startsWith(SSE_ROUTE)) {
			return sseHandler.fetch(request, env, ctx);
		}
		return mcpHandler.fetch(request, env, ctx);
	},
};

export { DocsMcpAgent };
