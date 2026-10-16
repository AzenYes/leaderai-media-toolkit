import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { E, clamp, invLerp, lerp } from "./ease";
import { C, PIP } from "./theme";

export type Mode = { t: number; mode: "full" | "pip"; dur?: number };

/** 人物状态 0=全屏 1=圆环；每次切换用 dur 秒的 inOutQuint 过渡 */
export const pipProgress = (t: number, modes: Mode[]) => {
  let v = modes[0].mode === "pip" ? 1 : 0;
  for (let i = 1; i < modes.length; i++) {
    const m = modes[i];
    const target = m.mode === "pip" ? 1 : 0;
    const d = m.dur ?? 0.62;
    if (t < m.t) break;
    const k = E.inOutQuint(clamp((t - m.t) / d));
    v = lerp(v, target, k);
  }
  return v;
};

/** 全屏段落的缓慢推近，避免长时间静止画面 */
const fullPush = (t: number, modes: Mode[]) => {
  for (let i = 0; i < modes.length; i++) {
    const a = modes[i];
    const b = modes[i + 1];
    const end = b ? b.t : a.t + 30;
    if (a.mode === "full" && t >= a.t && t < end + 0.7) return 1 + 0.045 * E.inOutCubic(invLerp(a.t, end + 0.7, t));
  }
  return 1;
};

export const Presenter: React.FC<{
  t: number;
  modes: Mode[];
  src: string;
  face: { x: number; y: number; r: number };
}> = ({ t, modes, src, face }) => {
  const e = pipProgress(t, modes);
  const sFull = fullPush(t, modes);
  const sPip = PIP.r / face.r;
  const s = Math.exp(lerp(Math.log(sFull), Math.log(sPip), e));
  const ax = lerp(face.x, PIP.x, e);
  const ay = lerp(face.y, PIP.y, e);
  const tx = ax - face.x * s;
  const ty = ay - face.y * s;
  const r = Math.exp(lerp(Math.log(1400), Math.log(PIP.r), e));
  const ringA = clamp((e - 0.55) / 0.45);
  const spin = t * 22;

  return (
    <AbsoluteFill>
      {/* 落影 */}
      <div
        style={{
          position: "absolute",
          left: ax - r,
          top: ay - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          boxShadow: `0 ${18 * ringA}px ${60 * ringA}px rgba(0,0,0,${0.55 * ringA})`,
        }}
      />
      <AbsoluteFill style={{ clipPath: `circle(${r}px at ${ax}px ${ay}px)` }}>
        <OffthreadVideo
          src={staticFile(src)}
          muted
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1920,
            height: 1080,
            transform: `translate(${tx}px, ${ty}px) scale(${s})`,
            transformOrigin: "0 0",
          }}
        />
        {/* 缩小后轻微压暗边缘，让人物融入深色 B-roll */}
        <div
          style={{
            position: "absolute",
            left: ax - r,
            top: ay - r,
            width: r * 2,
            height: r * 2,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(0,0,0,0) 62%, rgba(5,13,22,${0.45 * ringA}) 100%)`,
          }}
        />
      </AbsoluteFill>
      {ringA > 0 && (
        <svg
          width={r * 2 + 40}
          height={r * 2 + 40}
          style={{ position: "absolute", left: ax - r - 20, top: ay - r - 20, opacity: ringA, overflow: "visible" }}
        >
          <circle cx={r + 20} cy={r + 20} r={r} fill="none" stroke={C.paper} strokeOpacity={0.92} strokeWidth={3} />
          <g transform={`rotate(${spin} ${r + 20} ${r + 20})`}>
            <circle
              cx={r + 20}
              cy={r + 20}
              r={r + 11}
              fill="none"
              stroke={C.amber}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={`${(r + 11) * 0.9} ${(r + 11) * 5.4}`}
            />
            <circle
              cx={r + 20}
              cy={r + 20}
              r={r + 11}
              fill="none"
              stroke={C.paper}
              strokeOpacity={0.35}
              strokeWidth={1.2}
              strokeDasharray="2 9"
            />
          </g>
        </svg>
      )}
    </AbsoluteFill>
  );
};
