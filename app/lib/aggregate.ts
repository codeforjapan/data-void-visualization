import { type CitationLink, type Run } from "~/data/citations";

/** raw = 引用の実数 / norm = ナラティブごとの寄与を揃える */
export type Mode = "raw" | "norm";

/**
 * norm では、ナラティブごとの引用合計を 1000/ナラティブ数 に正規化する。
 * 引用数の多い設問が全体像を支配しないようにするため。
 */
export function weighted(run: Run, mode: Mode): CitationLink[] {
  if (mode === "raw") return run.citations.map((c) => ({ ...c }));

  const totals: Record<number, number> = {};
  for (const { narrative, count } of run.citations) {
    totals[narrative] = (totals[narrative] ?? 0) + count;
  }
  const narrativeCount = Object.keys(totals).length;
  return run.citations.map(({ narrative, bucket, count }) => ({
    narrative,
    bucket,
    count: (count / totals[narrative]) * (1000 / narrativeCount),
  }));
}

export type RunStats = {
  /** 引用件数（実数） */
  citations: number;
  /** 回答数 */
  responses: number;
  /** 1回答あたり引用数 */
  perResponse: number;
  /** 5件平均の「はい」率（%） */
  yesRate: number;
};

export function runStats(run: Run): RunStats {
  const citations = run.citations.reduce((a, c) => a + c.count, 0);
  const responses = run.results.reduce((a, r) => a + r.responses, 0);
  const yesRates = run.results.map((r) => r.yes / Math.max(1, r.yes + r.no));
  return {
    citations,
    responses,
    perResponse: citations / responses,
    yesRate: Math.round((yesRates.reduce((a, b) => a + b, 0) / yesRates.length) * 100),
  };
}

export type ShareSummary = {
  /** バケット index → 全体に占める割合(%) */
  share: (bucket: number) => number;
  /** 日本発（公式＋メディア）比率が最も低いナラティブ */
  worst: { narrative: number; japanShare: number };
};

export function shareSummary(links: CitationLink[]): ShareSummary {
  const total = links.reduce((a, l) => a + l.count, 0);
  const bucketTotals: Record<number, number> = {};
  for (const { bucket, count } of links) {
    bucketTotals[bucket] = (bucketTotals[bucket] ?? 0) + count;
  }

  const perNarrative = [...new Set(links.map((l) => l.narrative))]
    .sort((a, b) => a - b)
    .map((narrative) => {
      const ls = links.filter((l) => l.narrative === narrative);
      const t = ls.reduce((a, l) => a + l.count, 0);
      const jp = ls
        .filter((l) => l.bucket === 0 || l.bucket === 1)
        .reduce((a, l) => a + l.count, 0);
      return { narrative, japanShare: (jp / t) * 100 };
    });

  return {
    share: (bucket) => ((bucketTotals[bucket] ?? 0) / total) * 100,
    worst: [...perNarrative].sort((a, b) => a.japanShare - b.japanShare)[0],
  };
}
