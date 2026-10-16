import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ensureFonts } from "./engine/fonts";
import { Presenter, pipProgress } from "./engine/Presenter";
import { Grain } from "./engine/Grain";
import { C } from "./engine/theme";
import { clamp, invLerp } from "./engine/ease";
import { MapStage } from "./scenes/MapStage";
import { GlobeScene } from "./scenes/GlobeScene";
import { EndCard } from "./scenes/EndCard";
import { DURATION, FACE, MODES, VIDEO } from "./project";

// 画面合成；音频由 scripts/mix_audio.py 离线混好，渲染加 --muted

ensureFonts();

export const Story: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pip = pipProgress(t, MODES);
  // B-roll 只在人物未完全全屏时渲染，节省渲染时间
  const showBroll = pip > 0.001;
  const fadeOut = 1 - clamp(invLerp(DURATION - 0.18, DURATION, t));
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {showBroll && (
        <AbsoluteFill>
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse 80% 70% at 30% 20%, #12304a 0%, ${C.ink} 58%, ${C.deep} 100%)`,
            }}
          />
          <GlobeScene t={t} />
          <MapStage t={t} />
          <Grain frame={frame} />
        </AbsoluteFill>
      )}
      <Presenter t={t} modes={MODES} src={VIDEO} face={FACE} />
      <EndCard t={t} />
      <AbsoluteFill style={{ background: "#000", opacity: 1 - fadeOut }} />
    </AbsoluteFill>
  );
};
