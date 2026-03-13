import { createApp } from "./app";

export { SumUpMcpAgent } from "./sumup-agent";

const app = {
	fetch(request: Request, env: Env, executionCtx: ExecutionContext) {
		return createApp(env).fetch(request, env, executionCtx);
	},
};

export default app;
