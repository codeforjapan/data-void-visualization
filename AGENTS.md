# AGENTS.md

AI の回答がどの国のドキュメントを参照しているかを可視化し、情報の空白地帯（data void）を
明らかにするプロジェクト。背景と目的は [README.md](./README.md) を参照。

## 技術スタック

- React Router v7（Framework モード、SSR 有効）+ Vite + TypeScript
- パッケージマネージャは **pnpm**（npm / yarn は使わない）
- CSS フレームワークは入れていない。`app/app.css` のプレーン CSS + CSS カスタムプロパティのみ
- Sankey のレイアウトは **d3-sankey**。描画（SVG 要素の組み立て）は自前の JSX で、
  d3 に DOM を触らせない

## コマンド

```bash
pnpm install
pnpm dev        # 開発サーバー
pnpm typecheck  # react-router typegen && tsc
pnpm build      # 本番ビルド
pnpm start      # ビルド成果物を配信
```

変更後は最低限 `pnpm typecheck` を通すこと。

## ディレクトリ

```
app/
  root.tsx              # HTML シェル・フォント読み込み・ErrorBoundary
  routes.ts             # ルート定義
  routes/home.tsx       # 可視化ページ本体（タブ・統計・注記）
  components/
    SankeyChart.tsx     # SVG の描画のみ。レイアウト計算は持たない
  lib/
    aggregate.ts        # 集計（raw / norm モード、統計値、シェア計算）
    sankey.ts           # d3-sankey を呼ぶレイアウト計算（純関数）
  data/
    citations.ts        # データセット本体と型
  app.css               # 全体スタイル
sample_index.html       # 移植元の単一 HTML。React 版の参照実装
```

## 設計上の約束

- **レイアウト計算と描画を分ける。** `lib/sankey.ts` の `layoutSankey()` は DOM に触らない純関数で、
  `SankeyChart.tsx` はその結果を JSX にするだけ。テスト・検証がしやすいのでこの分離は崩さない。
- **d3 は計算だけに使う。** `d3-sankey` からはレイアウトと `sankeyLinkHorizontal` のパス生成だけを
  受け取る。`d3-selection` は入れない（DOM は React が持つ）。
- **`innerHTML` や直接の DOM 操作を使わない。** SVG はすべて JSX で組み、ホバーなどの状態は
  React の state で持つ。
- **色は CSS カスタムプロパティ経由。** `BUCKETS[].colorVar` に変数名を持たせ、`fill="var(--xx)"`
  で参照する。ライト／ダークは `app.css` の `:root` 側で切り替わるので、コンポーネントに
  色のリテラルを書かない。
- **データは `app/data/citations.ts` に閉じ込める。** 元データは `[n, b, count]` のような密な配列だが、
  モジュール内で名前付きオブジェクトに変換してからエクスポートする。利用側は密な配列を見ない。
- **`sample_index.html` は消さない。** 配色・ラベル体裁・注記の文言の基準として残している。
  ただしレイアウトは d3-sankey に移した時点で意図的に変えてあるので、以下は一致しない。
  - 元は左右の列で別々の縦スケールを使い、リボンの太さが左右で変わっていた。
    d3-sankey は流量保存なので太さは一定。
  - 元は両列とも縦一杯に伸びていた。現在はノード数の多い列（種別）が基準で、
    短い列は `generator.update()` で縦中央に寄せている。

### d3-sankey の使い方で踏んだ注意点

- ノードに `index` という名前のフィールドを持たせない。d3-sankey が配列内の位置で上書きする。
  `NodeDatum.item` に逃がしてある。
- 並び順は `nodeSort(null)` / `linkSort(null)` で入力順を保つ。これを外すと交差を減らすために
  ナラティブと種別が勝手に並び替わる。
- ノードを動かしたらリボンの端点は `generator.update(graph)` に再計算させる。手で直さない。

## データについて

`app/data/citations.ts` の数値は CfJ llm-analysis 由来のスナップショット（CN-2604-005〜009、
モデルは ChatGPT のみ、6 回の実行）。現状はハードコードで、API からは取得していない。

集計モードは 2 つある。

- `raw` — 引用の実数。引用数の多い設問が全体像を支配する
- `norm` — ナラティブごとの合計を揃える（`1000 / ナラティブ数` に正規化）

バケット 11（不明・その他）は「分類の失敗」であって情報源の不在ではない。ここが厚い設問ほど
図から読める結論は弱くなる、という注記を UI から外さないこと。
