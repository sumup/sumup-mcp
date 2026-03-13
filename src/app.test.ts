import { beforeEach, describe, expect, test, vi } from "vitest";

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

import { createApp } from "./app";

const env = {
	HOST: "https://mcp-theta.sam-app.ro",
	SUMUP_AUTH_HOST: "https://auth.sam-app.ro/",
	SUMUP_API_HOST: "https://api.sumup.com",
	OPENAI_APPS_CHALLENGE: "",
	SUMUP_MCP_AGENT: {} as Env["SUMUP_MCP_AGENT"],
} as Env;

describe("app metadata routes", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test("serves protected resource metadata on both well-known paths", async () => {
		const app = createApp(env);

		const legacyResponse = await app.request(
			"https://mcp-theta.sam-app.ro/.well-known/oauth-protected-resource",
		);
		const scopedResponse = await app.request(
			"https://mcp-theta.sam-app.ro/.well-known/oauth-protected-resource/mcp",
		);
		const sseResponse = await app.request(
			"https://mcp-theta.sam-app.ro/.well-known/oauth-protected-resource/sse",
		);

		expect(legacyResponse.status).toBe(200);
		expect(scopedResponse.status).toBe(200);
		expect(sseResponse.status).toBe(200);
		const expectedMcpMetadata = {
			resource: "https://mcp-theta.sam-app.ro/mcp",
			authorization_servers: ["https://auth.sam-app.ro/"],
			bearer_methods_supported: ["header"],
			scopes_supported: ["offline_access", "openid", "email"],
			resource_name: "SumUp MCP",
			resource_documentation: "https://developer.sumup.com/tools/llms",
		};
		const expectedSseMetadata = {
			...expectedMcpMetadata,
			resource: "https://mcp-theta.sam-app.ro/sse",
		};

		expect(await legacyResponse.json()).toEqual(expectedMcpMetadata);
		expect(await scopedResponse.json()).toEqual(expectedMcpMetadata);
		expect(await sseResponse.json()).toEqual(expectedSseMetadata);
	});

	test("does not expose worker-local authorization server metadata", async () => {
		const response = await createApp(env).request(
			"https://mcp-theta.sam-app.ro/.well-known/oauth-authorization-server",
		);

		expect(response.status).toBe(404);
	});
});
