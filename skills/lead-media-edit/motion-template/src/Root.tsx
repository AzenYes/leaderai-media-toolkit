import React from "react";
import { Composition } from "remotion";
import { Story } from "./Story";
import { DURATION, FPS } from "./project";

export const Root: React.FC = () => (
  <Composition
    id="Final"
    component={Story}
    durationInFrames={Math.round(DURATION * FPS)}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
