import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [index("routes/home.tsx"), route("origin-flow", "routes/origin-flow.tsx"), route("api/measure", "routes/api.measure.ts"), route("api/models", "routes/api.models.ts")] satisfies RouteConfig;
