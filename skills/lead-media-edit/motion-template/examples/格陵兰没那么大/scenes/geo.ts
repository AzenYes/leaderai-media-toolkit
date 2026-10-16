import * as d3 from "d3-geo";
import { feature, merge, mesh } from "topojson-client";
import world from "../data/world.json";

const topo = world as any;
const geoms = topo.objects.countries.geometries;

export const countries: any[] = (feature(topo, topo.objects.countries) as any).features;
export const land: any = feature(topo, topo.objects.land);
export const borders: any = mesh(topo, topo.objects.countries, (a: any, b: any) => a !== b);

const AFRICA_IDS = new Set(
  "012 024 204 072 854 108 120 132 140 148 174 178 180 384 262 818 226 232 748 231 266 270 288 324 624 404 426 430 434 450 454 466 478 480 504 508 516 562 566 646 678 686 690 694 706 710 728 729 834 768 788 800 894 716 732 654".split(
    " ",
  ),
);
const byId = (id: string) => countries.find((f) => f.id === id);
export const GREENLAND = byId("304");
export const RUSSIA = byId("643");
export const AFRICA: any = { type: "Feature", properties: {}, geometry: merge(topo, geoms.filter((g: any) => AFRICA_IDS.has(g.id))) };

export const GL_C = d3.geoCentroid(GREENLAND) as [number, number];
export const RU_C = d3.geoCentroid(RUSSIA) as [number, number];

export const S = 270; // 墨卡托基准比例（px / 弧度）。三维剥皮场景使用同一比例，保证无缝衔接
export const mercY = (latDeg: number) => {
  const p = (Math.max(-85, Math.min(85, latDeg)) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + p / 2));
};
export const areaFactor = (latDeg: number) => 1 / Math.cos((latDeg * Math.PI) / 180) ** 2;

export type Cam = { k: number; lon: number; lat: number; x: number; y: number };
export const makeProj = (c: Cam) =>
  d3.geoMercator().rotate([-c.lon, 0]).center([0, c.lat]).scale(S * c.k).translate([c.x, c.y]).precision(0.25);

/** 在球面上把形状从 src 平移到 dst（保持真实大小与形状），返回点变换 */
export const moveRotation = (src: [number, number], dst: [number, number]) => {
  const r1 = d3.geoRotation([-src[0], 0]);
  const r2 = d3.geoRotation([0, -(src[1] - dst[1])]);
  const r3 = d3.geoRotation([dst[0], 0]);
  return (p: [number, number]) => r3(r2(r1(p))) as [number, number];
};

/** 返回一个“可传给 geoPath 的投影”：先在球面上移动形状，再投影 */
export const movedProjection = (proj: d3.GeoProjection, src: [number, number], dst: [number, number]) => {
  const rot = moveRotation(src, dst);
  const tf = d3.geoTransform({
    point(x: number, y: number) {
      const p = rot([x, y]);
      (this as any).stream.point(p[0], p[1]);
    },
  });
  return { stream: (s: any) => tf.stream(proj.stream(s)) } as any;
};

/** 非洲内部均匀分布的采样点（用于“14 个格陵兰”铺满非洲） */
export const africaSpots = (n: number) => {
  const cand: [number, number][] = [];
  for (let lat = -30; lat <= 33; lat += 1.5)
    for (let lon = -15; lon <= 48; lon += 1.5) if (d3.geoContains(AFRICA, [lon, lat])) cand.push([lon, lat]);
  // 最远点采样，起点取非洲中部
  const pick: [number, number][] = [[20, 4]];
  const dist = (a: [number, number], b: [number, number]) => d3.geoDistance(a, b);
  while (pick.length < n) {
    let best = cand[0];
    let bd = -1;
    for (const c of cand) {
      const m = Math.min(...pick.map((p) => dist(p, c)));
      if (m > bd) {
        bd = m;
        best = c;
      }
    }
    pick.push(best);
  }
  return pick;
};

export const geoPathOf = (proj: any) => d3.geoPath(proj);
export const graticule = d3.geoGraticule().step([15, 15]).extentMajor([[-180, -85], [180, 85.01]])();
