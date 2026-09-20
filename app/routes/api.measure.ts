import type { Route } from "./+types/api.measure";
import type { OriginPreset, Source, SourceKind } from "~/data/origin-flow";
import { SYSTEM_PROMPTS, detectLanguage } from "~/lib/language";

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

const kinds = new Set<SourceKind>(["jp_government", "jp_commercial_media", "foreign_state_media", "foreign_commercial_media", "other", "unknown"]);

async function classifyWithGemini(key: string, sources: Source[]) {
  const classifierModel = process.env.CLASSIFIER_MODEL ?? "google/gemini-2.5-flash";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-OpenRouter-Title": "Origin Flow" },
    body: JSON.stringify({
      model: classifierModel,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: "You classify the publisher of cited web sources. Return only JSON: {\"sources\":[{\"domain\":string,\"country\":string,\"kind\":\"jp_government|jp_commercial_media|foreign_state_media|foreign_commercial_media|other|unknown\",\"confidence\":\"high|low\"}]}. Use the organization behind the domain, not TLD. Use unknown when uncertain." }, { role: "user", content: JSON.stringify(sources.map(({ name, domain }) => ({ name, domain }))) }],
      max_tokens: 1200,
    }),
  });
  const body = await response.json() as { model?: string; choices?: { message?: { content?: string } }[] };
  if (!response.ok) throw new Error("Gemini classification failed");
  const content = body.choices?.[0]?.message?.content ?? "{}";
  const result = JSON.parse(content) as { sources?: { domain?: string; country?: string; kind?: string; confidence?: string }[] };
  const byDomain = new Map((result.sources ?? []).filter((item) => item.domain && item.country && kinds.has(item.kind as SourceKind)).map((item) => [item.domain!, item]));
  return { model: body.model ?? classifierModel, sources: sources.map((source) => { const item = byDomain.get(source.domain); return item ? { ...source, country: item.country!, kind: item.kind as SourceKind, confidence: item.confidence === "high" ? "high" as const : "low" as const } : source; }) };
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const { topic, model } = await request.json() as { topic?: string; model?: string };
  if (!topic?.trim()) return Response.json({ error: "ナラティブを入力してください。" }, { status: 400 });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return Response.json({ error: "OPENROUTER_API_KEY が設定されていません。" }, { status: 500 });
  const requestedModel = model?.trim() || process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
  const language = detectLanguage(topic);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-OpenRouter-Title": "Origin Flow" },
    body: JSON.stringify({
      model: requestedModel,
      messages: [{ role: "system", content: SYSTEM_PROMPTS[language] }, { role: "user", content: topic.trim() }],
      plugins: [{ id: "web", engine: "exa", max_results: 20 }],
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
  const extracted = [...unique.values()];
  let sources = extracted;
  let classifierModel: string | undefined;
  if (extracted.length) {
    try { const classifiedSources = await classifyWithGemini(key, extracted); sources = classifiedSources.sources; classifierModel = classifiedSources.model; }
    catch { /* The domain dictionary result is retained when the classifier is unavailable. */ }
  }
  const preset: OriginPreset = { id: crypto.randomUUID(), topic: topic.trim(), model: body.model ?? requestedModel, classifierModel, runAt: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }), query: topic.trim(), language, expected: [], sources };
  return Response.json({ answer: message?.content ?? "", preset });
}
