import { describe, expect, test, vi } from "vitest";

vi.mock("./sumup-agent", () => ({
	SumUpMcpAgent: {
		serve: vi.fn(() => ({
			fetch: vi.fn(() => new Response("ok")),
		})),
		serveSSE: vi.fn(() => ({
			fetch: vi.fn(() => new Response("ok")),
		})),
	},
}));

vi.mock("./auth", async () => {
	const actual = await vi.importActual<typeof import("./auth")>("./auth");

	return {
		...actual,
		verifyAccessToken: vi.fn(),
	};
});

import { verifyAccessToken } from "./auth";
import worker from "./worker";

const env = {
	HOST: "https://mcp-theta.sam-app.ro",
	SUMUP_AUTH_HOST: "https://auth.sam-app.ro/",
	SUMUP_API_HOST: "https://api.sumup.com",
	OPENAI_APPS_CHALLENGE: "",
	SUMUP_MCP_AGENT: {} as Env["SUMUP_MCP_AGENT"],
} as Env;

function createExecutionContext(): ExecutionContext {
	return {
		props: {},
		waitUntil(promise) {
			void promise.catch(() => {});
		},
		passThroughOnException() {},
	} satisfies ExecutionContext;
}

describe("worker", () => {
	test("serves protected resource metadata on both well-known paths", async () => {
		const legacyResponse = await worker.fetch(
			new Request(
				"https://mcp-theta.sam-app.ro/.well-known/oauth-protected-resource",
			),
			env,
			createExecutionContext(),
		);
		const scopedResponse = await worker.fetch(
			new Request(
				"https://mcp-theta.sam-app.ro/.well-known/oauth-protected-resource/mcp",
			),
			env,
			createExecutionContext(),
		);
		const sseResponse = await worker.fetch(
			new Request(
				"https://mcp-theta.sam-app.ro/.well-known/oauth-protected-resource/sse",
			),
			env,
			createExecutionContext(),
		);

		expect(legacyResponse.status).toBe(200);
		expect(scopedResponse.status).toBe(200);
		expect(sseResponse.status).toBe(200);
		const expectedMcpMetadata = {
			resource: "https://mcp-theta.sam-app.ro/mcp",
			authorization_servers: ["https://auth.sam-app.ro/"],
			bearer_methods_supported: ["header"],
			scopes_supported: ["offline_access", "email"],
			resource_name: "SumUp MCP",
			resource_documentation: "https://developer.sumup.com/tools/llms",
		};

		expect(await legacyResponse.json()).toEqual(expectedMcpMetadata);
		expect(await scopedResponse.json()).toEqual(expectedMcpMetadata);
		expect(await sseResponse.json()).toEqual(expectedMcpMetadata);
	});

	test("does not expose worker-local authorization server metadata", async () => {
		const response = await worker.fetch(
			new Request(
				"https://mcp-theta.sam-app.ro/.well-known/oauth-authorization-server",
			),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(404);
	});

	test("challenges unauthenticated MCP requests with required scopes", async () => {
		const response = await worker.fetch(
			new Request("https://mcp-theta.sam-app.ro/mcp", {
				method: "POST",
				headers: {
					accept: "text/event-stream, application/json",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: "1",
					method: "initialize",
					params: {},
				}),
			}),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe(
			'Bearer error="invalid_token", error_description="Missing Authorization header", scope="offline_access email", resource_metadata="https://mcp-theta.sam-app.ro/.well-known/oauth-protected-resource/mcp"',
		);
	});

	test("returns a root document", async () => {
		const response = await worker.fetch(
			new Request("https://mcp-theta.sam-app.ro/"),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			name: "SumUp MCP",
			transports: {
				streamableHttp: "/mcp",
				sse: "/sse",
			},
			resource_metadata: "/.well-known/oauth-protected-resource",
		});
	});

	test("passes valid bearer tokens to the MCP handler via props", async () => {
		vi.mocked(verifyAccessToken).mockResolvedValueOnce({
			token: "test-token",
			clientId: "client-123",
			scopes: ["offline_access", "email"],
			expiresAt: Math.floor(Date.now() / 1000) + 300,
		});

		const response = await worker.fetch(
			new Request("https://mcp-theta.sam-app.ro/mcp", {
				method: "POST",
				headers: {
					accept: "text/event-stream, application/json",
					authorization: "Bearer test-token",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: "1",
					method: "initialize",
					params: {},
				}),
			}),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
	});
});
