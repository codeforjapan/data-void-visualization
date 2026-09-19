import { useMemo, useState } from "react";

import { SankeyChart } from "~/components/SankeyChart";
import { NARRATIVES, RUNS } from "~/data/citations";
import { runStats, shareSummary, weighted, type Mode } from "~/lib/aggregate";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "ChatGPTは何を根拠にしたか — CN-2604-005〜009" },
    {
      name: "description",
      content:
        "対日ナラティブ5件について、ChatGPT が回答の出典として挙げた引用先を発信元の国と種別で分類した。",
    },
  ];
}

export default function Home() {
  const [current, setCurrent] = useState(RUNS.length - 1);
  const [mode, setMode] = useState<Mode>("raw");

  const run = RUNS[current];
  const links = useMemo(() => weighted(run, mode), [run, mode]);
  const stats = useMemo(() => runStats(run), [run]);
  const { share, worst } = useMemo(() => shareSummary(links), [links]);

  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">
          CN-2604-005〜009 ／ china_disinfo ／ モデル: ChatGPT (openai) のみ
        </p>
        <h1>ChatGPTは何を根拠にしたか</h1>
        <p className="lede">
          対日ナラティブ5件について、<b>ChatGPT が回答の出典として挙げた引用先</b>
          を発信元の国と種別で分類した。タブは実行日時。
        </p>
      </header>

      <div className="tabs" role="tablist" aria-label="実行日時">
        {RUNS.map((r, i) => (
          <button
            key={r.date}
            type="button"
            className="tab"
            role="tab"
            aria-selected={i === current}
            onClick={() => setCurrent(i)}
          >
            <span className="d">{r.date.slice(5).replace("-", "/")}</span>
            <span className="s">{r.label}</span>
          </button>
        ))}
      </div>

      <div className="bar">
        <div className="stat">
          <div className="v">{stats.citations.toLocaleString()}</div>
          <div className="k">引用件数</div>
        </div>
        <div className="stat">
          <div className="v">{stats.responses}</div>
          <div className="k">回答数</div>
        </div>
        <div className="stat">
          <div className="v">{stats.perResponse.toFixed(1)}</div>
          <div className="k">1回答あたり引用数</div>
        </div>
        <div className="stat">
          <div className="v">{stats.yesRate}%</div>
          <div className="k">5件平均の「はい」率</div>
        </div>
        <div className="modes" role="group" aria-label="集計方法">
          <button
            type="button"
            aria-pressed={mode === "raw"}
            onClick={() => setMode("raw")}
          >
            引用の実数
          </button>
          <button
            type="button"
            aria-pressed={mode === "norm"}
            onClick={() => setMode("norm")}
          >
            ナラティブ均等化
          </button>
        </div>
      </div>

      <div className="chartbox">
        <SankeyChart links={links} run={run} mode={mode} />
      </div>

      <div className="note">
        <p>
          <b>日本発の情報源（公式＋メディア）は全体の {(share(0) + share(1)).toFixed(1)}%。</b>
          中国発が {(share(4) + share(5)).toFixed(1)}%、米国発が{" "}
          {(share(2) + share(3)).toFixed(1)}%、分類できなかった引用が {share(11).toFixed(1)}%。
          5件のうち日本発比率が最も低いのは{" "}
          <b>
            {NARRATIVES[worst.narrative].short}（{worst.japanShare.toFixed(1)}%）
          </b>
          。
        </p>
        <p>
          ナラティブごとに引用の総数が違うので、実数のままだと引用の多い設問が全体像を支配する。
          <b>「ナラティブ均等化」で5件の寄与を揃えた比率と見比べる</b>こと。
        </p>
        <p>
          国・種別は domain_master の手動分類が一次、当たらなかったものは URL からの自動判定。
          <b>「不明・その他」は判定の失敗であって、情報源が存在しないという意味ではない。</b>
          ここが厚い設問ほど、この図から読める結論は弱くなる。
        </p>
      </div>

      <footer>
        ChatGPT (openai) のみ ／ 実行 {run.date}（{run.label}）／ 回答 {stats.responses}件・引用{" "}
        {stats.citations}件 ／ 出典: CfJ llm-analysis
      </footer>
    </div>
  );
}
