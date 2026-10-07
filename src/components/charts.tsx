/** 轻量 SVG 图表（不引入大型图表库） */

interface Series {
  name: string;
  color: string;
  data: number[];
}

export function LineChart({
  labels,
  series,
  height = 190,
}: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const W = 720;
  const H = height;
  const padL = 34;
  const padB = 22;
  const padT = 10;
  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const n = labels.length;
  const x = (i: number) => padL + (i * (W - padL - 10)) / Math.max(1, n - 1);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);

  const gridLines = [0, 0.5, 1].map((f) => Math.round(max * f));

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} height={H} preserveAspectRatio="none">
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={W - 10} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={4} y={y(g) + 4} fontSize="10" fill="var(--text-3)">
              {g}
            </text>
          </g>
        ))}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          return (
            <g key={si}>
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
              {s.data.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={s.color}>
                  <title>{`${labels[i]} · ${s.name}: ${v}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {labels.map((l, i) =>
          i % Math.ceil(n / 10) === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 6} fontSize="10" fill="var(--text-3)" textAnchor="middle">
              {l.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name}>
            <span className="dot" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  labels,
  series,
  height = 190,
}: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const W = 720;
  const H = height;
  const padL = 34;
  const padB = 22;
  const padT = 10;
  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const n = labels.length;
  const groupW = (W - padL - 10) / Math.max(1, n);
  const barW = Math.max(3, (groupW * 0.6) / series.length);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} height={H} preserveAspectRatio="none">
        {[0, 0.5, 1].map((f) => {
          const g = Math.round(max * f);
          return (
            <g key={f}>
              <line x1={padL} x2={W - 10} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeDasharray="3 4" />
              <text x={4} y={y(g) + 4} fontSize="10" fill="var(--text-3)">
                {g}
              </text>
            </g>
          );
        })}
        {labels.map((l, i) => (
          <g key={i}>
            {series.map((s, si) => {
              const h = Math.max(0, y(0) - y(s.data[i] ?? 0));
              return (
                <rect
                  key={si}
                  x={padL + i * groupW + groupW * 0.2 + si * barW}
                  y={y(s.data[i] ?? 0)}
                  width={barW}
                  height={h}
                  rx="2"
                  fill={s.color}
                >
                  <title>{`${l} · ${s.name}: ${s.data[i] ?? 0}`}</title>
                </rect>
              );
            })}
            {i % Math.ceil(n / 12) === 0 || i === n - 1 ? (
              <text
                x={padL + i * groupW + groupW / 2}
                y={H - 6}
                fontSize="10"
                fill="var(--text-3)"
                textAnchor="middle"
              >
                {l.slice(5)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name}>
            <span className="dot" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
