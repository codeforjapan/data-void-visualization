import type { Route } from "./+types/api.measure";
import type { OriginPreset, Source, SourceKind } from "~/data/origin-flow";

const classified: [string[], string, SourceKind][] = [
  [["mofa.go.jp", "kantei.go.jp", "cas.go.jp", "mod.go.jp", "cao.go.jp", "moj.go.jp", "fdma.go.jp", "bousai.go.jp", "jma.go.jp"], "日本", "jp_government"],
  [["nhk.or.jp", "nikkei.com", "asahi.com", "mainichi.jp", "yomiuri.co.jp", "kyodonews.jp"], "日本", "jp_commercial_media"],
  [["xinhuanet.com", "people.com.cn", "cgtn.com", "globaltimes.cn"], "中国", "foreign_state_media"],
];

function classify(url: string, title?: string): Source | null {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const hit = classified.find(([domains]) => domains.some((item) => domain === item || domain.endsWith(`.${item}`)));
    return { name: title || domain, domain, country: hit?.[1] ?? "不明", kind: hit?.[2] ?? "unknown", confidence: hit ? "high" : "low", count: 1 };
  } catch { return null; }
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const { topic } = await request.json() as { topic?: string };
  if (!topic?.trim()) return Response.json({ error: "ナラティブを入力してください。" }, { status: 400 });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return Response.json({ error: "OPENROUTER_API_KEY が設定されていません。" }, { status: 500 });
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-OpenRouter-Title": "Origin Flow" },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
      messages: [{ role: "system", content: "日本語で簡潔に回答し、Web検索結果を根拠として使ってください。" }, { role: "user", content: topic.trim() }],
      plugins: [{ id: "web", engine: "exa", max_results: 5 }],
      max_tokens: 900,
    }),
  });
  const body = await response.json() as { error?: { message?: string }; model?: string; choices?: { message?: { content?: string; annotations?: { type?: string; url_citation?: { url?: string; title?: string } }[] } }[] };
  if (!response.ok) return Response.json({ error: body.error?.message ?? "OpenRouter の呼び出しに失敗しました。" }, { status: response.status });
  const message = body.choices?.[0]?.message;
  const unique = new Map<string, Source>();
  for (const annotation of message?.annotations ?? []) {
    if (annotation.type !== "url_citation" || !annotation.url_citation?.url) continue;
    const source = classify(annotation.url_citation.url, annotation.url_citation.title);
    if (source) unique.set(source.domain, source);
  }
  const preset: OriginPreset = { id: crypto.randomUUID(), topic: topic.trim(), model: body.model ?? process.env.OPENROUTER_MODEL ?? "OpenRouter", runAt: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }), query: topic.trim(), expected: [], sources: [...unique.values()] };
  return Response.json({ answer: message?.content ?? "", preset });
}
