import {
	InsufficientScopeError,
	InvalidTokenError,
	ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";

export { SumUpMcpAgent } from "./sumup-agent";

import { protectedResourceMetadata, verifyAccessToken } from "./auth";
import {
	CORS_HEADERS,
	MCP_ROUTE,
	OPENAI_APPS_CHALLENGE_ROUTE,
	PROTECTED_RESOURCE_WELL_KNOWN,
	SCOPES_SUPPORTED,
	SSE_ROUTE,
} from "./config";
import { protocolErrorResponse, withCorsHeaders } from "./protocol";
import { type SumUpAgentProps, SumUpMcpAgent } from "./sumup-agent";

type ContextWithProps = ExecutionContext & { props?: SumUpAgentProps };

const mcpHandler = SumUpMcpAgent.serve(MCP_ROUTE, {
	binding: "SUMUP_MCP_AGENT",
});

const sseHandler = SumUpMcpAgent.serveSSE(SSE_ROUTE, {
	binding: "SUMUP_MCP_AGENT",
});

const PROTECTED_RESOURCE_METADATA_URL = `${PROTECTED_RESOURCE_WELL_KNOWN}${MCP_ROUTE}`;

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const corsResponse = handleCors(request);
		if (corsResponse) {
			return corsResponse;
		}

		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/") {
			return jsonResponse({
				name: "SumUp MCP",
				transports: {
					streamableHttp: MCP_ROUTE,
					sse: SSE_ROUTE,
				},
				resource_metadata: PROTECTED_RESOURCE_WELL_KNOWN,
			});
		}

		if (
			request.method === "GET" &&
			url.pathname === PROTECTED_RESOURCE_WELL_KNOWN
		) {
			return jsonResponse(protectedResourceMetadata(env));
		}

		if (
			request.method === "GET" &&
			url.pathname === `${PROTECTED_RESOURCE_WELL_KNOWN}${MCP_ROUTE}`
		) {
			return jsonResponse(protectedResourceMetadata(env));
		}

		if (
			request.method === "GET" &&
			url.pathname === `${PROTECTED_RESOURCE_WELL_KNOWN}${SSE_ROUTE}`
		) {
			return jsonResponse(protectedResourceMetadata(env));
		}

		if (
			request.method === "GET" &&
			url.pathname === OPENAI_APPS_CHALLENGE_ROUTE
		) {
			if (!env.OPENAI_APPS_CHALLENGE) {
				return new Response(null, {
					status: 404,
					headers: CORS_HEADERS,
				});
			}

			return new Response(env.OPENAI_APPS_CHALLENGE, {
				headers: withCorsHeaders({
					"content-type": "text/plain",
				}),
			});
		}

		if (url.pathname === MCP_ROUTE) {
			return authenticateAndHandle(request, env, ctx, mcpHandler.fetch);
		}

		if (url.pathname === SSE_ROUTE) {
			return authenticateAndHandle(request, env, ctx, sseHandler.fetch);
		}

		return protocolErrorResponse(404, "Not Found");
	},
};

async function authenticateAndHandle(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	handler: (
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	) => Promise<Response>,
): Promise<Response> {
	try {
		const token = bearerToken(request);
		const authInfo = await verifyAccessToken(env, token);

		const hasAllScopes = SCOPES_SUPPORTED.every((scope) =>
			authInfo.scopes.includes(scope),
		);
		if (!hasAllScopes) {
			throw new InsufficientScopeError("Insufficient scope");
		}

		if (
			typeof authInfo.expiresAt !== "number" ||
			Number.isNaN(authInfo.expiresAt)
		) {
			throw new InvalidTokenError("Token has no expiration time");
		}

		if (authInfo.expiresAt < Date.now() / 1000) {
			throw new InvalidTokenError("Token has expired");
		}

		return await handler(request, env, withProps(ctx, token));
	} catch (error) {
		return authErrorResponse(error, env);
	}
}

function bearerToken(request: Request): string {
	const authHeader = request.headers.get("authorization");
	if (!authHeader) {
		throw new InvalidTokenError("Missing Authorization header");
	}

	const [type, token] = authHeader.split(" ");
	if (type.toLowerCase() !== "bearer" || !token) {
		throw new InvalidTokenError(
			"Invalid Authorization header format, expected 'Bearer TOKEN'",
		);
	}

	return token;
}

function authErrorResponse(error: unknown, env: Env): Response {
	const resourceMetadataUrl = new URL(
		PROTECTED_RESOURCE_METADATA_URL,
		env.HOST,
	).toString();

	if (error instanceof InvalidTokenError) {
		return jsonResponse(error.toResponseObject(), {
			status: 401,
			headers: {
				"WWW-Authenticate": wwwAuthenticateHeader(
					error.errorCode,
					error.message,
					resourceMetadataUrl,
				),
			},
		});
	}

	if (error instanceof InsufficientScopeError) {
		return jsonResponse(error.toResponseObject(), {
			status: 403,
			headers: {
				"WWW-Authenticate": wwwAuthenticateHeader(
					error.errorCode,
					error.message,
					resourceMetadataUrl,
				),
			},
		});
	}

	// Verification failures are auth failures even if they do not come from the SDK
	// middleware's error classes.
	if (error instanceof Error) {
		console.error("Authentication failed", error);
		const authError = new InvalidTokenError(error.message);
		return jsonResponse(authError.toResponseObject(), {
			status: 401,
			headers: {
				"WWW-Authenticate": wwwAuthenticateHeader(
					authError.errorCode,
					authError.message,
					resourceMetadataUrl,
				),
			},
		});
	}

	console.error("Unhandled auth error", error);
	const serverError = new ServerError("Internal Server Error");
	return jsonResponse(serverError.toResponseObject(), {
		status: 500,
	});
}

function wwwAuthenticateHeader(
	errorCode: string,
	message: string,
	resourceMetadataUrl: string,
): string {
	return `Bearer error="${errorCode}", error_description="${message}", scope="${SCOPES_SUPPORTED.join(" ")}", resource_metadata="${resourceMetadataUrl}"`;
}

function withProps(
	executionCtx: ExecutionContext,
	token?: string,
): ContextWithProps {
	const contextWithProps = executionCtx as ContextWithProps;
	contextWithProps.props = token ? { token } : {};
	return contextWithProps;
}

function handleCors(request: Request): Response | null {
	if (request.method !== "OPTIONS") {
		return null;
	}

	return new Response(null, {
		status: 204,
		headers: CORS_HEADERS,
	});
}

function jsonResponse(
	body: unknown,
	init?: {
		headers?: Record<string, string>;
		status?: number;
	},
): Response {
	return new Response(JSON.stringify(body), {
		status: init?.status,
		headers: withCorsHeaders({
			"content-type": "application/json",
			...init?.headers,
		}),
	});
}
