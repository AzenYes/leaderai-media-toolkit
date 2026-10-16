import React from "react";
import { E, env, invLerp, lerp, ramp } from "../engine/ease";
import { C } from "../engine/theme";
import { SANS } from "../engine/fonts";
import { Globe, type GlobeState } from "./Globe";
import { S } from "./geo";

// 地球：8.4 出现 → 10.15 切缝 → 11.0 剥开压平 → 12.85 拉成墨卡托 → 14.3 交给 SVG 地图
export const globeOpacity = (t: number) => env(t, 7.9, 8.5, 14.2, 14.55, E.outCubic);

export const globeState = (t: number): GlobeState => {
  const peelE = E.inOutCubic(ramp(t, 11.0, 12.75, E.linear));
  const strE = ramp(t, 12.85, 14.05, E.inOutCubic);
  const kFlat = 0.5;
  return {
    spin: -1.35 * Math.PI * (1 - E.outCubic(invLerp(7.9, 11.0, t))),
    cut: ramp(t, 10.15, 10.95),
    peel: peelE,
    stretch: strE,
    heat: env(t, 13.1, 13.7, 14.15, 14.5),
    r: 300 * (0.84 + 0.16 * E.outBack(ramp(t, 7.9, 8.9, E.linear))),
    sk: lerp(lerp(300, 175, peelE), S * kFlat, strE),
    globeC: [900, 470],
    mapC: [900, 470],
    tilt: lerp(0.38, 0, ramp(t, 9.4, 11.0)),
  };
};

const STEPS = [
  { at: 8.45, txt: "球面" },
  { at: 11.05, txt: "剥开压平" },
  { at: 12.9, txt: "拉成长方形" },
];

export const GlobeScene: React.FC<{ t: number }> = ({ t }) => {
  const op = globeOpacity(t);
  if (op <= 0.001) return null;
  const s = globeState(t);
  const stepA = env(t, 8.5, 9.0, 14.0, 14.4);
  const stretchLab = env(t, 13.35, 13.75, 14.1, 14.4);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Globe s={s} opacity={op} />
      {/* 步骤条 */}
      <div style={{ position: "absolute", left: 110, top: 120, display: "flex", gap: 14, alignItems: "center", opacity: stepA }}>
        {STEPS.map((st, i) => {
          const on = ramp(t, st.at, st.at + 0.35);
          const next = STEPS[i + 1] ? ramp(t, STEPS[i + 1].at, STEPS[i + 1].at + 0.35) : 0;
          const active = on * (1 - next * 0.6);
          return (
            <React.Fragment key={st.txt}>
              {i > 0 && (
                <div style={{ width: 46, height: 2, background: "rgba(236,227,207,0.18)" }}>
                  <div style={{ width: `${on * 100}%`, height: "100%", background: C.amber }} />
                </div>
              )}
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 600,
                  fontSize: 28,
                  padding: "8px 18px",
                  borderRadius: 999,
                  color: active > 0.5 ? C.ink : C.paper,
                  background: `rgba(244,177,62,${active})`,
                  border: `1.5px solid rgba(236,227,207,${0.25 + 0.5 * on})`,
                  opacity: 0.45 + 0.55 * on,
                }}
              >
                <span style={{ fontFamily: "Inter", marginRight: 8, opacity: 0.8 }}>{i + 1}</span>
                {st.txt}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {/* 拉伸提示 */}
      <div
        style={{
          position: "absolute",
          left: 900,
          top: 470 - 3.1 * S * 0.5 + 6,
          transform: `translate(-50%, 0) translateY(${(1 - stretchLab) * -12}px)`,
          opacity: stretchLab,
          fontFamily: SANS,
          fontWeight: 600,
          fontSize: 30,
          color: C.paper,
          padding: "8px 20px",
          borderRadius: 10,
          background: "rgba(8,19,31,0.75)",
          border: `1.5px solid ${C.coral}`,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: C.coral }}>↕</span> 高纬度被硬拉开
      </div>
    </div>
  );
};
