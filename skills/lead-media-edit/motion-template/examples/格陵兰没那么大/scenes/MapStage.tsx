import React, { useMemo } from "react";
import * as d3 from "d3-geo";
import { E, clamp, env, invLerp, lerp, ramp } from "../engine/ease";
import { C } from "../engine/theme";
import { NUM, SANS, SERIF } from "../engine/fonts";
import {
  AFRICA,
  GL_C,
  GREENLAND,
  RUSSIA,
  RU_C,
  africaSpots,
  areaFactor,
  borders,
  graticule,
  land,
  makeProj,
  mercY,
  movedProjection,
  type Cam,
} from "./geo";

// ───────────────────────── 摄像机 ─────────────────────────
const CAM = {
  hook0: { k: 0.66, lon: -12, lat: 36, x: 900, y: 560 },
  hook: { k: 0.75, lon: -10, lat: 35, x: 900, y: 560 },
  hookAf: { k: 1.05, lon: 16, lat: 9, x: 980, y: 480 },
  flat: { k: 0.5, lon: 0, lat: 0, x: 900, y: 470 },
  title: { k: 0.6, lon: -22, lat: 16, x: 1040, y: 560 },
  rhumb: { k: 1.7, lon: -42, lat: 30, x: 1010, y: 480 },
  tissot: { k: 0.56, lon: 0, lat: 16, x: 900, y: 540 },
  drag: { k: 0.75, lon: -38, lat: 45, x: 900, y: 470 },
  lat60: { k: 0.78, lon: -2, lat: 42, x: 1000, y: 560 },
  russia: { k: 0.6, lon: 52, lat: 36, x: 980, y: 500 },
  russiaAf: { k: 0.78, lon: 38, lat: 22, x: 1020, y: 520 },
  takeaway: { k: 0.5, lon: 10, lat: 22, x: 960, y: 600 },
} satisfies Record<string, Cam>;

const CAM_KEYS: [number, Cam][] = [
  [0, CAM.hook0],
  [0.4, CAM.hook0],
  [3.1, CAM.hook],
  [3.3, CAM.hook],
  [4.25, CAM.hookAf],
  [5.8, CAM.hookAf],
  [8.0, CAM.flat],
  [14.5, CAM.flat],
  [18.7, CAM.title],
  [19.15, CAM.title],
  [20.1, CAM.rhumb],
  [23.35, CAM.rhumb],
  [24.2, CAM.tissot],
  [25.95, CAM.tissot],
  [26.55, CAM.drag],
  [29.95, CAM.drag],
  [30.6, CAM.lat60],
  [35.3, CAM.lat60],
  [35.95, CAM.russia],
  [38.4, CAM.russia],
  [39.1, CAM.russiaAf],
  [41.85, CAM.russiaAf],
  [43.25, CAM.takeaway],
];

export const camAt = (t: number): Cam => {
  if (t <= CAM_KEYS[0][0]) return CAM_KEYS[0][1];
  for (let i = 0; i < CAM_KEYS.length - 1; i++) {
    const [t0, a] = CAM_KEYS[i];
    const [t1, b] = CAM_KEYS[i + 1];
    if (t <= t1) {
      const u = E.inOutQuint(invLerp(t0, t1, t));
      return {
        k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), u)),
        lon: lerp(a.lon, b.lon, u),
        lat: lerp(a.lat, b.lat, u),
        x: lerp(a.x, b.x, u),
        y: lerp(a.y, b.y, u),
      };
    }
  }
  return CAM_KEYS[CAM_KEYS.length - 1][1];
};

// 地图可见区间（其余时间被人物全屏或三维地球覆盖）
export const mapOpacity = (t: number) =>
  Math.max(env(t, 0.3, 0.85, 5.7, 5.9), env(t, 14.05, 14.45, 42.65, 42.85), env(t, 43.35, 43.75, 46.55, 46.75));

// ───────────────────────── 通用小组件 ─────────────────────────
const Chip: React.FC<{
  x: number;
  y: number;
  a: number;
  color: string;
  children: React.ReactNode;
  side?: "left" | "right";
  size?: number;
  lead?: number;
}> = ({ x, y, a, color, children, side = "right", size = 30, lead = 54 }) => {
  if (a <= 0.001) return null;
  const dir = side === "right" ? 1 : -1;
  const L = lead * E.outCubic(clamp(a * 1.6));
  return (
    <>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <circle cx={x} cy={y} r={6 * a} fill={color} />
        <circle cx={x} cy={y} r={6 + 16 * a} fill="none" stroke={color} strokeOpacity={0.5 * (1 - a) + 0.15} />
        <line x1={x} y1={y} x2={x + dir * L} y2={y - L * 0.55} stroke={color} strokeWidth={2} opacity={a} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x + dir * (L + 8),
          top: y - L * 0.55,
          transform: `translate(${side === "right" ? 0 : -100}%, -50%) translateY(${(1 - a) * 14}px)`,
          opacity: a,
          fontFamily: SANS,
          fontWeight: 600,
          fontSize: size,
          color: C.paper,
          padding: "6px 16px 8px",
          borderRadius: 8,
          background: "rgba(8,19,31,0.72)",
          border: `1.5px solid ${color}`,
          whiteSpace: "nowrap",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        {children}
      </div>
    </>
  );
};

