import React, { useMemo } from "react";
import * as THREE from "three";
import * as d3 from "d3-geo";
import { ThreeCanvas } from "@remotion/three";
import { AFRICA, GREENLAND, borders, land } from "./geo";
import { C } from "../engine/theme";

// 12 瓣“橘子皮”网格：每瓣独立顶点，剥开时边界可以分离
const GORES = 12;
const SUB_L = 14;
const SUB_P = 96;

const buildGeometry = () => {
  const pos: number[] = [];
  const ll: number[] = [];
  const gore: number[] = [];
  const idx: number[] = [];
  const half = Math.PI / GORES;
  let base = 0;
  for (let g = 0; g < GORES; g++) {
    const lc = -Math.PI + (g + 0.5) * ((2 * Math.PI) / GORES);
    for (let j = 0; j <= SUB_P; j++) {
      const phi = ((-89.5 + (179 * j) / SUB_P) * Math.PI) / 180;
      for (let i = 0; i <= SUB_L; i++) {
        const lam = lc - half + (2 * half * i) / SUB_L;
        pos.push(0, 0, 0);
        ll.push(lam, phi);
        gore.push(g, lc);
      }
    }
    for (let j = 0; j < SUB_P; j++)
      for (let i = 0; i < SUB_L; i++) {
        const a = base + j * (SUB_L + 1) + i;
        const b = a + 1;
        const c = a + (SUB_L + 1);
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    base += (SUB_P + 1) * (SUB_L + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aLL", new THREE.Float32BufferAttribute(ll, 2));
  geo.setAttribute("aGore", new THREE.Float32BufferAttribute(gore, 2));
  geo.setIndex(idx);
  return geo;
};

// 等距圆柱纹理：海、经纬网、陆地、国界，格陵兰与非洲提前着色
const buildTexture = () => {
  const Wt = 4096;
  const Ht = 2048;
  const cv = document.createElement("canvas");
  cv.width = Wt;
  cv.height = Ht;
  const ctx = cv.getContext("2d")!;
  const proj = d3.geoEquirectangular().scale(Wt / (2 * Math.PI)).translate([Wt / 2, Ht / 2]);
  const path = d3.geoPath(proj, ctx);
  ctx.fillStyle = "#0e2438";
  ctx.fillRect(0, 0, Wt, Ht);
  ctx.beginPath();
  path(d3.geoGraticule().step([15, 15])());
  ctx.strokeStyle = "rgba(150,185,210,0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  path(land);
  ctx.fillStyle = "#2a5878";
  ctx.fill();
  ctx.beginPath();
  path(AFRICA);
  ctx.fillStyle = "#b8584a";
  ctx.fill();
  ctx.beginPath();
  path(GREENLAND);
  ctx.fillStyle = C.amber;
  ctx.fill();
  ctx.beginPath();
  path(borders);
  ctx.strokeStyle = "rgba(8,19,31,0.55)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  path(land);
  ctx.strokeStyle = "rgba(190,220,240,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};

const vert = /* glsl */ `
attribute vec2 aLL;
attribute vec2 aGore;
uniform float uSpin, uCut, uPeel, uStretch, uR, uSK, uTilt;
uniform vec2 uGlobeC, uMapC;
varying vec2 vUv;
varying float vShade, vFlat, vEdge, vLat;
const float PI = 3.14159265;
float mercY(float p){ p = clamp(p, -1.4835, 1.4835); return log(tan(PI*0.25 + p*0.5)); }
void main(){
  float lam = aLL.x, phi = aLL.y, lc = aGore.y, g = aGore.x;
  float halfW = PI / 12.0;
  float rel = (lam - lc);
  vEdge = abs(rel) / halfW;
  // 球面（切缝：每瓣向中线收一点）
  float lamCut = lc + rel * (1.0 - 0.06 * uCut);
  float ls = lamCut + uSpin;
  vec3 ps = vec3(cos(phi) * sin(ls), sin(phi), cos(phi) * cos(ls));
  // 轻微俯视倾角
  float ct = cos(uTilt), st = sin(uTilt);
  ps = vec3(ps.x, ps.y * ct - ps.z * st, ps.y * st + ps.z * ct);
  vec3 sphere = vec3(uGlobeC, 0.0) + ps * uR;
  // 剥开的瓣（正弦瓣）→ 墨卡托
  float gx = lc + rel * mix(cos(phi), 1.0, uStretch) * (1.0 - 0.02 * uCut * (1.0 - uStretch));
  float gy = mix(phi, mercY(phi), uStretch);
  vec3 flat3 = vec3(uMapC.x + gx * uSK, uMapC.y + gy * uSK, 0.0);
  // 从正面那瓣开始依次剥开
  float order = abs(g - 5.5);
  float pg = clamp(uPeel * 1.55 - order * 0.1, 0.0, 1.0);
  pg = pg * pg * (3.0 - 2.0 * pg);
  // 背面瓣在翻过来时略微抬起，避免穿插
  vec3 p = mix(sphere, flat3, pg);
  p.z += sin(pg * PI) * 120.0 * (1.0 - step(0.0, ps.z) * 0.6);
  vFlat = pg;
  vec3 L = normalize(vec3(-0.45, 0.55, 0.75));
  vShade = mix(0.22 + 0.95 * max(dot(ps, L), 0.0) + 0.35 * pow(1.0 - max(ps.z, 0.0), 3.0), 1.0, pg);
  vUv = vec2((lam + PI) / (2.0 * PI), (phi + PI * 0.5) / PI);
  vLat = phi;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const frag = /* glsl */ `
uniform sampler2D uTex;
uniform float uCut, uStretch, uHeat;
varying vec2 vUv;
varying float vShade, vFlat, vEdge, vLat;
void main(){
  vec3 col = texture2D(uTex, vUv).rgb * vShade;
  // 拉伸热度：越靠两极越红（面积放大 1/cos²φ）
  float f = 1.0 / pow(cos(vLat), 2.0);
  float heat = clamp((f - 1.0) / 10.0, 0.0, 1.0) * uHeat;
  col = mix(col, vec3(1.0, 0.42, 0.30), heat * heat * 0.22);
  // 瓣边缘高光（切缝）
  float edge = smoothstep(0.93, 1.0, vEdge) * uCut * (1.0 - uStretch);
  col = mix(col, vec3(0.93, 0.89, 0.81), edge * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

export type GlobeState = {
  spin: number;
  cut: number;
  peel: number;
  stretch: number;
  heat: number;
  r: number;
  sk: number; // 平面阶段的 px/弧度
  globeC: [number, number]; // 屏幕坐标（左上为原点）
  mapC: [number, number];
  tilt: number;
};

const Mesh: React.FC<{ s: GlobeState }> = ({ s }) => {
  const geo = useMemo(buildGeometry, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        side: THREE.DoubleSide,
        uniforms: {
          uTex: { value: buildTexture() },
          uSpin: { value: 0 },
          uCut: { value: 0 },
          uPeel: { value: 0 },
          uStretch: { value: 0 },
          uHeat: { value: 0 },
          uR: { value: 300 },
          uSK: { value: 135 },
          uTilt: { value: 0 },
          uGlobeC: { value: new THREE.Vector2() },
          uMapC: { value: new THREE.Vector2() },
        },
      }),
    [],
  );
  const u = mat.uniforms;
  u.uSpin.value = s.spin;
  u.uCut.value = s.cut;
  u.uPeel.value = s.peel;
  u.uStretch.value = s.stretch;
  u.uHeat.value = s.heat;
  u.uR.value = s.r;
  u.uSK.value = s.sk;
  u.uTilt.value = s.tilt;
  // three 的正交相机以画面中心为原点、y 向上
  u.uGlobeC.value.set(s.globeC[0] - 960, 540 - s.globeC[1]);
  u.uMapC.value.set(s.mapC[0] - 960, 540 - s.mapC[1]);
  return <mesh geometry={geo} material={mat} />;
};

export const Globe: React.FC<{ s: GlobeState; opacity: number }> = ({ s, opacity }) => (
  <div style={{ position: "absolute", inset: 0, opacity }}>
    {/* 大气光晕 */}
    <div
      style={{
        position: "absolute",
        left: s.globeC[0] - s.r * 1.5,
        top: s.globeC[1] - s.r * 1.5,
        width: s.r * 3,
        height: s.r * 3,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(95,211,196,${0.22 * (1 - s.peel)}) 30%, rgba(95,211,196,${
          0.07 * (1 - s.peel)
        }) 45%, rgba(0,0,0,0) 66%)`,
      }}
    />
    <ThreeCanvas
      width={1920}
      height={1080}
      orthographic
      camera={{ left: -960, right: 960, top: 540, bottom: -540, near: -3000, far: 3000, position: [0, 0, 1000] } as any}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Mesh s={s} />
    </ThreeCanvas>
  </div>
);
