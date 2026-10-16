import React from "react";
import { E, env, ramp } from "../engine/ease";
import { C } from "../engine/theme";
import { SANS, SERIF } from "../engine/fonts";

// 示例场景：左上标题遮罩揭示 + 中部数字滚动。复制本文件按分镜表写本条视频的场景。
export const Example: React.FC<{ t: number }> = ({ t }) => {
  const a = env(t, 2.1, 2.6, 7.6, 8.0);
  if (a <= 0) return null;
  const n = Math.round(14 * ramp(t, 3.0, 4.2, E.outCubic));
  return (
    <div style={{ position: "absolute", inset: 0, opacity: a, color: C.paper }}>
      <div style={{ position: "absolute", left: 110, top: 150, overflow: "hidden" }}>
        <div style={{ transform: `translateY(${(1 - E.outQuart(ramp(t, 2.1, 2.7))) * 110}%)`, fontFamily: SERIF, fontWeight: 900, fontSize: 120 }}>
          标题
        </div>
      </div>
      <div style={{ position: "absolute", left: 600, top: 380, fontFamily: SERIF, fontWeight: 900, fontSize: 260, color: C.teal }}>×{n}</div>
      <div style={{ position: "absolute", left: 610, top: 680, fontFamily: SANS, fontWeight: 600, fontSize: 36 }}>说明文字</div>
    </div>
  );
};
