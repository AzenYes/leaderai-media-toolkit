// 与交互页面“格陵兰没那么大”保持同一套视觉：深海蓝底 + 纸色文字 + 琥珀/珊瑚/青绿强调
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

// 设计画布 1920×1080（渲染时 --scale=2 输出 3840×2160）
export const W = 1920;
export const H = 1080;

// 人物圆环在右下角；B-roll 的重要信息不要进入 PIP_KEEPOUT，字幕带 SUB_BAND 也尽量留空
export const PIP = { x: 1714, y: 862, r: 150 };
export const PIP_KEEPOUT = { x: 1500, y: 650 };
export const SUB_BAND = { y: 945 };
