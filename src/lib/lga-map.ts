import { ABIA_LGA_SHAPES } from "./abia-lga-geo";
import type { Lga } from "./types";

/*
 * Projects the Abia LGA boundaries into SVG paths for the dashboard map.
 * Shared by the webapp, PWA and native app (keep the copies identical).
 */

export interface LgaMapShape {
  /** boundary name (geoBoundaries) */
  name: string;
  /** the dashboard LGA this shape belongs to, when it can be matched */
  lga: Lga | null;
  /** SVG path data in map coordinates */
  path: string;
  /** label anchor in map coordinates */
  label: [number, number];
}

export interface LgaMapGeometry {
  width: number;
  height: number;
  shapes: LgaMapShape[];
}

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Finds the dashboard LGA for a boundary name. Names differ slightly between
 * sources ("Osisioma" vs "Osisioma Ngwa", "Umunneochi" vs "Umu Nneochi"), so
 * match on letters only and fall back to a prefix match.
 */
export function matchLga(shapeName: string, lgas: Lga[]): Lga | null {
  const key = normalize(shapeName);
  const exact = lgas.find((l) => normalize(l.name) === key);
  if (exact) return exact;
  return lgas.find((l) => normalize(l.name).startsWith(key) || key.startsWith(normalize(l.name))) ?? null;
}

const cache = new Map<string, LgaMapGeometry>();

/** Equirectangular projection (latitude-corrected) scaled to `width`. */
export function lgaMapGeometry(lgas: Lga[], width: number, padding = 6): LgaMapGeometry {
  const cacheKey = `${width}:${padding}:${lgas.map((l) => l.id).join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const shape of ABIA_LGA_SHAPES) {
    for (const ring of shape.rings) {
      for (const [lon, lat] of ring) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const inner = Math.max(1, width - padding * 2);
  const scale = inner / ((maxLon - minLon) * kx);
  const height = Math.round((maxLat - minLat) * scale + padding * 2);
  const project = (lon: number, lat: number): [number, number] => [
    padding + (lon - minLon) * kx * scale,
    padding + (maxLat - lat) * scale,
  ];

  const shapes = ABIA_LGA_SHAPES.map((shape) => {
    let path = "";
    for (const ring of shape.rings) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        path += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      });
      path += "Z";
    }
    // Label at the mean of the outer ring — good enough for these compact LGAs.
    const outer = shape.rings[0];
    const [sx, sy] = outer.reduce(([ax, ay], [lon, lat]) => {
      const [x, y] = project(lon, lat);
      return [ax + x, ay + y];
    }, [0, 0]);
    return {
      name: shape.name,
      lga: matchLga(shape.name, lgas),
      path,
      label: [sx / outer.length, sy / outer.length] as [number, number],
    };
  });

  const geometry = { width, height, shapes };
  cache.set(cacheKey, geometry);
  return geometry;
}
