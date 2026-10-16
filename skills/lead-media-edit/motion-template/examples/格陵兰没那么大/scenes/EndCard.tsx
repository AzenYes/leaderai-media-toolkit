import React from "react";
import * as d3 from "d3-geo";
import { E, clamp, env, lerp, ramp } from "../engine/ease";
import { C } from "../engine/theme";
import { SANS, SERIF } from "../engine/fonts";
import { GL_C, GREENLAND, land, makeProj, movedProjection } from "./geo";

// 结尾：人物全屏，左侧墙面放一张“拖动页面”小卡片，不遮挡人脸
export const EndCard: React.FC<{ t: number }> = ({ t }) => {
  const a = env(t, 46.2, 46.8, 49.35, 49.75);
  if (a <= 0.001) return null;
  const W0 = 440;
  const H0 = 250;
  const proj = makeProj({ k: 0.27, lon: -20, lat: 30, x: W0 / 2, y: H0 / 2 + 10 });
  const path = d3.geoPath(proj);
  // 循环拖动演示
  const loop = (((t - 46.55) % 2.6) + 2.6) % 2.6;
  const u = E.inOutCubic(clamp((loop - 0.4) / 1.4));
  const back = E.inOutCubic(clamp((loop - 2.0) / 0.5));
  const lat = lerp(GL_C[1], 5, u * (1 - back));
  const dst: [number, number] = [GL_C[0], lat];
  const cp = proj(dst) as [number, number];
  const callA = ramp(t, 48, 48.45);
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        top: 260,
        width: W0,
        opacity: clamp(a * 1.4),
        transform: `translateY(${(1 - E.outCubic(a)) * 40}px) rotate(${(1 - a) * -2}deg)`,
      }}
    >
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          background: C.ink,
          border: "1px solid rgba(236,227,207,0.2)",
          boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", background: "#0f2235" }}>
          {[C.coral, C.amber, C.teal].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
          ))}
          <div style={{ marginLeft: 12, fontFamily: SANS, fontWeight: 500, fontSize: 18, color: C.muted }}>
            格陵兰没那么大 · 拖动页面
          </div>
        </div>
        <svg width={W0} height={H0} style={{ display: "block" }}>
          <rect width={W0} height={H0} fill="#0b1d2e" />
          <path d={path(land) || ""} fill={C.land} stroke={C.landEdge} strokeWidth={0.8} />
          <path d={path(GREENLAND) || ""} fill="none" stroke={C.amber} strokeDasharray="4 4" strokeWidth={1.4} />
          <path d={d3.geoPath(movedProjection(proj, GL_C, dst))(GREENLAND) || ""} fill={C.teal} fillOpacity={0.9} />
          <g transform={`translate(${cp[0]} ${cp[1]}) scale(0.8)`}>
            <path
              d="M0,0 L0,30 L8,22.5 L13.5,34 L18.5,31.8 L13.2,20.6 L23.5,20.6 Z"
              fill={C.paper}
              stroke={C.ink}
              strokeWidth={2}
            />
          </g>
        </svg>
      </div>
      <div
        style={{
          marginTop: 18,
          padding: "14px 22px 16px",
          borderRadius: 14,
          background: "rgba(8,19,31,0.86)",
          border: "1px solid rgba(236,227,207,0.18)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 28, color: C.paper }}>拖动页面 · 已放在简介</div>
        <div
          style={{
            marginTop: 6,
            fontFamily: SERIF,
            fontWeight: 900,
            fontSize: 40,
            color: C.amber,
            opacity: callA,
            transform: `translateX(${(1 - callA) * -20}px)`,
          }}
        >
          你也拖一个国家试试 →
        </div>
      </div>
    </div>
  );
};
