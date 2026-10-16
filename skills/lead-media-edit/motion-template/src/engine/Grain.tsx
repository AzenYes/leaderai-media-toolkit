import React from "react";
import { AbsoluteFill } from "remotion";

/** 胶片颗粒 + 暗角：让代码画面更有质感 */
export const Grain: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 0.07 }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <svg width="100%" height="100%" style={{ position: "absolute", opacity, mixBlendMode: "overlay" }}>
      <filter id="grainf">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 37} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grainf)" />
    </svg>
    <AbsoluteFill
      style={{ background: "radial-gradient(ellipse 75% 70% at 45% 45%, rgba(0,0,0,0) 55%, rgba(2,6,12,0.55) 100%)" }}
    />
  </AbsoluteFill>
);