/** 遮罩上推的文字揭示 */
const Reveal: React.FC<{ a: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  a,
  children,
  style,
}) => (
  <div style={{ overflow: "hidden", paddingBottom: "0.12em", ...style }}>
    <div style={{ transform: `translateY(${(1 - E.outQuart(clamp(a))) * 112}%)`, opacity: clamp(a * 3) }}>{children}</div>
  </div>
);

const Panel: React.FC<{ a: number; x: number; y: number; w: number; children: React.ReactNode }> = ({
  a,
  x,
  y,
  w,
  children,
}) =>
  a <= 0.001 ? null : (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        opacity: clamp(a * 1.5),
        transform: `translateX(${(1 - E.outCubic(a)) * -40}px)`,
        padding: "26px 32px 30px",
        borderRadius: 18,
        background: "linear-gradient(160deg, rgba(14,34,54,0.86), rgba(6,15,25,0.86))",
        border: "1px solid rgba(236,227,207,0.16)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        color: C.paper,
      }}
    >
      {children}
    </div>
  );

const Kicker: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = C.muted }) => (
  <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 24, letterSpacing: "0.18em", color }}>{children}</div>
);

// ───────────────────────── 图形组件 ─────────────────────────
const Cursor: React.FC<{ x: number; y: number; a: number; grab: number }> = ({ x, y, a, grab }) =>
  a <= 0 ? null : (
    <g transform={`translate(${x} ${y}) scale(${1.25 - 0.18 * grab})`} opacity={a}>
      <circle r={26 + 30 * grab} fill="none" stroke={C.paper} strokeOpacity={0.5 * (1 - grab) * grab * 4} strokeWidth={2} />
      <path
        d="M0,0 L0,30 L8,22.5 L13.5,34 L18.5,31.8 L13.2,20.6 L23.5,20.6 Z"
        fill={C.paper}
        stroke={C.ink}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </g>
  );

