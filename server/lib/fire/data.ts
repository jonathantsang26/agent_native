import { PNG } from "pngjs";

/**
 * Read access to one fire's files (the same files the map serves from
 * public/data/<fire>/). Actions get them from the bundled set in store.ts;
 * tests read them from disk.
 */

export const FIRE_ID = /^[a-z0-9_-]{1,40}$/;

export type Aoi = {
  name: string;
  location: string;
  timezone: string;
  bbox: [number, number, number, number];
  center: [number, number];
  window_utc: [string, string];
  official: {
    final_acres: number | null;
    alarm_date: string | null;
    containment_date: string | null;
    incident?: {
      start_utc: string;
      reported_location: [number, number];
      source: string;
    };
  };
};
export type DemMeta = { bounds: [number, number, number, number] };

export type ArrivalRaster = {
  width: number;
  height: number;
  bounds: [number, number, number, number];
  startMs: number;
  windowMs: number;
  /** RGBA, row 0 = north. */
  rgba: Uint8Array;
};

export type ArrivalSample =
  | { inBounds: false }
  | { inBounds: true; burned: false; confidence: number }
  | { inBounds: true; burned: true; ms: number; confidence: number };

export class MissingDataError extends Error {}

/** Where a store's files come from. Both calls return undefined for a file the fire lacks. */
export interface FireFiles {
  json(file: string): unknown | undefined;
  bytes(file: string): Uint8Array | undefined;
}

export class FireStore {
  private readonly cache = new Map<string, unknown>();

  constructor(
    readonly fire: string,
    private readonly files: FireFiles,
  ) {
    if (!FIRE_ID.test(fire))
      throw new Error(`invalid fire id: ${JSON.stringify(fire)}`);
  }

  exists(): boolean {
    return this.has("aoi.json");
  }

  has(file: string): boolean {
    return file.endsWith(".png")
      ? this.files.bytes(file) !== undefined
      : this.files.json(file) !== undefined;
  }

  json<T>(file: string): T {
    const value = this.files.json(file);
    if (value === undefined)
      throw new MissingDataError(`${this.fire}/${file} is not available`);
    return value as T;
  }

  optionalJson<T>(file: string): T | null {
    return this.has(file) ? this.json<T>(file) : null;
  }

  /** A value derived from one file, computed once per store. */
  derived<T>(file: string, tag: string, build: (store: FireStore) => T): T {
    const key = `${tag}:${file}`;
    if (!this.cache.has(key)) {
      this.json(file);
      this.cache.set(key, build(this));
    }
    return this.cache.get(key) as T;
  }

  aoi(): Aoi {
    return this.json<Aoi>("aoi.json");
  }

  arrival(): ArrivalRaster {
    const hit = this.cache.get("arrival");
    if (hit) return hit as ArrivalRaster;
    const bytes = this.files.bytes("arrival.png");
    if (!bytes)
      throw new MissingDataError(`${this.fire}/arrival.png is not available`);
    const png = PNG.sync.read(Buffer.from(bytes));
    const aoi = this.aoi();
    const [w0, w1] = aoi.window_utc.map(Date.parse) as [number, number];
    const raster: ArrivalRaster = {
      width: png.width,
      height: png.height,
      bounds: this.json<DemMeta>("dem.json").bounds,
      startMs: w0,
      windowMs: w1 - w0,
      rgba: new Uint8Array(
        png.data.buffer,
        png.data.byteOffset,
        png.data.byteLength,
      ),
    };
    this.cache.set("arrival", raster);
    return raster;
  }
}

/**
 * Decodes one cell: red 1..254 → (code−1)/253 of the window, 255 → never burned, green →
 * confidence. The PNG spans dem.json bounds with row 0 = north, at its own width/height.
 */
export function sampleArrival(
  r: ArrivalRaster,
  lon: number,
  lat: number,
): ArrivalSample {
  const [w, s, e, n] = r.bounds;
  const col = Math.floor(((lon - w) / (e - w)) * r.width);
  const row = Math.floor(((n - lat) / (n - s)) * r.height);
  if (col < 0 || row < 0 || col >= r.width || row >= r.height)
    return { inBounds: false };
  const i = (row * r.width + col) * 4;
  const code = r.rgba[i];
  const confidence = r.rgba[i + 1] / 255;
  if (code < 1 || code > 254) return { inBounds: true, burned: false, confidence };
  return {
    inBounds: true,
    burned: true,
    ms: r.startMs + ((code - 1) / 253) * r.windowMs,
    confidence,
  };
}

/** Minutes per arrival code step: the time resolution of arrival.png. */
export function arrivalStepMin(r: ArrivalRaster): number {
  return r.windowMs / 253 / 60_000;
}
