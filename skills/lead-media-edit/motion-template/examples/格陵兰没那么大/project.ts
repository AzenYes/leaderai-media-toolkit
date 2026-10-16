// 本条视频的项目配置：人物状态、音效与素材。时间单位均为成片秒数（来自粗剪后的逐字时间戳）。
import type { Mode } from "./engine/Presenter";
import type { Cue } from "./engine/Sfx";
import sfx from "./sfx.json";

export const FPS = 60000 / 1001;
export const DURATION = 49.7831;
export const VIDEO = "rough.mp4";
// 原画面中人物头肩的位置与半径（1920×1080 设计坐标），用于缩成圆环时取景
export const FACE = { x: 982, y: 470, r: 300 };

export const MODES: Mode[] = [
  { t: 0, mode: "full" },
  { t: 0.4, mode: "pip" },
  { t: 4.98, mode: "full" },
  { t: 8.2, mode: "pip" },
  { t: 41.23, mode: "full" },
  { t: 43.57, mode: "pip" },
  { t: 45.77, mode: "full" },
];

// 音效表与 scripts/mix_audio.py 共用（渲染时 --muted，音频由 mix_audio.py 一次混好）
export const SFX = sfx as Cue[];
