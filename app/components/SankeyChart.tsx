import { useMemo, useState } from "react";

import { BUCKETS, NARRATIVES, type CitationLink, type Run } from "~/data/citations";
import type { Mode } from "~/lib/aggregate";
import {
  BAR_WIDTH,
  LEFT_MARGIN,
  RIGHT_MARGIN,
  WIDTH,
  layoutSankey,
  type Ribbon,
} from "~/lib/sankey";

export function SankeyChart({
  links,
  run,
  mode,
}: {
  links: CitationLink[];
  run: Run;
  mode: Mode;
}) {
  const [hovered, setHovered] = useState<Ribbon | null>(null);
  const { height, ribbons, narrativeNodes, bucketNodes, bucketTotals, total } =
    useMemo(() => layoutSankey(links, mode), [links, mode]);

  const x0 = LEFT_MARGIN;
  const x1 = WIDTH - RIGHT_MARGIN;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label="ナラティブから情報源種別への引用フロー"
    >
      <text className="colhead" x={LEFT_MARGIN} y={18} textAnchor="end">
        ナラティブ
      </text>
      <text className="colhead" x={x1} y={18}>
        ChatGPTが引用した情報源
      </text>

      <g fill="none">
        {ribbons.map((ribbon) => (
          <path
            key={ribbon.key}
            className={
              hovered && hovered.narrative !== ribbon.narrative
                ? "ribbon dim"
                : "ribbon"
            }
            d={ribbon.d}
            stroke={`var(${BUCKETS[ribbon.bucket].colorVar})`}
            strokeWidth={ribbon.width}
            strokeOpacity={hovered?.key === ribbon.key ? 0.72 : 0.34}
            onMouseEnter={() => setHovered(ribbon)}
            onMouseLeave={() => setHovered(null)}
          >
            <title>{ribbon.title}</title>
          </path>
        ))}
      </g>

      {narrativeNodes.map((node) => {
        const cy = node.y + node.height / 2;
        const { id, short } = NARRATIVES[node.index];
        const { yes, no } = run.results[node.index];
        const cited = run.citations
          .filter((c) => c.narrative === node.index)
          .reduce((a, c) => a + c.count, 0);
        return (
          <g key={node.index}>
            <rect
              x={x0}
              y={node.y}
              width={BAR_WIDTH}
              height={Math.max(2, node.height)}
              fill="var(--ink)"
              opacity={0.72}
            />
            <text className="nid" x={x0 - 12} y={cy - 20} textAnchor="end">
              {id}
            </text>
            <text className="nlabel" x={x0 - 12} y={cy - 2} textAnchor="end">
              {short}
            </text>
            <text className="nsub" x={x0 - 12} y={cy + 16} textAnchor="end">
              {Math.round((yes / Math.max(1, yes + no)) * 100)}% が「はい」・引用 {cited}件
            </text>
          </g>
        );
      })}

      {bucketNodes.map((node) => {
        const cy = node.y + node.height / 2;
        const { label, sub, colorVar } = BUCKETS[node.index];
        return (
          <g key={node.index}>
            <rect
              x={x1 - BAR_WIDTH}
              y={node.y}
              width={BAR_WIDTH}
              height={Math.max(2, node.height)}
              fill={`var(${colorVar})`}
            />
            <text className="nlabel" x={x1 + 12} y={cy - 2}>
              {label}
            </text>
            <text className="nsub" x={x1 + 12} y={cy + 14}>
              {sub}
            </text>
            <text className="npct" x={WIDTH - 4} y={cy + 4} textAnchor="end">
              {((bucketTotals[node.index] / total) * 100).toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
