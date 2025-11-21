import { type SumUpAgentProps, SumUpMcpAgent } from "./sumup-agent";

const MCP_ROUTE = "/mcp";
const SSE_ROUTE = "/sse";

const mcpHandler = SumUpMcpAgent.serve(MCP_ROUTE, {
	binding: "SUMUP_MCP_AGENT",
});
const sseHandler = SumUpMcpAgent.serveSSE(SSE_ROUTE, {
	binding: "SUMUP_MCP_AGENT",
});

type ContextWithProps = ExecutionContext & { props?: SumUpAgentProps };

export type Env = {
	SUMUP_API_HOST: string;
};

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname !== MCP_ROUTE && url.pathname !== SSE_ROUTE) {
			return new Response("Not Found", { status: 404 });
		}

		const apiKey = extractApiKey(request);
		if (!apiKey) {
			return unauthorizedResponse();
		}
		const contextWithProps = ctx as ContextWithProps;
		contextWithProps.props = { apiKey };
		if (url.pathname.startsWith(SSE_ROUTE)) {
			return sseHandler.fetch(request, env, contextWithProps);
		}
		return mcpHandler.fetch(request, env, contextWithProps);
	},
};

export { SumUpMcpAgent };

function extractApiKey(request: Request): string | undefined {
	const auth = request.headers.get("authorization");
	if (auth) {
		const [scheme, token] = auth.split(" ");
		if (scheme?.toLowerCase() === "bearer" && token?.length) {
			return token.trim();
		}
	}
	return undefined;
}

function unauthorizedResponse(): Response {
	return new Response(
		JSON.stringify({
			jsonrpc: "2.0",
			error: {
				code: -32601,
				message:
					"Unauthorized: provide a SumUp API key via Authorization header",
			},
			id: null,
		}),
		{
			status: 401,
			headers: { "content-type": "application/json" },
		},
	);
}