const Compass: React.FC<{ x: number; y: number; r: number; a: number; heading: number; spin: number }> = ({
  x,
  y,
  r,
  a,
  heading,
  spin,
}) => {
  if (a <= 0) return null;
  const ticks = [];
  for (let i = 0; i < 72; i++) {
    const ang = (i * 5 * Math.PI) / 180;
    const long = i % 18 === 0 ? 18 : i % 2 === 0 ? 10 : 5;
    ticks.push(
      <line
        key={i}
        x1={Math.sin(ang) * (r - long)}
        y1={-Math.cos(ang) * (r - long)}
        x2={Math.sin(ang) * r}
        y2={-Math.cos(ang) * r}
        stroke={C.paper}
        strokeOpacity={i % 18 === 0 ? 0.95 : 0.45}
        strokeWidth={i % 18 === 0 ? 2.5 : 1.2}
      />,
    );
  }
  const star = (len: number, w: number, rot: number, fill: string) => (
    <path
      d={`M0,${-len} L${w},0 L0,${len} L${-w},0 Z`}
      transform={`rotate(${rot})`}
      fill={fill}
      opacity={0.9}
    />
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${0.7 + 0.3 * E.outBack(a)})`} opacity={clamp(a * 1.4)}>
      <circle r={r + 16} fill="rgba(6,15,25,0.78)" stroke="rgba(236,227,207,0.18)" />
      <circle r={r} fill="none" stroke={C.paper} strokeOpacity={0.5} />
      <circle r={r * 0.62} fill="none" stroke={C.paper} strokeOpacity={0.2} strokeDasharray="3 6" />
      <g transform={`rotate(${spin})`}>
        {ticks}
        {star(r * 0.78, r * 0.08, 45, "rgba(236,227,207,0.25)")}
        {star(r * 0.78, r * 0.08, -45, "rgba(236,227,207,0.25)")}
        {star(r * 0.9, r * 0.11, 0, "rgba(236,227,207,0.5)")}
        {star(r * 0.9, r * 0.11, 90, "rgba(236,227,207,0.5)")}
        {["N", "E", "S", "W"].map((s, i) => (
          <text
            key={s}
            x={Math.sin((i * Math.PI) / 2) * (r - 36)}
            y={-Math.cos((i * Math.PI) / 2) * (r - 36) + 9}
            textAnchor="middle"
            fontFamily={NUM}
            fontWeight={600}
            fontSize={26}
            fill={s === "N" ? C.coral : C.paper}
          >
            {s}
          </text>
        ))}
      </g>
      {/* 航向指针 */}
      <g transform={`rotate(${heading})`}>
        <path d={`M0,${-r * 0.86} L${r * 0.07},0 L0,${r * 0.14} L${-r * 0.07},0 Z`} fill={C.amber} />
        <path d={`M0,${-r * 0.86} L${r * 0.07},0 L0,0 Z`} fill="#c9861c" />
      </g>
      <circle r={7} fill={C.paper} />
    </g>
  );
};

const Ship: React.FC<{ x: number; y: number; ang: number; s: number; a: number }> = ({ x, y, ang, s, a }) =>
  a <= 0 ? null : (
    <g transform={`translate(${x} ${y}) rotate(${ang}) scale(${s})`} opacity={a}>
      <path d="M-26,6 L26,6 L18,16 L-18,16 Z" fill={C.paper} />
      <path d="M-2,4 L-2,-34 L22,2 Z" fill={C.amber} />
      <path d="M-6,4 L-6,-26 L-24,2 Z" fill={C.paper} opacity={0.85} />
    </g>
  );

// ───────────────────────── 主舞台 ─────────────────────────
export const MapStage: React.FC<{ t: number }> = ({ t }) => {
  const op = mapOpacity(t);
  const spots = useMemo(() => africaSpots(14), []);
  if (op <= 0.001) return null;

  const cam = camAt(t);
  const proj = makeProj(cam);
  const path = d3.geoPath(proj);
  const P = (ll: [number, number]) => proj(ll) as [number, number];

  // 场景内的局部进度
  const hook = env(t, 0.3, 0.6, 5.6, 5.9, E.linear);
  const glA = ramp(t, 0.55, 1.0);
  const afA = ramp(t, 1.45, 1.9);
  const flyM = ramp(t, 3.3, 4.15, E.inOutCubic);
  const copiesShown = t < 4.15 ? 0 : Math.min(14, 1 + Math.floor((t - 4.15) / 0.034));
  const hookFade = 1 - ramp(t, 5.5, 5.9);

  const titleA = env(t, 15.75, 16.4, 18.95, 19.4);
  const yearA = env(t, 17.1, 17.6, 18.95, 19.4);

  // 恒向线：里斯本 → 哈瓦那
  const LIS: [number, number] = [-9.14, 38.72];
  const HAV: [number, number] = [-82.38, 23.13];
  const rhumbA = env(t, 19.3, 19.8, 23.4, 23.9);
  const drawU = ramp(t, 20.2, 21.85, E.inOutCubic);
  const shipU = ramp(t, 22.0, 23.35, E.inOutCubic);
  const pL = P(LIS);
  const pH = P(HAV);
  const heading = (() => {
    const dPsi = mercY(HAV[1]) - mercY(LIS[1]);
    const dLam = ((HAV[0] - LIS[0]) * Math.PI) / 180;
    return (Math.atan2(dLam, dPsi) * 180) / Math.PI;
  })(); // ≈ -104°，即 256°
  const lineAng = (Math.atan2(pH[1] - pL[1], pH[0] - pL[0]) * 180) / Math.PI;

  // Tissot 变形圈
  const tisA = env(t, 23.45, 23.9, 25.6, 26.0);
  const tisGrow = ramp(t, 25.25, 26.0, (x) => E.outBack(x, 1.4));

  // 拖动格陵兰
  const dragA = env(t, 25.85, 26.25, 30.05, 30.5);
  const dragU = ramp(t, 27.1, 28.7, E.inOutCubic);
  const dragLat = lerp(GL_C[1], 1.5, dragU);
  const dragDst: [number, number] = [GL_C[0], dragLat];
  const grabbed = t >= 26.62 && t < 28.85 ? 1 : 0;
  const smallPulse = env(t, 29.6, 29.85, 29.9, 30.4);

  // 60° 方块
  const latA = env(t, 30.2, 30.7, 35.25, 35.6);
  const sqs: { c: [number, number]; at: number; grow: [number, number]; label: string; f: number }[] = [
    { c: [-30, 0], at: 31.45, grow: [31.45, 31.9], label: "×1", f: 1 },
    { c: [-30, 60], at: 31.9, grow: [32.45, 33.1], label: "×4", f: 4 },
    { c: [-5, 70], at: 33.75, grow: [33.85, 34.45], label: "×8.5", f: 8.5 },
    { c: [22, 75], at: 34.3, grow: [34.4, 35.0], label: "×15", f: 14.9 },
  ];

  // 俄罗斯
  const ruA = env(t, 35.5, 35.9, 41.65, 42.05);
  const ruHL = ramp(t, 35.7, 36.1);
  const afHL2 = ramp(t, 37.45, 37.85);
  const ruMove = ramp(t, 38.5, 39.4, E.inOutCubic);
  const RU_DST: [number, number] = [16, 2];
  const ruDst: [number, number] = [lerp(RU_C[0], RU_DST[0], ruMove), lerp(RU_C[1], RU_DST[1], ruMove)];

  // 结论
  const tkA = env(t, 43.45, 43.85, 46.15, 46.55);

  // 底图水平无缝平铺（左右各复制一份世界），避免露出地图边缘
  const worldW = 2 * Math.PI * 270 * cam.k;
  const dGrat = path(graticule) || "";
  const dLand = path(land) || "";
  const dBord = path(borders) || "";
  const landFill = (dim: number) =>
    [-1, 0, 1].map((k) => (
      <g key={k} transform={`translate(${k * worldW} 0)`}>
        <path d={dGrat} fill="none" stroke={C.grid} strokeWidth={1} />
        <path d={dLand} fill={C.land} opacity={dim} />
        <path d={dBord} fill="none" stroke={C.ink} strokeOpacity={0.55 * dim} strokeWidth={0.8} />
        <path d={dLand} fill="none" stroke={C.landEdge} strokeWidth={1.1} opacity={dim} />
      </g>
    ));

  const glScreen = P(GL_C);
  const afScreen = P([20, 8]);
  const ruScreen = P(RU_C);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: op }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="polar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.coral} stopOpacity="0.38" />
            <stop offset="1" stopColor={C.coral} stopOpacity="0" />
          </linearGradient>
        </defs>
        {landFill(t > 43.25 ? 0.75 : 1)}

        {/* ── 开场：格陵兰 vs 非洲，14 个格陵兰 ── */}
        {hook > 0 && (
          <g opacity={hookFade}>
            <path
              d={path(AFRICA) || ""}
              fill={C.coral}
              fillOpacity={0.62 * afA * (1 - 0.45 * ramp(t, 4.1, 4.5))}
              stroke={C.coral}
              strokeWidth={2}
              strokeOpacity={afA}
              filter="url(#glow)"
            />
            <path
              d={path(GREENLAND) || ""}
              fill={C.amber}
              fillOpacity={0.85 * glA * (1 - 0.7 * flyM)}
              stroke={C.amber}
              strokeWidth={2}
              strokeDasharray={flyM > 0 ? "6 6" : undefined}
              strokeOpacity={glA}
              filter="url(#glow)"
            />
            {flyM > 0 &&
              spots.slice(0, Math.max(1, copiesShown)).map((dst, i) => {
                const target = i === 0 ? ([lerp(GL_C[0], dst[0], flyM), lerp(GL_C[1], dst[1], flyM)] as [number, number]) : dst;
                const appear = i === 0 ? 1 : E.outBack(clamp((t - (4.15 + i * 0.034)) / 0.22));
                const c = P(target);
                const g = d3.geoPath(movedProjection(proj, GL_C, target));
                return (
                  <g key={i} transform={`translate(${c[0]} ${c[1]}) scale(${appear}) translate(${-c[0]} ${-c[1]})`}>
                    <path
                      d={g(GREENLAND) || ""}
                      fill={C.teal}
                      fillOpacity={0.85}
                      stroke="#e8fffb"
                      strokeWidth={1.2}
                    />
                  </g>
                );
              })}
          </g>
        )}

        {/* ── 墨卡托：恒向线 ── */}
        {rhumbA > 0 && (
          <g opacity={rhumbA}>
            {[-20, -35, -50, -65].map((lon, i) => {
              const a = env(t, 21.0 + i * 0.22, 21.35 + i * 0.22, 23.4, 23.8);
              const u = (lon - LIS[0]) / (HAV[0] - LIS[0]);
              const px = lerp(pL[0], pH[0], u);
              const py = lerp(pL[1], pH[1], u);
              const top = P([lon, 50]);
              const bot = P([lon, 12]);
              const R = 34;
              // 经线（竖直向上）与航线的夹角弧
              const a0 = -90;
              const a1 = lineAng + 180;
              const arc = (deg: number) => [px + R * Math.cos((deg * Math.PI) / 180), py + R * Math.sin((deg * Math.PI) / 180)];
              const [sx, sy] = arc(a0);
              const [ex, ey] = arc(a0 + (a1 - a0) * a);
              return (
                <g key={lon} opacity={a > 0 ? 1 : 0}>
                  <line x1={top[0]} y1={top[1]} x2={bot[0]} y2={bot[1]} stroke={C.paper} strokeOpacity={0.28 * a} strokeWidth={1.5} />
                  {drawU > u && (
                    <path
                      d={`M${px},${py} L${sx},${sy} A${R},${R} 0 0 0 ${ex},${ey} Z`}
                      fill={C.amber}
                      fillOpacity={0.35 * a}
                      stroke={C.amber}
                      strokeWidth={2}
                      strokeOpacity={a}
                    />
                  )}
                </g>
              );
            })}
            <line
              x1={pL[0]}
              y1={pL[1]}
              x2={lerp(pL[0], pH[0], drawU)}
              y2={lerp(pL[1], pH[1], drawU)}
              stroke={C.amber}
              strokeWidth={4}
              strokeLinecap="round"
              filter="url(#glow)"
            />
            <circle cx={pL[0]} cy={pL[1]} r={8} fill={C.paper} />
            <circle cx={pH[0]} cy={pH[1]} r={8} fill={C.paper} opacity={ramp(t, 21.6, 21.9)} />
            {drawU > 0 && drawU < 1 && (
              <circle cx={lerp(pL[0], pH[0], drawU)} cy={lerp(pL[1], pH[1], drawU)} r={10} fill={C.amber} filter="url(#glow)" />
            )}
            <Ship
              x={lerp(pL[0], pH[0], shipU)}
              y={lerp(pL[1], pH[1], shipU) - 14}
              ang={0}
              s={1.15}
              a={env(t, 21.95, 22.2, 23.3, 23.6)}
            />
          </g>
        )}

        {/* ── Tissot 变形圈 ── */}
        {tisA > 0 && (
          <g>
            {[-60, -40, -20, 0, 20, 40, 60, 75].map((lat) =>
              [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => {
                const appear = E.outBack(clamp((t - (23.5 + (Math.abs(lat) / 75) * 1.2 + (lon + 150) * 0.0006)) / 0.3));
                if (appear <= 0) return null;
                const f = Math.sqrt(areaFactor(lat));
                const sc = lerp(1 / f, 1, tisGrow) * appear;
                const c = P([lon, lat]);
                const col = lat === 0 ? C.teal : Math.abs(lat) >= 60 ? C.coral : C.amber;
                const circ = d3.geoCircle().center([lon, lat]).radius(5.5).precision(4)();
                return (
                  <g
                    key={`${lat}_${lon}`}
                    transform={`translate(${c[0]} ${c[1]}) scale(${sc}) translate(${-c[0]} ${-c[1]})`}
                    opacity={tisA}
                  >
                    <path d={path(circ) || ""} fill={col} fillOpacity={0.3} stroke={col} strokeWidth={1.6 / Math.max(sc, 0.3)} />
                  </g>
                );
              }),
            )}
          </g>
        )}

        {/* ── 拖动格陵兰 ── */}
        {dragA > 0 && (
          <g opacity={dragA}>
            <path
              d={path(GREENLAND) || ""}
              fill={C.amber}
              fillOpacity={lerp(0.85, 0.18, dragU)}
              stroke={C.amber}
              strokeWidth={2}
              strokeDasharray={dragU > 0 ? "7 6" : undefined}
              filter="url(#glow)"
            />
            {dragU > 0 && (
              <path
                d={d3.geoPath(movedProjection(proj, GL_C, dragDst))(GREENLAND) || ""}
                fill={C.teal}
                fillOpacity={0.9}
                stroke="#e8fffb"
                strokeWidth={1.5}
                filter="url(#glow)"
              />
            )}
            {smallPulse > 0 && (
              <circle
                cx={P(dragDst)[0]}
                cy={P(dragDst)[1]}
                r={30 + 70 * smallPulse}
                fill="none"
                stroke={C.teal}
                strokeWidth={3}
                opacity={1 - smallPulse}
              />
            )}
            {(() => {
              const g0 = P(GL_C);
              const tx = t < 26.6 ? lerp(1240, g0[0], E.inOutCubic(invLerp(26.15, 26.6, t))) : P(dragDst)[0];
              const ty = t < 26.6 ? lerp(640, g0[1], E.inOutCubic(invLerp(26.15, 26.6, t))) : P(dragDst)[1];
              return <Cursor x={tx} y={ty} a={env(t, 26.15, 26.35, 28.9, 29.2)} grab={grabbed} />;
            })()}
          </g>
        )}

        {/* ── 60° 面积放大 ── */}
        {latA > 0 && (
          <g opacity={latA}>
            {[60, 70, 75].map((lat, i) => {
              const a = ramp(t, [30.3, 33.8, 34.35][i], [30.9, 34.2, 34.75][i]);
              const l = P([-179.9 + cam.lon, lat]);
              const r = P([179.9 + cam.lon, lat]);
              return (
                <line
                  key={lat}
                  x1={l[0]}
                  y1={l[1]}
                  x2={lerp(l[0], r[0], a)}
                  y2={r[1]}
                  stroke={lat === 60 ? C.amber : C.coral}
                  strokeOpacity={lat === 60 ? 0.9 : 0.55}
                  strokeWidth={lat === 60 ? 2.5 : 1.6}
                  strokeDasharray="10 8"
                />
              );
            })}
            {sqs.map((q, i) => {
              const a = E.outBack(clamp((t - q.at) / 0.3));
              if (a <= 0) return null;
              const g = ramp(t, q.grow[0], q.grow[1], (x) => E.outBack(x, 1.2));
              const half = 8;
              const dLon = half / Math.cos((q.c[1] * Math.PI) / 180);
              const ring: [number, number][] = [];
              for (let k = 0; k <= 8; k++) ring.push([q.c[0] - dLon + (2 * dLon * k) / 8, q.c[1] - half]);
              for (let k = 0; k <= 8; k++) ring.push([q.c[0] + dLon, q.c[1] - half + (2 * half * k) / 8]);
              for (let k = 0; k <= 8; k++) ring.push([q.c[0] + dLon - (2 * dLon * k) / 8, q.c[1] + half]);
              for (let k = 0; k <= 8; k++) ring.push([q.c[0] - dLon, q.c[1] + half - (2 * half * k) / 8]);
              const pts = ring.map((p) => P(p));
              const c = P(q.c);
              const sc = lerp(1 / Math.sqrt(q.f), 1, g) * a;
              const xs = pts.map((p) => p[0]);
              const ys = pts.map((p) => p[1]);
              const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
              const col = q.f === 1 ? C.teal : q.f === 4 ? C.amber : C.coral;
              // 4 格网，逐格点亮（只用于 60°）
              const cells =
                q.f === 4
                  ? [0, 1, 2, 3].map((k) => {
                      const on = ramp(t, 32.62 + k * 0.17, 32.8 + k * 0.17);
                      const cx = k % 2;
                      const cy = Math.floor(k / 2);
                      return (
                        <rect
                          key={k}
                          x={lerp(x0, x1, cx / 2)}
                          y={lerp(y0, y1, cy / 2)}
                          width={(x1 - x0) / 2}
                          height={(y1 - y0) / 2}
                          fill={C.amber}
                          fillOpacity={0.45 * on}
                          stroke={C.paper}
                          strokeOpacity={0.6 * g}
                          strokeWidth={1.2}
                        />
                      );
                    })
                  : null;
              const labA = ramp(t, q.f === 4 ? 33.2 : q.grow[1] - 0.15, (q.f === 4 ? 33.2 : q.grow[1] - 0.15) + 0.3);
              return (
                <g key={i}>
                  <g transform={`translate(${c[0]} ${c[1]}) scale(${sc}) translate(${-c[0]} ${-c[1]})`}>
                    <path d={`M${pts.map((p) => p.join(",")).join("L")}Z`} fill={col} fillOpacity={0.25} stroke={col} strokeWidth={2.5} />
                    {cells}
                  </g>
                  <text
                    x={x1 * sc + c[0] * (1 - sc) + 14}
                    y={y0 * sc + c[1] * (1 - sc) + 30}
                    fontFamily={SERIF}
                    fontWeight={900}
                    fontSize={q.f === 1 ? 34 : 46}
                    fill={col}
                    opacity={labA}
                  >
                    {q.label}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* ── 俄罗斯 vs 非洲 ── */}
        {ruA > 0 && (
          <g opacity={ruA}>
            <path
              d={path(AFRICA) || ""}
              fill={C.coral}
              fillOpacity={0.55 * afHL2}
              stroke={C.coral}
              strokeWidth={2}
              strokeOpacity={afHL2}
              filter="url(#glow)"
            />
            <path
              d={path(RUSSIA) || ""}
              fill={C.amber}
              fillOpacity={lerp(0.8, 0.2, ruMove) * ruHL}
              stroke={C.amber}
              strokeWidth={2}
              strokeOpacity={ruHL}
              strokeDasharray={ruMove > 0 ? "7 6" : undefined}
              filter="url(#glow)"
            />
            {ruMove > 0 && (
              <path
                d={d3.geoPath(movedProjection(proj, RU_C, ruDst))(RUSSIA) || ""}
                fill={C.teal}
                fillOpacity={0.82}
                stroke="#e8fffb"
                strokeWidth={1.5}
                filter="url(#glow)"
              />
            )}
          </g>
        )}

        {/* ── 结论：两极打折 ── */}
        {tkA > 0 && (
          <g opacity={tkA}>
            {(() => {
              const y45 = P([cam.lon, 45])[1];
              const y85 = P([cam.lon, 84])[1];
              const xl = P([cam.lon - 179.9, 0])[0];
              const xr = P([cam.lon + 179.9, 0])[0];
              return (
                <rect x={0} y={y85} width={1920} height={(y45 - y85) * ramp(t, 43.75, 44.65)} fill="url(#polar)" />
              );
            })()}
            {[
              { lat: 0, txt: "原价", at: 44.85 },
              { lat: 60, txt: "2.5 折", at: 45 },
              { lat: 80, txt: "0.3 折", at: 45.3 },
            ].map((g) => {
              const a = E.outBack(clamp((t - g.at) / 0.3));
              const xl = P([cam.lon - 179.9, g.lat]);
              const xr = P([cam.lon + 179.9, g.lat]);
              return (
                <g key={g.lat} opacity={clamp(a)}>
                  <line x1={0} y1={xl[1]} x2={1920} y2={xr[1]} stroke={g.lat ? C.coral : C.teal} strokeDasharray="8 7" strokeOpacity={0.7} />
                  <g transform={`translate(${xr[0] + 16} ${xr[1]}) scale(${a})`}>
                    <path d="M0,0 L18,-19 L118,-19 L118,19 L18,19 Z" fill={g.lat ? C.coral : C.teal} />
                    <circle cx={14} cy={0} r={4.5} fill={C.ink} />
                    <text x={70} y={9} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={25} fill={C.ink}>
                      {g.txt}
                    </text>
                  </g>
                  <text x={xl[0] - 14} y={xl[1] + 9} textAnchor="end" fontFamily={NUM} fontWeight={600} fontSize={24} fill={C.paper} opacity={0.85}>
                    {g.lat}°
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* ───────── HTML 层：标签与面板 ───────── */}
      {hook > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: hookFade }}>
          <Chip x={glScreen[0] + 40} y={glScreen[1] - 10} a={env(t, 0.75, 1.15, 3.2, 3.5)} color={C.amber} side="right">
            格陵兰
          </Chip>
          <Chip x={afScreen[0] + 60} y={afScreen[1]} a={env(t, 1.6, 2.0, 3.2, 3.5)} color={C.coral} side="right">
            非洲
          </Chip>
          <Panel a={env(t, 2.0, 2.45, 3.15, 3.45)} x={110} y={170} w={540}>
            <Kicker>地图上看起来</Kicker>
            <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 70, lineHeight: 1.25, marginTop: 10, whiteSpace: "nowrap" }}>
              <span style={{ color: C.amber }}>格陵兰</span>
              <span style={{ color: C.muted, margin: "0 14px" }}>≈</span>
              <span style={{ color: C.coral }}>非洲</span>
            </div>
          </Panel>
          <Panel a={env(t, 3.35, 3.8, 5.4, 5.8)} x={110} y={170} w={430}>
            <Kicker color={C.teal}>按真实面积</Kicker>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, marginTop: 16, color: C.paper }}>非洲 =</div>
            <div
              style={{
                fontFamily: SERIF,
                fontWeight: 900,
                fontSize: 210,
                lineHeight: 1,
                color: C.teal,
                transform: `scale(${1 + 0.12 * env(t, 4.88, 4.95, 4.95, 5.25)})`,
                transformOrigin: "left center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span style={{ fontSize: 120 }}>×</span>
              {Math.max(1, copiesShown)}
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: C.paper }}>个格陵兰</div>
          </Panel>
        </div>
      )}

      {titleA > 0 && (
        <div style={{ position: "absolute", left: 110, top: 150, color: C.paper }}>
          <Reveal a={ramp(t, 15.75, 16.35) * titleA}>
            <Kicker color={C.amber}>MERCATOR PROJECTION</Kicker>
          </Reveal>
          <Reveal a={ramp(t, 15.85, 16.5) * titleA}>
            <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 132, lineHeight: 1.15, letterSpacing: "0.02em" }}>
              墨卡托投影
            </div>
          </Reveal>
          <div
            style={{
              height: 3,
              width: 520 * E.inOutCubic(ramp(t, 16.1, 16.9)),
              background: `linear-gradient(90deg, ${C.amber}, rgba(244,177,62,0))`,
              opacity: titleA,
              margin: "6px 0 26px",
            }}
          />
          <div style={{ display: "flex", gap: 22, alignItems: "baseline", opacity: yearA }}>
            <Reveal a={yearA}>
              <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 92, color: C.amber }}>1569</span>
            </Reveal>
            <Reveal a={ramp(t, 17.35, 17.85) * yearA}>
              <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: C.paper }}>年发表 · 为航海设计</span>
            </Reveal>
          </div>
        </div>
      )}

      {rhumbA > 0 && (
        <>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            <Compass
              x={300}
              y={330}
              r={150}
              a={env(t, 19.45, 20.0, 23.4, 23.8)}
              heading={lerp(-200, heading, E.outElastic(clamp((t - 19.4) / 1.6)))}
              spin={lerp(-90, 0, E.outCubic(clamp((t - 19.3) / 1.2)))}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              left: 300,
              top: 520,
              transform: "translateX(-50%)",
              textAlign: "center",
              color: C.paper,
              opacity: env(t, 19.9, 20.4, 23.4, 23.8),
            }}
          >
            <Kicker>罗盘航向</Kicker>
            <div style={{ fontFamily: NUM, fontWeight: 600, fontSize: 58, color: C.amber, marginTop: 4 }}>
              {Math.round((heading + 360) % 360)}°
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 28, marginTop: 6, opacity: ramp(t, 22.1, 22.6) }}>
              全程不用改
            </div>
          </div>
          <Chip x={pL[0]} y={pL[1]} a={env(t, 19.9, 20.3, 23.4, 23.8)} color={C.paper} side="right" size={26}>
            里斯本
          </Chip>
          <Chip x={pH[0]} y={pH[1]} a={env(t, 21.65, 22.0, 23.4, 23.8)} color={C.paper} side="left" size={26}>
            哈瓦那
          </Chip>
          <div
            style={{
              position: "absolute",
              left: 640,
              top: 150,
              opacity: env(t, 21.2, 21.7, 23.4, 23.8),
              fontFamily: SANS,
              fontWeight: 600,
              fontSize: 32,
              color: C.paper,
              padding: "10px 22px",
              borderRadius: 10,
              background: "rgba(8,19,31,0.72)",
              border: `1.5px solid ${C.amber}`,
            }}
          >
            与每条经线的<span style={{ color: C.amber }}>夹角都一样</span> → 图上就是一条直线
          </div>
        </>
      )}

      {tisA > 0 && (
        <div style={{ position: "absolute", left: 110, top: 190, color: C.paper, opacity: tisA }}>
          <Reveal a={ramp(t, 23.5, 24.0)}>
            <Kicker color={C.coral}>代价</Kicker>
          </Reveal>
          <Reveal a={ramp(t, 24.15, 24.7)}>
            <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 66, lineHeight: 1.25 }}>越往两极</div>
          </Reveal>
          <Reveal a={ramp(t, 25.25, 25.8)}>
            <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 66, lineHeight: 1.25, color: C.coral }}>拉得越大</div>
          </Reveal>
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 24, color: C.muted, marginTop: 22, opacity: ramp(t, 24.3, 24.8) }}>
            每个圈在地球上一样大
          </div>
        </div>
      )}

      {dragA > 0 && (
        <>
          <Panel a={env(t, 26.3, 26.8, 30.0, 30.4)} x={110} y={160} w={390}>
            <Kicker>格陵兰中心纬度</Kicker>
            <div style={{ fontFamily: NUM, fontWeight: 600, fontSize: 64, color: C.paper, fontVariantNumeric: "tabular-nums" }}>
              {dragLat.toFixed(1)}°{dragLat > 0.05 ? "N" : ""}
            </div>
            <div style={{ height: 1, background: "rgba(236,227,207,0.18)", margin: "16px 0 18px" }} />
            <Kicker>地图上被放大</Kicker>
            <div
              style={{
                fontFamily: SERIF,
                fontWeight: 900,
                fontSize: 96,
                lineHeight: 1.05,
                color: dragU > 0.98 ? C.teal : C.amber,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ×{areaFactor(dragLat).toFixed(1)}
            </div>
          </Panel>
          <Chip
            x={P(GL_C)[0] + 50}
            y={P(GL_C)[1] - 30}
            a={env(t, 27.6, 28.0, 30.0, 30.3)}
            color={C.amber}
            side="right"
            size={26}
          >
            地图上的格陵兰
          </Chip>
          <Chip
            x={P(dragDst)[0] + 26}
            y={P(dragDst)[1] + 6}
            a={env(t, 29.0, 29.4, 30.0, 30.3)}
            color={C.teal}
            side="right"
            size={30}
          >
            真实大小
          </Chip>
        </>
      )}

      {latA > 0 && (
        <Panel a={env(t, 30.3, 30.8, 35.2, 35.55)} x={110} y={150} w={470}>
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 24, color: C.muted, whiteSpace: "nowrap" }}>面积放大倍数 = 1 / cos²(纬度)</div>
          {[
            { lat: 0, f: "×1", at: 30.9, col: C.teal },
            { lat: 30, f: "×1.3", at: 31.05, col: C.paper },
            { lat: 60, f: "×4", at: 31.2, col: C.amber, hot: [32.4, 33.6] },
            { lat: 70, f: "×8.5", at: 33.8, col: C.coral },
            { lat: 75, f: "×15", at: 34.35, col: C.coral },
          ].map((r) => {
            const a = ramp(t, r.at, r.at + 0.35);
            const hot = r.hot ? env(t, r.hot[0], r.hot[0] + 0.25, r.hot[1], r.hot[1] + 0.4) : 0;
            const bar = Math.log(areaFactor(r.lat) * 1.0001) / Math.log(15);
            return (
              <div
                key={r.lat}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginTop: 18,
                  opacity: a,
                  transform: `translateX(${(1 - a) * -20}px) scale(${1 + 0.06 * hot})`,
                  transformOrigin: "left center",
                }}
              >
                <div style={{ width: 70, fontFamily: NUM, fontWeight: 600, fontSize: 26, color: C.muted }}>{r.lat}°</div>
                <div style={{ flex: 1, height: 12, borderRadius: 6, background: "rgba(236,227,207,0.08)" }}>
                  <div
                    style={{
                      width: `${Math.max(3, bar * 100 * E.outCubic(a))}%`,
                      height: "100%",
                      borderRadius: 6,
                      background: r.col,
                      boxShadow: hot ? `0 0 18px ${r.col}` : undefined,
                    }}
                  />
                </div>
                <div style={{ width: 92, textAlign: "right", fontFamily: SERIF, fontWeight: 900, fontSize: 34, color: r.col }}>{r.f}</div>
              </div>
            );
          })}
        </Panel>
      )}

      {ruA > 0 && (
        <>
          <Chip x={ruScreen[0]} y={ruScreen[1]} a={env(t, 35.8, 36.2, 38.45, 38.75) * ruHL} color={C.amber} side="right">
            俄罗斯
          </Chip>
          <Chip x={P([22, 5])[0]} y={P([22, 5])[1]} a={env(t, 37.5, 37.9, 38.45, 38.75)} color={C.coral} side="left">
            非洲
          </Chip>
          <Panel a={env(t, 37.6, 38.0, 38.4, 38.75)} x={110} y={170} w={540}>
            <Kicker>地图上看起来</Kicker>
            <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 66, lineHeight: 1.25, marginTop: 10, whiteSpace: "nowrap" }}>
              <span style={{ color: C.amber }}>俄罗斯</span>
              <span style={{ color: C.muted, margin: "0 12px" }}>&gt;</span>
              <span style={{ color: C.coral }}>非洲</span>
            </div>
          </Panel>
          <Panel a={env(t, 39.25, 39.75, 41.65, 42.05)} x={110} y={170} w={430}>
            <Kicker color={C.teal}>真实面积</Kicker>
            {[
              { name: "非洲", v: 3037, col: C.coral, at: 39.4 },
              { name: "俄罗斯", v: 1710, col: C.teal, at: 39.65 },
            ].map((b) => {
              const g = ramp(t, b.at, b.at + 0.7, E.outCubic);
              return (
                <div key={b.name} style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontWeight: 600, fontSize: 28 }}>
                    <span>{b.name}</span>
                    <span style={{ fontFamily: NUM, color: b.col, fontVariantNumeric: "tabular-nums" }}>
                      {Math.round(b.v * g)} 万 km²
                    </span>
                  </div>
                  <div style={{ height: 22, borderRadius: 6, background: "rgba(236,227,207,0.08)", marginTop: 8 }}>
                    <div style={{ width: `${(b.v / 3037) * 100 * g}%`, height: "100%", borderRadius: 6, background: b.col }} />
                  </div>
                </div>
              );
            })}
            <div
              style={{
                marginTop: 18,
                fontFamily: SERIF,
                fontWeight: 900,
                fontSize: 104,
                lineHeight: 1.05,
                color: C.paper,
                opacity: ramp(t, 40.55, 40.8),
                transform: `scale(${lerp(1.35, 1, E.outCubic(ramp(t, 40.55, 40.9)))})`,
                transformOrigin: "left center",
              }}
            >
              1.8<span style={{ fontSize: 60, color: C.muted }}> 倍</span>
            </div>
          </Panel>
        </>
      )}

      {tkA > 0 && (
        <div
          style={{
            position: "absolute",
            top: 92,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 30,
            color: C.paper,
            opacity: tkA,
          }}
        >
          <Reveal a={ramp(t, 43.75, 44.25)}>
            <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 82 }}>越靠近两极，</div>
          </Reveal>
          <Reveal a={ramp(t, 44.85, 45.35)}>
            <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 82, color: C.amber }}>越要打个折扣</div>
          </Reveal>
        </div>
      )}
    </div>
  );
};
