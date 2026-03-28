import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthProtectedResourceMetadata } from "@modelcontextprotocol/sdk/shared/auth.js";
import { checkResourceAllowed } from "@modelcontextprotocol/sdk/shared/auth-utils.js";
import { createRemoteJWKSet, jwtVerify } from "jose";

import {
	MCP_ROUTE,
	SCOPES_SUPPORTED,
	SERVICE_DOCUMENTATION_URL,
} from "./config";

// Reuse one remote JWKS resolver per URL so jose can keep its own fetch/cache
// state across token verifications instead of rebuilding it on every request.
const remoteJwksCache = new Map<
	string,
	ReturnType<typeof createRemoteJWKSet>
>();

export interface AuthEnv {
	HOST: string;
	SUMUP_AUTH_HOST: string;
}

export class SumUpOAuthTokenVerifier implements OAuthTokenVerifier {
	constructor(private readonly env: AuthEnv) {}

	verifyAccessToken(token: string): Promise<AuthInfo> {
		return verifyAccessToken(this.env, token);
	}
}

export function protectedResourceMetadata(
	env: AuthEnv,
): OAuthProtectedResourceMetadata {
	return {
		resource: new URL(MCP_ROUTE, env.HOST).toString(),
		authorization_servers: [canonicalAuthorizationServer(env)],
		bearer_methods_supported: ["header"],
		scopes_supported: SCOPES_SUPPORTED,
		resource_name: "SumUp MCP",
		resource_documentation: SERVICE_DOCUMENTATION_URL.toString(),
	};
}

/**
 * Verifies a JWT bearer access token against the configured issuer and JWKS.
 *
 * JWT validation is the only bearer validation mode supported by the worker.
 */
export async function verifyAccessToken(
	env: AuthEnv,
	token: string,
): Promise<AuthInfo> {
	const resourceUrl = new URL(MCP_ROUTE, env.HOST).toString();
	const issuer = canonicalAuthorizationServer(env);
	const payload = await defaultVerifyJwt(token, {
		issuer,
		audience: [resourceUrl],
		jwksUrl: new URL("/.well-known/jwks.json", issuer).toString(),
	});

	validateAudience(resourceUrl, payload);
	return buildAuthInfo(token, payload);
}

/**
 * Default JWT verifier backed by a remote JWKS endpoint.
 */
async function defaultVerifyJwt(
	token: string,
	options: {
		issuer: string;
		audience: string[];
		jwksUrl: string;
	},
): Promise<Record<string, unknown>> {
	const { payload } = await jwtVerify(token, remoteJwks(options.jwksUrl), {
		issuer: options.issuer,
		audience: options.audience,
	});
	return payload as Record<string, unknown>;
}

function remoteJwks(jwksUrl: string): ReturnType<typeof createRemoteJWKSet> {
	const cached = remoteJwksCache.get(jwksUrl);
	if (cached) {
		return cached;
	}

	const jwks = createRemoteJWKSet(new URL(jwksUrl));
	remoteJwksCache.set(jwksUrl, jwks);
	return jwks;
}

function canonicalAuthorizationServer(env: AuthEnv): string {
	return new URL("/", env.SUMUP_AUTH_HOST).toString();
}

function buildAuthInfo(
	token: string,
	claims: Record<string, unknown>,
): AuthInfo {
	const scopes = parseScopes(claims);
	const subject = stringClaim(claims, "sub");
	return {
		token,
		clientId:
			stringClaim(claims, "client_id") ??
			stringClaim(claims, "azp") ??
			subject ??
			"sumup-mcp",
		scopes,
		expiresAt: numberClaim(claims, "exp"),
		extra: subject ? { subject } : undefined,
	};
}

function parseScopes(claims: Record<string, unknown>): string[] {
	const scope = claims.scope;
	if (typeof scope === "string") {
		return scope.split(/\s+/).filter(Boolean);
	}

	const scopes = claims.scopes;
	if (Array.isArray(scopes)) {
		return scopes.filter((value): value is string => typeof value === "string");
	}

	const scp = claims.scp;
	if (Array.isArray(scp)) {
		return scp.filter((value): value is string => typeof value === "string");
	}

	return [];
}

function validateAudience(
	configuredResource: string,
	claims: Record<string, unknown>,
): void {
	const audiences = audienceClaims(claims);
	if (audiences.length === 0) {
		return;
	}

	const allowed = audiences.some((audience) =>
		checkResourceAllowed({
			requestedResource: audience,
			configuredResource,
		}),
	);

	if (!allowed) {
		throw new Error(
			"Access token audience does not match the protected resource",
		);
	}
}

function audienceClaims(claims: Record<string, unknown>): string[] {
	const aud = claims.aud;
	if (typeof aud === "string") {
		return [aud];
	}

	if (Array.isArray(aud)) {
		return aud.filter((value): value is string => typeof value === "string");
	}

	return [];
}

function stringClaim(
	claims: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = claims[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberClaim(
	claims: Record<string, unknown>,
	key: string,
): number | undefined {
	const value = claims[key];
	return typeof value === "number" ? value : undefined;
}
