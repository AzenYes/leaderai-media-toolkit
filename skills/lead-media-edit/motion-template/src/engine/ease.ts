// 动效时间工具：所有函数以“秒”为单位，便于直接对齐口播字时间。
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) => clamp((x - a) / (b - a));

export const E = {
  linear: (t: number) => t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inOutQuint: (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outBack: (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  // 带阻尼的回弹，适合“落定”
  outElastic: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

/** 0→1 的进度：在 [a, b] 秒内按 ease 推进 */
export const ramp = (t: number, a: number, b: number, ease = E.inOutCubic) => ease(invLerp(a, b, t));

/** 入场 + 出场包络 */
export const env = (t: number, inA: number, inB: number, outA = Infinity, outB = Infinity, ease = E.outCubic) =>
  Math.min(ramp(t, inA, inB, ease), 1 - ramp(t, outA, outB, E.inCubic));

/** 关键帧插值：keys 为 [秒, 值]，段间使用 ease */
export const keyed = (t: number, keys: [number, number][], ease = E.inOutCubic) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (t <= t1) return lerp(v0, v1, ease(invLerp(t0, t1, t)));
  }
  return keys[keys.length - 1][1];
};

export const fmt = (x: number, d = 1) => x.toFixed(d);
