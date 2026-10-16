import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

// 本地字体（已按用字子集化，见 scripts/subset_fonts.py）：避免渲染时依赖网络，也避免静默回退
const FONTS: [string, string, string][] = [
  ["Noto Serif SC", "fonts/NotoSerifSC-VF.ttf", "200 900"],
  ["Plex SC", "fonts/IBMPlexSansSC-Medium.otf", "500"],
  ["Plex SC", "fonts/IBMPlexSansSC-SemiBold.otf", "600"],
  ["Inter", "fonts/Inter-Medium.ttf", "500"],
  ["Inter", "fonts/Inter-SemiBold.ttf", "600"],
];

let loaded = false;
export const ensureFonts = () => {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const h = delayRender("fonts");
  Promise.all(
    FONTS.map(([family, file, weight]) => {
      const f = new FontFace(family, `url(${staticFile(file)})`, { weight });
      return f.load().then((ff) => document.fonts.add(ff));
    }),
  )
    .then(() => continueRender(h))
    // 字体加载失败直接中止渲染，绝不静默回退
    .catch((e) => cancelRender(e));
};

export const SERIF = '"Noto Serif SC", serif';
export const SANS = '"Plex SC", sans-serif';
export const NUM = 'Inter, "Plex SC", sans-serif';
