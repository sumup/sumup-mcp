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
		const resourceMetadataUrl = protectedResourceMetadataUrl(env);

		const result = await validateAccessToken(
			env,
			"header.payload.signature",
			resourceMetadataUrl,
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
				issuer: env.SUMUP_AUTH_HOST,
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
		const resourceMetadataUrl = protectedResourceMetadataUrl(cachedEnv);

		await validateAccessToken(
			cachedEnv,
			"header.payload.signature",
			resourceMetadataUrl,
		);
		await validateAccessToken(
			cachedEnv,
			"header.payload.signature",
			resourceMetadataUrl,
		);

		expect(createRemoteJWKSetMock).toHaveBeenCalledTimes(1);
		expect(createRemoteJWKSetMock).toHaveBeenCalledWith(
			new URL("https://auth-beta.sam-app.ro/.well-known/jwks.json"),
		);
	});

	test("returns 401 challenge when JWT verification fails", async () => {
		jwtVerifyMock.mockRejectedValue(new Error("bad token"));
		const resourceMetadataUrl = protectedResourceMetadataUrl(env);

		const result = await validateAccessToken(
			env,
			"header.payload.signature",
			resourceMetadataUrl,
		);

		expect("response" in result && result.response.status).toBe(401);
		expect(
			"response" in result && result.response.headers.get("www-authenticate"),
		).toContain('error="invalid_token"');
	});

	test("returns 401 with resource metadata when no token is provided", async () => {
		const resourceMetadataUrl = protectedResourceMetadataUrl(env);
		const response = unauthorizedResponse(resourceMetadataUrl);

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe(
			`Bearer realm="mcp", resource_metadata="${resourceMetadataUrl}"`,
		);
	});
});
