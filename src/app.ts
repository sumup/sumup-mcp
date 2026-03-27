import { Readable } from "node:stream";

import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type {
	Express,
	Request as ExpressRequest,
	Response as ExpressResponse,
	NextFunction,
} from "express";

import {
	protectedResourceMetadata,
	protectedResourceMetadataUrl,
	SumUpOAuthTokenVerifier,
} from "./auth";
import {
	MCP_ROUTE,
	OPENAI_APPS_CHALLENGE_ROUTE,
	PROTECTED_RESOURCE_WELL_KNOWN,
	SSE_ROUTE,
} from "./config";
import { protocolErrorResponse } from "./protocol";
import { type SumUpAgentProps, SumUpMcpAgent } from "./sumup-agent";

type ContextWithProps = ExecutionContext & { props?: SumUpAgentProps };

const mcpHandler = SumUpMcpAgent.serve(MCP_ROUTE, {
	binding: "SUMUP_MCP_AGENT",
});

const sseHandler = SumUpMcpAgent.serveSSE(SSE_ROUTE, {
	binding: "SUMUP_MCP_AGENT",
});

export function createApp(env: Env): Express {
	const app = createMcpExpressApp({
		host: new URL(env.HOST).hostname,
	});

	app.use(setCorsHeaders);

	app.get(PROTECTED_RESOURCE_WELL_KNOWN, (_req, res) => {
		res.json(protectedResourceMetadata(env, MCP_ROUTE));
	});

	app.get(`${PROTECTED_RESOURCE_WELL_KNOWN}${MCP_ROUTE}`, (_req, res) => {
		res.json(protectedResourceMetadata(env, MCP_ROUTE));
	});

	app.get(`${PROTECTED_RESOURCE_WELL_KNOWN}${SSE_ROUTE}`, (_req, res) => {
		res.json(protectedResourceMetadata(env, SSE_ROUTE));
	});

	app.get(OPENAI_APPS_CHALLENGE_ROUTE, (_req, res) => {
		if (!env.OPENAI_APPS_CHALLENGE) {
			res.status(404).end();
			return;
		}

		res.type("text/plain").send(env.OPENAI_APPS_CHALLENGE);
	});

	mountProtectedFetchRoute(app, env, MCP_ROUTE, mcpHandler.fetch);
	mountProtectedFetchRoute(app, env, SSE_ROUTE, sseHandler.fetch);

	app.use((_req, res) => {
		void sendFetchResponse(res, protocolErrorResponse(404, "Not Found"));
	});

	return app;
}

async function proxyFetchHandler(
	req: ExpressRequest,
	res: ExpressResponse,
	env: Env,
	handler: (
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	) => Promise<Response>,
	token?: string,
): Promise<void> {
	const response = await handler(
		toFetchRequest(req, env),
		env,
		withProps(createExecutionContext(), token),
	);

	await sendFetchResponse(res, response);
}

function mountProtectedFetchRoute(
	app: Express,
	env: Env,
	route: string,
	handler: (
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	) => Promise<Response>,
) {
	app.all(
		route,
		requireBearerAuth({
			verifier: new SumUpOAuthTokenVerifier(env, route),
			resourceMetadataUrl: protectedResourceMetadataUrl(env, route),
		}),
		async (req, res, next) => {
			try {
				await proxyFetchHandler(req, res, env, handler, req.auth?.token);
			} catch (error) {
				next(error);
			}
		},
	);
}

function toFetchRequest(req: ExpressRequest, env: Env): globalThis.Request {
	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				headers.append(key, item);
			}
			continue;
		}

		if (typeof value === "string") {
			headers.set(key, value);
		}
	}

	if (!bodylessMethod(req.method)) {
		headers.delete("content-length");
	}

	return new Request(new URL(req.originalUrl, env.HOST), {
		method: req.method,
		headers,
		body: bodylessMethod(req.method)
			? undefined
			: (Readable.toWeb(req) as never),
		duplex: "half",
	} as never);
}

function bodylessMethod(method: string): boolean {
	return method === "GET" || method === "HEAD";
}

async function sendFetchResponse(
	res: ExpressResponse,
	response: globalThis.Response,
) {
	res.status(response.status);
	response.headers.forEach((value, key) => {
		res.setHeader(key, value);
	});

	if (!response.body) {
		res.end();
		return;
	}

	Readable.fromWeb(response.body as never).pipe(res);
}

function createExecutionContext(): ExecutionContext {
	return {
		props: {},
		waitUntil(promise) {
			void promise.catch(() => {});
		},
		passThroughOnException() {},
	} satisfies ExecutionContext;
}

function withProps(
	executionCtx: ExecutionContext,
	token?: string,
): ContextWithProps {
	const contextWithProps = executionCtx as ContextWithProps;
	contextWithProps.props = token ? { token } : {};
	return contextWithProps;
}

function setCorsHeaders(
	req: ExpressRequest,
	res: ExpressResponse,
	next: NextFunction,
) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
	res.setHeader(
		"Access-Control-Allow-Headers",
		"Content-Type, Accept, Authorization, mcp-session-id, MCP-Protocol-Version",
	);
	res.setHeader(
		"Access-Control-Expose-Headers",
		"WWW-Authenticate, mcp-session-id",
	);
	res.setHeader("Access-Control-Max-Age", "86400");

	if (req.method === "OPTIONS") {
		res.status(204).end();
		return;
	}

	next();
}
