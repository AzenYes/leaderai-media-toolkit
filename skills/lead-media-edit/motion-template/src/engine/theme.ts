// 与交互页面“格陵兰没那么大”保持同一套视觉：深海蓝底 + 纸色文字 + 琥珀/珊瑚/青绿强调
import { ORIENTATION, PIP_CORNER } from "../project";

export const C = {
  ink: "#08131f",
  deep: "#050d16",
  sea: "#0b1d2e",
  grid: "rgba(150,185,210,0.13)",
  land: "#17324a",
  landEdge: "#2e5676",
  paper: "#ece3cf",
  muted: "#8ea6b8",
  amber: "#f4b13e",
  coral: "#ff6a4d",
  teal: "#5fd3c4",
};

export const VERTICAL = ORIENTATION === "vertical";

// 设计画布：横版 1920×1080 / 竖版 1080×1920（渲染时 --scale=2 输出 3840×2160 / 2160×3840）
export const W = VERTICAL ? 1080 : 1920;
export const H = VERTICAL ? 1920 : 1080;

// 人物圆环 PIP、圆环禁放区 PIP_KEEPOUT（矩形）、字幕带 SUB_BAND（尽量不放关键信息）
// 横版：圆环在右下角，字幕在底部。
// 竖版：平台底部约 25% 被作者名/标题/音乐条遮挡，右侧中下部是点赞/评论按钮列，顶部约 170px 是状态栏和频道标签，
//       所以圆环放上部一角（顶部栏下方），字幕底边落在距底部约 1/3 处（y≈1280），底部 1/4 只放背景。
const PIP_TR = { x: 880, y: 360, r: 150 };
const PIP_TL = { x: 200, y: 360, r: 150 };
export const PIP = VERTICAL ? (PIP_CORNER === "tl" ? PIP_TL : PIP_TR) : { x: 1714, y: 862, r: 150 };
export const PIP_KEEPOUT = VERTICAL
  ? PIP_CORNER === "tl"
    ? { x0: 0, y0: 170, x1: 380, y1: 540 }
    : { x0: 700, y0: 170, x1: 1080, y1: 540 }
  : { x0: 1500, y0: 650, x1: 1920, y1: 1080 };
export const SUB_BAND = VERTICAL ? { y0: 1180, y1: 1320 } : { y0: 945, y1: 1080 };
// 竖版平台界面遮挡区：顶部栏、右侧按钮列、底部信息区——都不放关键信息
export const PLATFORM_UI = VERTICAL ? { top: 170, rightX: 940, rightY0: 860, rightY1: 1640, bottom: 1440 } : null;
