import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { MCP_ROUTE, PROTECTED_RESOURCE_WELL_KNOWN } from "./config";
import { protocolErrorResponse } from "./protocol";

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

export type AccessTokenValidationResult =
	| {
			authInfo: AuthInfo;
	  }
	| {
			response: Response;
	  };

/**
 * Extracts a bearer token from the request Authorization header.
 *
 * The worker accepts OAuth2 bearer access tokens encoded as JWTs.
 */
export function extractBearerToken(request: Request): string | undefined {
	const auth = request.headers.get("authorization");
	if (!auth) {
		return undefined;
	}

	const [scheme, token] = auth.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token?.length) {
		return undefined;
	}

	return token.trim();
}

/**
 * Builds the initial authentication challenge returned when no bearer token
 * was supplied with the MCP request.
 */
export function unauthorizedResponse(resourceMetadataUrl: string): Response {
	return authenticationRequiredResponse(resourceMetadataUrl);
}

function authenticationRequiredResponse(resourceMetadataUrl: string): Response {
	return protocolErrorResponse(401, "Authentication required", {
		"www-authenticate": `Bearer realm="mcp", resource_metadata="${resourceMetadataUrl}"`,
	});
}

/**
 * Validates bearer credentials for MCP transport requests.
 *
 * Access tokens are verified locally against the authorization server's JWKS.
 */
export async function validateAccessToken(
	env: AuthEnv,
	token: string,
	resourceMetadataUrl: string,
): Promise<AccessTokenValidationResult> {
	return validateJWTAccessToken(env, token, resourceMetadataUrl);
}

/**
 * Computes the protected resource metadata URL advertised in
 * `WWW-Authenticate` challenges.
 */
export function protectedResourceMetadataUrl(env: AuthEnv): string {
	return new URL(PROTECTED_RESOURCE_WELL_KNOWN, env.HOST).toString();
}

/**
 * Verifies a JWT bearer access token against the configured issuer and JWKS.
 *
 * JWT validation is the only bearer validation mode supported by the worker.
 */
async function validateJWTAccessToken(
	env: AuthEnv,
	token: string,
	resourceMetadataUrl: string,
): Promise<AccessTokenValidationResult> {
	try {
		const resourceUrl = resourceFromMetadataUrl(resourceMetadataUrl);
		const payload = await defaultVerifyJwt(token, {
			issuer: env.SUMUP_AUTH_HOST,
			audience: [resourceUrl, env.HOST],
			jwksUrl: new URL(
				"/.well-known/jwks.json",
				env.SUMUP_AUTH_HOST,
			).toString(),
		});
		return {
			authInfo: buildAuthInfo(token, new URL(resourceUrl), payload),
		};
	} catch {
		return {
			response: invalidAccessTokenResponse(
				defaultAuthenticateHeader(401, resourceMetadataUrl),
			),
		};
	}
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

/**
 * Returns a transport-level `401 invalid_token` response for failed bearer
 * validation.
 */
export function invalidAccessTokenResponse(wwwAuthenticate: string): Response {
	return protocolErrorResponse(401, "Invalid access token", {
		"www-authenticate": wwwAuthenticate,
	});
}

// Returns the fallback RFC 6750 challenge used for bearer token failures.
function defaultAuthenticateHeader(
	status: number,
	resourceMetadataUrl: string,
): string {
	if (status === 403) {
		return `Bearer realm="mcp", error="insufficient_scope", resource_metadata="${resourceMetadataUrl}"`;
	}

	return `Bearer realm="mcp", error="invalid_token", resource_metadata="${resourceMetadataUrl}"`;
}

// Reconstructs the protected resource URL from the advertised metadata URL.
function resourceFromMetadataUrl(resourceMetadataUrl: string): string {
	const resource = new URL(resourceMetadataUrl);
	resource.pathname = MCP_ROUTE;
	resource.search = "";
	resource.hash = "";
	return resource.toString();
}

function buildAuthInfo(
	token: string,
	resource: URL,
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
		resource,
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
