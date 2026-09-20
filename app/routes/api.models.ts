import type { Route } from "./+types/api.models";

type OpenRouterModel = { id?: string; name?: string };
type CachedModels = { expiresAt: number; models: { id: string; name: string }[] };

let cache: CachedModels | undefined;

export async function loader(_: Route.LoaderArgs) {
  if (cache && cache.expiresAt > Date.now()) return Response.json({ models: cache.models });

  const response = await fetch("https://openrouter.ai/api/v1/models");
  if (!response.ok) return Response.json({ error: "モデル一覧を取得できませんでした。" }, { status: 502 });

  const body = await response.json() as { data?: OpenRouterModel[] };
  const models = (body.data ?? [])
    .filter((model): model is Required<OpenRouterModel> => Boolean(model.id && model.name))
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  cache = { models, expiresAt: Date.now() + 5 * 60 * 1000 };
  return Response.json({ models });
}
