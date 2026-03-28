import { beforeEach, describe, expect, test, vi } from "vitest";

const { jwtVerifyMock, createRemoteJWKSetMock } = vi.hoisted(() => ({
	jwtVerifyMock: vi.fn(),
	createRemoteJWKSetMock: vi.fn((url: URL) => ({ url })),
}));

vi.mock("jose", () => ({
	createRemoteJWKSet: createRemoteJWKSetMock,
	jwtVerify: jwtVerifyMock,
}));

import { protectedResourceMetadata, verifyAccessToken } from "./auth";

const env = {
	HOST: "https://mcp-theta.sam-app.ro",
	SUMUP_AUTH_HOST: "https://auth.sam-app.ro",
};

describe("auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("uses JWKS-backed verification for JWT tokens", async () => {
		jwtVerifyMock.mockResolvedValue({
			payload: {
				sub: "user-456",
				azp: "client-123",
				scope: "payments:read",
				exp: 1234567890,
			},
		});
		const result = await verifyAccessToken(env, "header.payload.signature");

		expect(result.clientId).toBe("client-123");
		expect(result.scopes).toEqual(["payments:read"]);
		expect(result.extra).toEqual({
			subject: "user-456",
		});
		expect(result.resource).toBeUndefined();
		expect(createRemoteJWKSetMock).toHaveBeenCalledWith(
			new URL("https://auth.sam-app.ro/.well-known/jwks.json"),
		);
		expect(jwtVerifyMock).toHaveBeenCalledWith(
			"header.payload.signature",
			{ url: new URL("https://auth.sam-app.ro/.well-known/jwks.json") },
			expect.objectContaining({
				issuer: "https://auth.sam-app.ro/",
				audience: ["https://mcp-theta.sam-app.ro/mcp"],
			}),
		);
	});

	test("reuses the same remote JWKS resolver across validations", async () => {
		jwtVerifyMock.mockResolvedValue({
			payload: {
				sub: "user-456",
			},
		});
		const cachedEnv = {
			HOST: "https://mcp-beta.sam-app.ro",
			SUMUP_AUTH_HOST: "https://auth-beta.sam-app.ro",
		};
		await verifyAccessToken(cachedEnv, "header.payload.signature");
		await verifyAccessToken(cachedEnv, "header.payload.signature");

		expect(createRemoteJWKSetMock).toHaveBeenCalledTimes(1);
		expect(createRemoteJWKSetMock).toHaveBeenCalledWith(
			new URL("https://auth-beta.sam-app.ro/.well-known/jwks.json"),
		);
	});

	test("throws when JWT verification fails", async () => {
		jwtVerifyMock.mockRejectedValue(new Error("bad token"));
		await expect(
			verifyAccessToken(env, "header.payload.signature"),
		).rejects.toThrow("bad token");
	});

	test("accepts ext-authz style scp claims", async () => {
		jwtVerifyMock.mockResolvedValue({
			payload: {
				sub: "user-456",
				client_id: "client-123",
				scp: ["email", "offline_access"],
				exp: 1234567890,
			},
		});
		const result = await verifyAccessToken(env, "header.payload.signature");

		expect(result.scopes).toEqual(["email", "offline_access"]);
	});

	test("builds protected resource metadata", () => {
		expect(protectedResourceMetadata(env)).toEqual({
			resource: "https://mcp-theta.sam-app.ro/mcp",
			authorization_servers: ["https://auth.sam-app.ro/"],
			bearer_methods_supported: ["header"],
			scopes_supported: ["offline_access", "email"],
			resource_name: "SumUp MCP",
			resource_documentation: "https://developer.sumup.com/tools/llms",
		});
	});
});
