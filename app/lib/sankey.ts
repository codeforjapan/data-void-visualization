import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import type { SankeyLink, SankeyNode } from "d3-sankey";

import { BUCKETS, NARRATIVES, type CitationLink } from "~/data/citations";
import type { Mode } from "~/lib/aggregate";

export const BAR_WIDTH = 13;
export const WIDTH = 1300;
export const LEFT_MARGIN = 250;
export const RIGHT_MARGIN = 270;

const TOP = 34;
const BOTTOM = 14;
const NODE_PADDING = 12;

/** d3-sankey に渡すノード。左列がナラティブ、右列が情報源種別 */
type NodeDatum = {
  column: "narrative" | "bucket";
  /** NARRATIVES / BUCKETS 内のインデックス。d3-sankey が `index` を上書きするので別名にする */
  item: number;
};

type LinkDatum = {
  source: number;
  target: number;
  value: number;
};

type LaidOutNode = SankeyNode<NodeDatum, LinkDatum>;
type LaidOutLink = SankeyLink<NodeDatum, LinkDatum>;

export type Ribbon = {
  key: string;
  narrative: number;
  bucket: number;
  /** sankeyLinkHorizontal が生成するパス */
  d: string;
  /** stroke-width に使うリボンの太さ */
  width: number;
  title: string;
};

export type NodeBox = {
  index: number;
  y: number;
  height: number;
};

export type SankeyLayout = {
  height: number;
  ribbons: Ribbon[];
  narrativeNodes: NodeBox[];
  bucketNodes: NodeBox[];
  bucketTotals: Record<number, number>;
  total: number;
};

/**
 * d3-sankey にレイアウトを任せる。並び順は入力順（ナラティブは ID 順、
 * 種別は BUCKETS の定義順）を保ちたいので nodeSort / linkSort は無効化する。
 */
export function layoutSankey(links: CitationLink[], mode: Mode): SankeyLayout {
  const usedN = [...new Set(links.map((l) => l.narrative))].sort((a, b) => a - b);
  const usedB = [...new Set(links.map((l) => l.bucket))].sort((a, b) => a - b);
  const height = Math.max(
    520,
    usedB.length * 46 + TOP + BOTTOM,
    usedN.length * 84 + TOP + BOTTOM,
  );
  const total = links.reduce((a, l) => a + l.count, 0);

  const nodes: NodeDatum[] = [
    ...usedN.map((item) => ({ column: "narrative" as const, item })),
    ...usedB.map((item) => ({ column: "bucket" as const, item })),
  ];
  const nodeAt = new Map(nodes.map((n, i) => [`${n.column}-${n.item}`, i]));

  // 左端はナラティブ順→種別順に積みたいので、この順で渡す（linkSort は無効）
  const ordered = [...links].sort(
    (a, b) => a.narrative - b.narrative || a.bucket - b.bucket,
  );
  const sankeyLinks: LinkDatum[] = ordered.map((l) => ({
    source: nodeAt.get(`narrative-${l.narrative}`)!,
    target: nodeAt.get(`bucket-${l.bucket}`)!,
    value: l.count,
  }));

  const generator = sankey<NodeDatum, LinkDatum>()
    .nodeWidth(BAR_WIDTH)
    .nodePadding(NODE_PADDING)
    .nodeSort(null)
    .linkSort(null)
    .extent([
      [LEFT_MARGIN, TOP],
      [WIDTH - RIGHT_MARGIN, height - BOTTOM],
    ]);
  const graph = generator({
    nodes: nodes.map((n) => ({ ...n })),
    links: sankeyLinks,
  });

  // d3-sankey はノード数の多い列に合わせて縮尺を決め、短い列を上詰めにする。
  // ここでは左右 5 件対 12 件で差が出るので、列ごとに縦中央へ寄せ直す。
  // ノードを動かしたあとの端点の再計算は generator.update に任せる。
  const bottom = height - BOTTOM;
  for (const column of ["narrative", "bucket"] as const) {
    const inColumn = (graph.nodes as LaidOutNode[]).filter((n) => n.column === column);
    const top = Math.min(...inColumn.map((n) => n.y0!));
    const end = Math.max(...inColumn.map((n) => n.y1!));
    const shift = (TOP + bottom - top - end) / 2;
    if (Math.abs(shift) < 0.01) continue;
    for (const n of inColumn) {
      n.y0! += shift;
      n.y1! += shift;
    }
  }
  generator.update(graph);

  const path = sankeyLinkHorizontal<NodeDatum, LinkDatum>();
  const bucketTotals: Record<number, number> = {};
  for (const { bucket, count } of links) {
    bucketTotals[bucket] = (bucketTotals[bucket] ?? 0) + count;
  }

  const box = (node: LaidOutNode): NodeBox => ({
    index: node.item,
    y: node.y0!,
    height: node.y1! - node.y0!,
  });

  const ribbons = (graph.links as LaidOutLink[]).map((link) => {
    const narrative = (link.source as LaidOutNode).item;
    const bucket = (link.target as LaidOutNode).item;
    const label =
      mode === "raw"
        ? `${Math.round(link.value)}件`
        : `${((link.value / total) * 100).toFixed(1)}%`;
    return {
      key: `${narrative}-${bucket}`,
      narrative,
      bucket,
      d: path(link) ?? "",
      width: Math.max(1, link.width ?? 0),
      title: `${NARRATIVES[narrative].short} → ${BUCKETS[bucket].label}：${label}`,
    };
  });

  const laidOut = graph.nodes as LaidOutNode[];
  return {
    height,
    ribbons,
    narrativeNodes: laidOut.filter((n) => n.column === "narrative").map(box),
    bucketNodes: laidOut.filter((n) => n.column === "bucket").map(box),
    bucketTotals,
    total,
  };
}
