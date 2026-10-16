import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ensureFonts } from "./engine/fonts";
import { Presenter, pipProgress } from "./engine/Presenter";
import { Grain } from "./engine/Grain";
import { C } from "./engine/theme";
import { clamp, invLerp } from "./engine/ease";
import { Example } from "./scenes/Example";
import { DURATION, FACE, MODES, VIDEO } from "./project";

ensureFonts();

// 画面合成；音频不在这里（渲染加 --muted，用 scripts/mix_audio.py 混人声+音效，final_compose.py 合成）
export const Story: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pip = pipProgress(t, MODES);
  const fadeOut = 1 - clamp(invLerp(DURATION - 0.18, DURATION, t));
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {pip > 0.001 && (
        <AbsoluteFill>
          <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 70% at 30% 20%, #12304a 0%, ${C.ink} 58%, ${C.deep} 100%)` }} />
          <Example t={t} />
          <Grain frame={frame} />
        </AbsoluteFill>
      )}
      <Presenter t={t} modes={MODES} src={VIDEO} face={FACE} />
      <AbsoluteFill style={{ background: "#000", opacity: 1 - fadeOut }} />
    </AbsoluteFill>
  );
};
