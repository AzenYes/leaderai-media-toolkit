import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
// 可选：在 Remotion 内放音效（音效多时并发渲染易出错，默认用 scripts/mix_audio.py 离线混音）

export type Cue = [t: number, name: string, volume?: number];

/** 音效轨：t 为成片秒数，name 对应 public/sfx/<name>.wav */
export const SfxTrack: React.FC<{ cues: Cue[]; fps: number }> = ({ cues, fps }) => (
  <>
    {cues.map(([t, name, vol = 0.3], i) => (
      <Sequence key={i} from={Math.max(0, Math.round(t * fps))} durationInFrames={Math.round(2.4 * fps)} layout="none">
        <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
      </Sequence>
    ))}
  </>
);
