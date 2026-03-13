import { CORS_HEADERS } from "./config";

export function protocolErrorResponse(
	status: number,
	message: string,
	headers?: HeadersInit,
): Response {
	return new Response(
		JSON.stringify({
			jsonrpc: "2.0",
			error: {
				code: -32010,
				message,
			},
			id: null,
		}),
		{
			status,
			headers: withCorsHeaders({
				"content-type": "application/json",
				...headers,
			}),
		},
	);
}

export function withCorsHeaders(
	headers: Record<string, string>,
): Record<string, string> {
	return {
		...CORS_HEADERS,
		...headers,
	};
}
