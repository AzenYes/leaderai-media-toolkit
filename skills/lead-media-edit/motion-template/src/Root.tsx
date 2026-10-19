import React from "react";
import { Composition } from "remotion";
import { Story } from "./Story";
import { DURATION, FPS } from "./project";
import { H, W } from "./engine/theme";

export const Root: React.FC = () => (
  <Composition
    id="Final"
    component={Story}
    durationInFrames={Math.round(DURATION * FPS)}
    fps={FPS}
    width={W}
    height={H}
  />
);
