import { beforeEach, describe, expect, test, vi } from "vitest";

const { jwtVerifyMock, createRemoteJWKSetMock } = vi.hoisted(() => ({
	jwtVerifyMock: vi.fn(),
	createRemoteJWKSetMock: vi.fn((url: URL) => ({ url })),
}));

vi.mock("jose", () => ({
	createRemoteJWKSet: createRemoteJWKSetMock,
	jwtVerify: jwtVerifyMock,
}));

import {
	authorizationServerIssuer,
	protectedResourceMetadataUrl,
	unauthorizedResponse,
	validateAccessToken,
} from "./auth";

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
				scope: "payments:read openid",
				exp: 1234567890,
			},
		});
		const resourceMetadataUrl = protectedResourceMetadataUrl(env, "/mcp");

		const result = await validateAccessToken(
			env,
			"header.payload.signature",
			resourceMetadataUrl,
			"/mcp",
		);

		expect("authInfo" in result && result.authInfo.clientId).toBe("client-123");
		expect("authInfo" in result && result.authInfo.scopes).toEqual([
			"payments:read",
			"openid",
		]);
		expect("authInfo" in result && result.authInfo.extra).toEqual({
			subject: "user-456",
		});
		expect(createRemoteJWKSetMock).toHaveBeenCalledWith(
			new URL("https://auth.sam-app.ro/.well-known/jwks.json"),
		);
		expect(jwtVerifyMock).toHaveBeenCalledWith(
			"header.payload.signature",
			{ url: new URL("https://auth.sam-app.ro/.well-known/jwks.json") },
			expect.objectContaining({
				issuer: "https://auth.sam-app.ro/",
				audience: ["https://mcp-theta.sam-app.ro/mcp", env.HOST],
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
		const resourceMetadataUrl = protectedResourceMetadataUrl(cachedEnv, "/mcp");

		await validateAccessToken(
			cachedEnv,
			"header.payload.signature",
			resourceMetadataUrl,
			"/mcp",
		);
		await validateAccessToken(
			cachedEnv,
			"header.payload.signature",
			resourceMetadataUrl,
			"/mcp",
		);

		expect(createRemoteJWKSetMock).toHaveBeenCalledTimes(1);
		expect(createRemoteJWKSetMock).toHaveBeenCalledWith(
			new URL("https://auth-beta.sam-app.ro/.well-known/jwks.json"),
		);
	});

	test("returns 401 challenge when JWT verification fails", async () => {
		jwtVerifyMock.mockRejectedValue(new Error("bad token"));
		const resourceMetadataUrl = protectedResourceMetadataUrl(env, "/mcp");

		const result = await validateAccessToken(
			env,
			"header.payload.signature",
			resourceMetadataUrl,
			"/mcp",
		);

		expect("response" in result && result.response.status).toBe(401);
		expect(
			"response" in result && result.response.headers.get("www-authenticate"),
		).toBe(
			`Bearer realm="mcp", error="invalid_token", scope="offline_access openid email", resource_metadata="${resourceMetadataUrl}"`,
		);
	});

	test("returns 401 with resource metadata when no token is provided", async () => {
		const resourceMetadataUrl = protectedResourceMetadataUrl(env, "/mcp");
		const response = unauthorizedResponse(resourceMetadataUrl);

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe(
			`Bearer realm="mcp", scope="offline_access openid email", resource_metadata="${resourceMetadataUrl}"`,
		);
		expect(resourceMetadataUrl).toBe(
			"https://mcp-theta.sam-app.ro/.well-known/oauth-protected-resource/mcp",
		);
	});

	test("canonicalizes the external authorization server issuer", () => {
		expect(authorizationServerIssuer(env)).toBe("https://auth.sam-app.ro/");
		expect(
			authorizationServerIssuer({
				HOST: env.HOST,
				SUMUP_AUTH_HOST: "https://auth-theta.sam-app.ro",
			}),
		).toBe("https://auth-theta.sam-app.ro/");
	});
});
