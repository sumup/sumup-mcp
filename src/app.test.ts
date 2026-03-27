import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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
	const servers: Array<{ close: (cb: (err?: Error) => void) => void }> = [];

	afterEach(async () => {
		await Promise.all(
			servers.splice(0).map(
				(server) =>
					new Promise<void>((resolve, reject) => {
						server.close((error) => {
							if (error) {
								reject(error);
								return;
							}

							resolve();
						});
					}),
			),
		);
	});

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test("serves protected resource metadata on both well-known paths", async () => {
		const baseUrl = await startServer();

		const legacyResponse = await fetch(
			`${baseUrl}/.well-known/oauth-protected-resource`,
		);
		const scopedResponse = await fetch(
			`${baseUrl}/.well-known/oauth-protected-resource/mcp`,
		);
		const sseResponse = await fetch(
			`${baseUrl}/.well-known/oauth-protected-resource/sse`,
		);

		expect(legacyResponse.status).toBe(200);
		expect(scopedResponse.status).toBe(200);
		expect(sseResponse.status).toBe(200);
		const expectedMcpMetadata = {
			resource: "https://mcp-theta.sam-app.ro",
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
		const baseUrl = await startServer();
		const response = await fetch(
			`${baseUrl}/.well-known/oauth-authorization-server`,
		);

		expect(response.status).toBe(404);
	});

	test("challenges unauthenticated MCP requests with required scopes", async () => {
		const baseUrl = await startServer();
		const response = await fetch(`${baseUrl}/mcp`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: "1",
				method: "initialize",
				params: {},
			}),
		});

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe(
			'Bearer error="invalid_token", error_description="Missing Authorization header", scope="offline_access email", resource_metadata="https://mcp-theta.sam-app.ro/.well-known/oauth-protected-resource"',
		);
	});

	async function startServer() {
		const server = createApp(env).listen(0);
		servers.push(server);
		await new Promise<void>((resolve) => {
			server.once("listening", resolve);
		});

		const address = server.address() as AddressInfo;
		return `http://127.0.0.1:${address.port}`;
	}
});
