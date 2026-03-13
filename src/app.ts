import { simpleMcpAuthRouter } from "@hono/mcp";
import { Hono } from "hono";
import { cors } from "hono/cors";

import {
	extractBearerToken,
	protectedResourceMetadataUrl,
	unauthorizedResponse,
	validateAccessToken,
} from "./auth";
import {
	MCP_ROUTE,
	OPENAI_APPS_CHALLENGE_ROUTE,
	SCOPES_SUPPORTED,
	SERVICE_DOCUMENTATION_URL,
	SSE_ROUTE,
} from "./config";
import { protocolErrorResponse } from "./protocol";
import { type SumUpAgentProps, SumUpMcpAgent } from "./sumup-agent";

export type AppEnv = {
	Bindings: Env;
	Variables: {
		token: string;
	};
};

type ContextWithProps = ExecutionContext & { props?: SumUpAgentProps };

const mcpHandler = SumUpMcpAgent.serve(MCP_ROUTE, {
	binding: "SUMUP_MCP_AGENT",
});

const sseHandler = SumUpMcpAgent.serveSSE(SSE_ROUTE, {
	binding: "SUMUP_MCP_AGENT",
});

export function createApp(env: Env): Hono<AppEnv> {
	const app = new Hono<AppEnv>();

	app.use(
		"*",
		cors({
			origin: "*",
			allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
			allowHeaders: [
				"Content-Type",
				"Accept",
				"Authorization",
				"mcp-session-id",
				"MCP-Protocol-Version",
			],
			exposeHeaders: ["WWW-Authenticate", "mcp-session-id"],
			maxAge: 86400,
		}),
	);

	app.route(
		"/",
		simpleMcpAuthRouter({
			issuer: env.SUMUP_AUTH_HOST,
			resourceServerUrl: new URL(MCP_ROUTE, env.HOST),
			serviceDocumentationUrl: SERVICE_DOCUMENTATION_URL,
			scopesSupported: SCOPES_SUPPORTED,
			resourceName: "SumUp MCP",
		}),
	);

	app.get(OPENAI_APPS_CHALLENGE_ROUTE, (c) => {
		if (!env.OPENAI_APPS_CHALLENGE) {
			return c.notFound();
		}

		return c.text(env.OPENAI_APPS_CHALLENGE);
	});

	app.use(MCP_ROUTE, async (c, next) => {
		const resourceMetadataUrl = protectedResourceMetadataUrl(env);
		const token = extractBearerToken(c.req.raw);
		if (!token) {
			return unauthorizedResponse(resourceMetadataUrl);
		}

		const validation = await validateAccessToken(
			env,
			token,
			resourceMetadataUrl,
		);
		if ("response" in validation) {
			return validation.response;
		}

		c.set("token", validation.authInfo.token);
		return next();
	});

	app.use(SSE_ROUTE, async (c, next) => {
		const resourceMetadataUrl = protectedResourceMetadataUrl(env);
		const token = extractBearerToken(c.req.raw);
		if (!token) {
			return unauthorizedResponse(resourceMetadataUrl);
		}

		const validation = await validateAccessToken(
			env,
			token,
			resourceMetadataUrl,
		);
		if ("response" in validation) {
			return validation.response;
		}

		c.set("token", validation.authInfo.token);
		return next();
	});

	app.all(MCP_ROUTE, async (c) => {
		return mcpHandler.fetch(
			c.req.raw,
			c.env,
			withProps(c.executionCtx, c.get("token")),
		);
	});

	app.all(SSE_ROUTE, async (c) => {
		return sseHandler.fetch(
			c.req.raw,
			c.env,
			withProps(c.executionCtx, c.get("token")),
		);
	});

	app.notFound(() => protocolErrorResponse(404, "Not Found"));

	return app;
}

function withProps(
	executionCtx: ExecutionContext,
	token: string,
): ContextWithProps {
	const contextWithProps = executionCtx as ContextWithProps;
	contextWithProps.props = { token };
	return contextWithProps;
}
