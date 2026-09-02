"use client";

import { useEffect, useRef, type RefObject } from "react";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type DessertKind =
  | "tangyuan" // 汤圆 - glutinous rice balls
  | "taro-ball" // 芋圆 - taro / sweet potato balls
  | "grass-jelly" // 烧仙草 - grass jelly cubes
  | "coconut-jelly" // 椰果 - coconut jelly cubes
  | "red-bean" // 红豆
  | "sago" // 西米
  | "mochi" // 麻薯
  | "boba" // 珍珠
  | "taro" // taro chunks
  | "mango"; // 芒果

/** Older name for {@link DessertKind}, kept so existing imports keep working. */
export type DessertType = DessertKind;

type ShapeKind =
  | "pearl"
  | "mochi"
  | "jelly-cube"
  | "chewy-cube"
  | "fruit-cube"
  | "bean";

type RGB = [number, number, number];
/** [normalisedX, normalisedY, size, alpha] */
type Dot = [number, number, number, number];
/** [normalisedY, curve, alpha] */
type Fiber = [number, number, number];

interface DessertAnimationProps {
  containerClassName?: string;
  /** How many pieces fall in total. */
  density?: number;
  /** Multiplier on gravity / terminal velocity. */
  speed?: number;
  /** Which desserts can appear. Defaults to a weighted house mix. */
  kinds?: DessertKind[];
  /**
   * Elements the desserts come to rest on, in document order (the menu
   * photos). Pieces steer towards them as they fall and settle on their top
   * edges. Only targets sharing a row with the first one are used, so a
   * side-by-side grid catches desserts on every photo while a stacked one
   * catches them on the first alone. Without any, pieces land at the bottom
   * of the overlay.
   */
  landingRefs?: RefObject<HTMLElement>[];
  /** Nudge the resting line down into the landing element, in px. */
  landingOffset?: number;
}

/** A surface pieces can come to rest on, in overlay-local coordinates. */
interface LandingZone {
  x0: number;
  x1: number;
  top: number;
}

/* ------------------------------------------------------------------ *
 * Colour helpers
 * ------------------------------------------------------------------ */

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const lighten = (c: RGB, t: number) => mix(c, WHITE, t);
const darken = (c: RGB, t: number) => mix(c, BLACK, t);
const rgba = (c: RGB, a = 1) =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`;

/* ------------------------------------------------------------------ *
 * Maths helpers
 * ------------------------------------------------------------------ */

/**
 * Deterministic PRNG. Every piece gets its own stream so its speckles, powder
 * and corner jitter are generated once and stay put — the previous version
 * called Math.random() inside the draw calls, which re-rolled the texture on
 * every frame and made the shapes boil.
 */
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const pickColor = (palette: RGB[], r: number): RGB =>
  palette[Math.floor(r * palette.length)] ?? WHITE;
const pickKind = (kinds: DessertKind[], r: number): DessertKind =>
  kinds[Math.floor(r * kinds.length)] ?? "tangyuan";

/* ------------------------------------------------------------------ *
 * Dessert definitions
 * ------------------------------------------------------------------ */

interface KindConfig {
  shape: ShapeKind;
  palette: RGB[];
  min: number;
  max: number;
  /** Denser pieces fall a little faster. */
  weight: number;
  alpha: number;
  gloss: number;
}

const DESSERTS: Record<DessertKind, KindConfig> = {
  tangyuan: {
    shape: "pearl",
    palette: [
      [252, 250, 245], // plain glutinous white
      [249, 214, 221], // rose
      [216, 234, 210], // pandan
      [255, 234, 210], // osmanthus
    ],
    min: 9,
    max: 14,
    weight: 1,
    alpha: 1,
    gloss: 0.85,
  },
  mochi: {
    shape: "mochi",
    palette: [
      [253, 251, 248],
      [248, 243, 236],
      [244, 237, 229],
    ],
    min: 9,
    max: 13,
    weight: 0.9,
    alpha: 1,
    gloss: 0.3,
  },
  "taro-ball": {
    shape: "chewy-cube",
    palette: [
      [186, 150, 205], // taro
      [166, 130, 190], // deep taro
      [226, 168, 116], // sweet potato
      [205, 224, 188], // pandan
    ],
    min: 7,
    max: 11,
    weight: 1.05,
    alpha: 1,
    gloss: 0.45,
  },
  taro: {
    shape: "chewy-cube",
    palette: [
      [192, 156, 212],
      [172, 136, 198],
    ],
    min: 8,
    max: 12,
    weight: 1,
    alpha: 1,
    gloss: 0.4,
  },
  "grass-jelly": {
    shape: "jelly-cube",
    palette: [
      [44, 35, 40],
      [32, 25, 29],
      [55, 44, 46],
    ],
    min: 8,
    max: 13,
    weight: 1.1,
    alpha: 0.9,
    gloss: 1,
  },
  "coconut-jelly": {
    shape: "jelly-cube",
    palette: [
      [251, 253, 251],
      [240, 247, 245],
      [231, 242, 240],
    ],
    min: 7,
    max: 11,
    weight: 0.85,
    alpha: 0.74,
    gloss: 1,
  },
  "red-bean": {
    shape: "bean",
    palette: [
      [138, 48, 52],
      [116, 37, 43],
      [158, 63, 60],
    ],
    min: 6,
    max: 9,
    weight: 1.15,
    alpha: 1,
    gloss: 0.35,
  },
  sago: {
    shape: "pearl",
    palette: [
      [252, 250, 246],
      [245, 241, 234],
    ],
    min: 3.5,
    max: 5.5,
    weight: 0.7,
    alpha: 0.95,
    gloss: 1,
  },
  boba: {
    shape: "pearl",
    palette: [
      [58, 38, 30],
      [43, 27, 21],
      [72, 47, 34],
    ],
    min: 7,
    max: 10,
    weight: 1.2,
    alpha: 1,
    gloss: 0.95,
  },
  mango: {
    shape: "fruit-cube",
    palette: [
      [250, 186, 56],
      [246, 164, 38],
      [252, 203, 86],
    ],
    min: 8,
    max: 12,
    weight: 0.95,
    alpha: 0.95,
    gloss: 0.8,
  },
};

/** Weighted by repetition — the house favourites show up more often. */
const DEFAULT_MIX: DessertKind[] = [
  "tangyuan",
  "tangyuan",
  "tangyuan",
  "taro-ball",
  "taro-ball",
  "taro-ball",
  "grass-jelly",
  "grass-jelly",
  "coconut-jelly",
  "coconut-jelly",
  "red-bean",
  "red-bean",
  "sago",
  "sago",
  "mango",
  "mango",
  "mochi",
  "boba",
  "taro",
];

/* ------------------------------------------------------------------ *
 * Physics
 * ------------------------------------------------------------------ */

const GRAVITY = 780; // px / s²
const TERMINAL = 620; // px / s
const RESTITUTION = 0.3;
const MAX_BOUNCES = 2;
const SPAWN_WINDOW = 2.2; // seconds over which pieces start falling

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  r: number,
) {
  const x = -w / 2;
  const y = -h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Glossy sphere — tangyuan, sago, boba. */
function drawPearl(ctx: CanvasRenderingContext2D, p: Particle) {
  const { r, color, alpha, gloss } = p;

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);

  const body = ctx.createRadialGradient(
    -r * 0.35,
    -r * 0.42,
    r * 0.05,
    0,
    0,
    r * 1.12,
  );
  body.addColorStop(0, rgba(lighten(color, 0.5), alpha));
  body.addColorStop(0.45, rgba(color, alpha));
  body.addColorStop(1, rgba(darken(color, 0.34), alpha));
  ctx.fillStyle = body;
  ctx.fill();

  // Warm bounce light coming back up off the surface below.
  const bounce = ctx.createRadialGradient(
    r * 0.42,
    r * 0.5,
    r * 0.04,
    r * 0.42,
    r * 0.5,
    r * 1.05,
  );
  bounce.addColorStop(0, rgba(lighten(color, 0.4), 0.45 * alpha));
  bounce.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = bounce;
  ctx.fill();

  // Specular hotspot.
  ctx.beginPath();
  ctx.ellipse(-r * 0.33, -r * 0.4, r * 0.27, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.72 * gloss})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-r * 0.14, -r * 0.56, r * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * gloss})`;
  ctx.fill();
}

/** Soft matte ball dusted with starch — mochi. */
function drawMochi(ctx: CanvasRenderingContext2D, p: Particle) {
  const { r, color, alpha } = p;

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  const body = ctx.createRadialGradient(
    -r * 0.3,
    -r * 0.34,
    r * 0.1,
    0,
    0,
    r * 1.16,
  );
  body.addColorStop(0, rgba(lighten(color, 0.32), alpha));
  body.addColorStop(0.6, rgba(color, alpha));
  body.addColorStop(1, rgba(darken(color, 0.2), alpha));
  ctx.fillStyle = body;
  ctx.fill();

  // Mochi is matte: a broad soft highlight rather than a sharp specular.
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.34, r * 0.44, r * 0.3, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.26)";
  ctx.fill();

  for (const [nx, ny, size, a] of p.dots) {
    ctx.beginPath();
    ctx.arc(nx * r * 0.86, ny * r * 0.86, size * r * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
    ctx.fill();
  }
}

/** Translucent glossy cube — grass jelly, coconut jelly. */
function drawJellyCube(ctx: CanvasRenderingContext2D, p: Particle) {
  const { r, color, alpha, gloss } = p;
  const w = r * 1.85 * p.aspect;
  const h = r * 1.7;
  const rad = r * 0.4;

  roundedRectPath(ctx, w, h, rad);

  const body = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  body.addColorStop(0, rgba(lighten(color, 0.3), alpha));
  body.addColorStop(0.55, rgba(color, alpha));
  body.addColorStop(1, rgba(darken(color, 0.26), alpha));
  ctx.fillStyle = body;
  ctx.fill();

  // Bright edge — light refracting through the block.
  ctx.strokeStyle = rgba(lighten(color, 0.55), 0.4 * alpha);
  ctx.lineWidth = Math.max(0.6, r * 0.07);
  ctx.stroke();

  ctx.save();
  ctx.clip();

  // Inner glow gives the block some depth instead of reading flat.
  const glow = ctx.createRadialGradient(
    -w * 0.1,
    -h * 0.1,
    r * 0.05,
    0,
    0,
    r * 1.3,
  );
  glow.addColorStop(0, `rgba(255, 255, 255, ${0.2 * gloss})`);
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // Main gloss streak plus a smaller kicker.
  ctx.beginPath();
  ctx.ellipse(-w * 0.18, -h * 0.24, w * 0.3, h * 0.13, -0.7, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.42 * gloss})`;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(w * 0.2, h * 0.22, w * 0.13, h * 0.07, -0.7, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.18 * gloss})`;
  ctx.fill();

  ctx.restore();
}

/** Matte, springy cube with flecks — taro balls, taro chunks. */
function drawChewyCube(ctx: CanvasRenderingContext2D, p: Particle) {
  const { r, color, alpha, gloss } = p;
  const w = r * 1.78 * p.aspect;
  const h = r * 1.66;
  const rad = r * 0.5;

  roundedRectPath(ctx, w, h, rad);

  const body = ctx.createLinearGradient(-w * 0.3, -h * 0.45, w * 0.25, h * 0.5);
  body.addColorStop(0, rgba(lighten(color, 0.3), alpha));
  body.addColorStop(0.5, rgba(color, alpha));
  body.addColorStop(1, rgba(darken(color, 0.24), alpha));
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  ctx.clip();

  ctx.beginPath();
  ctx.ellipse(-w * 0.2, -h * 0.3, w * 0.28, h * 0.13, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * gloss + 0.12})`;
  ctx.fill();

  // Pale flecks — the giveaway texture of a real taro ball.
  for (const [nx, ny, size, a] of p.dots) {
    ctx.beginPath();
    ctx.arc(nx * w * 0.42, ny * h * 0.42, size * r * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.8})`;
    ctx.fill();
  }

  ctx.restore();
}

/** Juicy translucent chunk with fibres — mango. */
function drawFruitCube(ctx: CanvasRenderingContext2D, p: Particle) {
  const { r, color, alpha, gloss } = p;
  const w = r * 1.72 * p.aspect;
  const h = r * 1.6;
  const rad = r * 0.28;

  roundedRectPath(ctx, w, h, rad);

  const body = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  body.addColorStop(0, rgba(lighten(color, 0.36), alpha));
  body.addColorStop(0.5, rgba(color, alpha));
  body.addColorStop(1, rgba(darken(color, 0.22), alpha));
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  ctx.clip();

  for (const [ny, curve, a] of p.fibers) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, ny * h * 0.4);
    ctx.quadraticCurveTo(0, ny * h * 0.4 + curve * h * 0.16, w * 0.5, ny * h * 0.4);
    ctx.strokeStyle = `rgba(255, 245, 214, ${a})`;
    ctx.lineWidth = Math.max(0.5, r * 0.07);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.ellipse(-w * 0.16, -h * 0.27, w * 0.3, h * 0.12, -0.65, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.45 * gloss})`;
  ctx.fill();

  ctx.restore();
}

/** Kidney-shaped bean with its pale hilum stripe — red bean. */
function drawBean(ctx: CanvasRenderingContext2D, p: Particle) {
  const { r, color, alpha } = p;
  const w = r * 2.05;
  const h = r * 1.32;

  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.08);
  // Top edge dips in the middle to give the kidney silhouette.
  ctx.bezierCurveTo(-w * 0.48, -h * 0.78, -w * 0.14, -h * 0.5, 0, -h * 0.26);
  ctx.bezierCurveTo(w * 0.14, -h * 0.5, w * 0.48, -h * 0.78, w / 2, h * 0.08);
  ctx.bezierCurveTo(w * 0.48, h * 0.86, -w * 0.48, h * 0.86, -w / 2, h * 0.08);
  ctx.closePath();

  const body = ctx.createRadialGradient(
    -w * 0.16,
    -h * 0.2,
    r * 0.06,
    0,
    0,
    w * 0.62,
  );
  body.addColorStop(0, rgba(lighten(color, 0.34), alpha));
  body.addColorStop(0.55, rgba(color, alpha));
  body.addColorStop(1, rgba(darken(color, 0.34), alpha));
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  ctx.clip();

  // Hilum: the pale scar along the bean's inner curve.
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.12, w * 0.2, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fillStyle = rgba(lighten(color, 0.55), 0.5 * alpha);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-w * 0.2, -h * 0.26, w * 0.16, h * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.fill();

  ctx.restore();
}

const DRAW: Record<
  ShapeKind,
  (ctx: CanvasRenderingContext2D, p: Particle) => void
> = {
  pearl: drawPearl,
  mochi: drawMochi,
  "jelly-cube": drawJellyCube,
  "chewy-cube": drawChewyCube,
  "fruit-cube": drawFruitCube,
  bean: drawBean,
};

/* ------------------------------------------------------------------ *
 * Particle
 * ------------------------------------------------------------------ */

interface Particle {
  shape: ShapeKind;
  color: RGB;
  alpha: number;
  gloss: number;
  weight: number;
  r: number;
  aspect: number;

  x: number;
  y: number;
  x0: number;
  y0: number;
  xTarget: number;
  vy: number;

  rot: number;
  spin: number;
  swayPhase: number;
  swayAmp: number;
  swaySpeed: number;

  delay: number;
  landY: number;
  /**
   * Stable 0..1 seed used to choose the landing zone. Kept instead of a plain
   * index so that resizing across the xl breakpoint — where the photos go from
   * stacked (one zone) to side by side (two) — redistributes the pieces
   * instead of stranding them all on the first photo.
   */
  zoneR: number;
  /** Index derived from zoneR for the current layout. */
  zone: number;
  /** Where across that zone the piece lands, 0..1, so a resize can re-derive it. */
  zoneT: number;
  /** Per-piece wobble on the resting line so the row doesn't look ruled. */
  landJitter: number;
  bounces: number;
  resting: boolean;
  squash: number;
  squashV: number;
  settleT: number;

  dots: Dot[];
  fibers: Fiber[];
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export function DessertAnimation({
  containerClassName = "",
  density = 34,
  speed = 1,
  kinds = DEFAULT_MIX,
  landingRefs,
  landingOffset = 0,
}: DessertAnimationProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Held in a ref rather than a dependency: callers pass an inline array, and
  // its changing identity would otherwise restart the animation every render.
  const landingRefsRef = useRef(landingRefs);
  landingRefsRef.current = landingRefs;

  // Compared by value so a new-but-equal kinds array doesn't restart things.
  const kindsKey = kinds.join(",");

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const rng = mulberry32(0x5eed);
    const kindList = kinds.length > 0 ? kinds : DEFAULT_MIX;

    let cssW = 0;
    let cssH = 0;
    let zones: LandingZone[] = [];

    /* -- layout ---------------------------------------------------- */

    const fallbackZone = (): LandingZone => ({
      x0: 0,
      x1: Math.max(1, cssW),
      top: Math.max(1, cssH - 8),
    });

    const measure = () => {
      const hostRect = host.getBoundingClientRect();
      cssW = hostRect.width;
      cssH = hostRect.height;

      const rects = (landingRefsRef.current ?? [])
        .map((ref) => ref?.current)
        .filter((el): el is HTMLElement => Boolean(el))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 8 && r.height > 8);

      const first = rects[0];
      if (first) {
        // Keep only the targets sharing a row with the first. Side by side
        // (xl:grid-cols-2) that catches every photo; once the grid collapses
        // to one column the rest sit far below, so desserts stop at the first.
        const sameRow = rects.filter((r) => {
          const overlap =
            Math.min(r.bottom, first.bottom) - Math.max(r.top, first.top);
          return overlap > 0.5 * Math.min(r.height, first.height);
        });

        zones = sameRow.map((r) => ({
          x0: r.left - hostRect.left,
          x1: r.right - hostRect.left,
          top: r.top - hostRect.top + landingOffset,
        }));
      } else {
        zones = [];
      }

      // Guard against targets that haven't laid out yet.
      zones = zones.filter(
        (z) => Number.isFinite(z.top) && z.top > 0 && z.x1 - z.x0 >= 40,
      );
      if (zones.length === 0) zones = [fallbackZone()];

      // Keep the backing store sharp but bounded — this overlay can be a few
      // thousand px tall, and an unbounded DPR canvas gets very expensive.
      const rawDpr = Math.min(window.devicePixelRatio || 1, 2);
      const maxPixels = 8_000_000;
      const area = cssW * cssH * rawDpr * rawDpr;
      const dpr = area > maxPixels ? Math.sqrt(maxPixels / (cssW * cssH)) : rawDpr;

      const nextW = Math.max(1, Math.round(cssW * dpr));
      const nextH = Math.max(1, Math.round(cssH * dpr));

      // Assigning width/height wipes the canvas, so only do it on a real
      // change — otherwise every stray resize notification erases the frame.
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    measure();

    /* -- build particles ------------------------------------------- */

    const zoneWidth = (z: LandingZone) => Math.max(1, z.x1 - z.x0);
    const zoneInset = (z: LandingZone) => Math.min(24, zoneWidth(z) * 0.05);

    /** Wider photos catch proportionally more, so coverage looks even. */
    const pickZoneIndex = (r: number) => {
      const total = zones.reduce((sum, z) => sum + zoneWidth(z), 0);
      let t = r * total;
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        if (!z) continue;
        const w = zoneWidth(z);
        if (t < w) return i;
        t -= w;
      }
      return zones.length - 1;
    };

    const targetXFor = (z: LandingZone, t: number) => {
      const inset = zoneInset(z);
      return lerp(z.x0 + inset, z.x1 - inset, t);
    };

    const makeParticle = (): Particle => {
      const kind = pickKind(kindList, rng());
      const cfg = DESSERTS[kind];
      const r = lerp(cfg.min, cfg.max, rng());

      const dots: Dot[] = [];
      const dotCount =
        cfg.shape === "mochi" ? 14 : cfg.shape === "chewy-cube" ? 9 : 0;
      for (let i = 0; i < dotCount; i++) {
        const angle = rng() * Math.PI * 2;
        const dist = cfg.shape === "mochi" ? 0.72 + rng() * 0.24 : rng() * 0.95;
        dots.push([
          Math.cos(angle) * dist,
          Math.sin(angle) * dist,
          0.5 + rng() * 0.9,
          0.28 + rng() * 0.4,
        ]);
      }

      const fibers: Fiber[] = [];
      if (cfg.shape === "fruit-cube") {
        const count = 3 + Math.floor(rng() * 2);
        for (let i = 0; i < count; i++) {
          fibers.push([
            (i / (count - 1 || 1)) * 1.4 - 0.7,
            rng() * 2 - 1,
            0.16 + rng() * 0.18,
          ]);
        }
      }

      const zoneR = rng();
      const zone = pickZoneIndex(zoneR);
      const z = zones[zone] ?? fallbackZone();
      const zoneT = rng();
      const landJitter = rng() * 9 - 3;
      const xTarget = targetXFor(z, zoneT);

      // Start roughly above where it will land so the piece drops more or
      // less straight down; with two photos side by side a full-width spawn
      // would drag everything across the gap.
      const x0 = clamp(xTarget + (rng() - 0.5) * 260, 4, Math.max(8, cssW - 4));
      const y0 = -20 - rng() * 220;

      return {
        shape: cfg.shape,
        color: pickColor(cfg.palette, rng()),
        alpha: cfg.alpha,
        gloss: cfg.gloss,
        weight: cfg.weight,
        r,
        aspect: 0.9 + rng() * 0.22,

        x: x0,
        y: y0,
        x0,
        y0,
        xTarget,
        vy: 0,

        rot: rng() * Math.PI * 2,
        spin: (rng() * 2 - 1) * 1.1,
        swayPhase: rng() * Math.PI * 2,
        swayAmp: 14 + rng() * 26,
        swaySpeed: 0.7 + rng() * 0.9,

        delay: rng() * SPAWN_WINDOW,
        landY: z.top - r + landJitter,
        zoneR,
        zone,
        zoneT,
        landJitter,
        bounces: 0,
        resting: false,
        squash: 1,
        squashV: 0,
        settleT: 0,

        dots,
        fibers,
      };
    };

    const particles: Particle[] = [];
    for (let i = 0; i < density; i++) particles.push(makeParticle());

    /* -- relayout on resize ---------------------------------------- */

    const relayout = () => {
      const prevW = cssW || 1;
      measure();
      const scaleX = cssW / prevW;

      for (const p of particles) {
        // Re-derived because crossing the xl breakpoint changes how many
        // photos share the row, and the pieces should spread over whatever
        // set is current.
        p.zone = pickZoneIndex(p.zoneR);
        const z = zones[p.zone] ?? fallbackZone();

        p.x *= scaleX;
        p.x0 *= scaleX;
        p.xTarget = targetXFor(z, p.zoneT);
        p.landY = z.top - p.r + p.landJitter;

        if (p.resting) {
          p.x = p.xTarget;
          p.y = p.landY;
        }
      }
    };

    /* -- draw ------------------------------------------------------ */

    const drawParticle = (p: Particle) => {
      // Soft ambient halo. The page background is a pale cream, so the white
      // and translucent pieces (sago, coconut jelly, tangyuan) would otherwise
      // wash out into it. Drawn unrotated so the light direction stays put.
      const halo = ctx.createRadialGradient(
        p.x,
        p.y + p.r * 0.18,
        p.r * 0.25,
        p.x,
        p.y + p.r * 0.18,
        p.r * 1.4,
      );
      halo.addColorStop(0, "rgba(124, 76, 45, 0.26)");
      halo.addColorStop(0.55, "rgba(124, 76, 45, 0.12)");
      halo.addColorStop(1, "rgba(124, 76, 45, 0)");
      ctx.beginPath();
      ctx.arc(p.x, p.y + p.r * 0.18, p.r * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      // Contact shadow fades in as the piece comes to rest.
      if (p.settleT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.15 * p.settleT;
        ctx.beginPath();
        ctx.ellipse(
          p.x,
          p.landY + p.r * 0.94,
          p.r * 1.2,
          p.r * 0.3,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = "rgb(92, 52, 32)";
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      // Squash-and-stretch keeps volume, and the offset keeps the piece's
      // bottom planted on the landing line while it compresses.
      ctx.translate(p.x, p.y + p.r * (1 - p.squash));
      ctx.rotate(p.rot);
      ctx.scale(1 / p.squash, p.squash);
      DRAW[p.shape](ctx, p);
      ctx.restore();
    };

    const drawAll = () => {
      ctx.clearRect(0, 0, cssW, cssH);
      for (const p of particles) drawParticle(p);
    };

    // The photos resize independently of the overlay (images finish decoding,
    // the grid flips between one and two columns), so watch each of them too.
    const observeLandingTargets = (ro: ResizeObserver) => {
      for (const ref of landingRefsRef.current ?? []) {
        if (ref?.current) ro.observe(ref.current);
      }
    };

    /* -- reduced motion: show the settled result, no animation ----- */

    if (reduceMotion) {
      for (const p of particles) {
        p.y = p.landY;
        p.x = p.xTarget;
        p.resting = true;
        p.settleT = 1;
        p.rot = 0;
      }
      drawAll();

      const ro = new ResizeObserver(() => {
        relayout();
        for (const p of particles) p.y = p.landY;
        drawAll();
      });
      ro.observe(host);
      observeLandingTargets(ro);
      return () => ro.disconnect();
    }

    /* -- animation loop -------------------------------------------- */

    let raf = 0;
    let finished = false;
    let elapsed = 0;
    let last = performance.now();

    const gravity = GRAVITY * speed;
    const terminal = TERMINAL * speed;

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      elapsed += dt;

      ctx.clearRect(0, 0, cssW, cssH);

      let done = true;

      for (const p of particles) {
        if (elapsed < p.delay) {
          done = false;
          continue;
        }

        if (!p.resting) {
          done = false;

          p.vy = Math.min(p.vy + gravity * p.weight * dt, terminal * p.weight);
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
          p.swayPhase += p.swaySpeed * dt;

          // Steer towards the landing target as it descends, so every piece
          // ends up on the menu photo rather than in mid-air.
          const t = clamp(
            (p.y - p.y0) / Math.max(1, p.landY - p.y0),
            0,
            1,
          );
          p.x =
            lerp(p.x0, p.xTarget, easeInOutCubic(t)) +
            Math.sin(p.swayPhase) * p.swayAmp * (1 - t * 0.75);

          if (p.y >= p.landY) {
            p.y = p.landY;
            if (p.vy > 90 && p.bounces < MAX_BOUNCES) {
              p.squashV = -p.vy * 0.0022;
              p.vy = -p.vy * RESTITUTION;
              p.bounces += 1;
              p.spin *= 0.4;
            } else {
              p.resting = true;
              p.vy = 0;
              p.spin = 0;
              p.squashV = -0.3;
            }
          }
        }

        // Spring the squash back to neutral.
        p.squashV += (1 - p.squash) * 150 * dt;
        p.squashV *= Math.max(0, 1 - 13 * dt);
        p.squash += p.squashV * dt;
        p.squash = clamp(p.squash, 0.55, 1.35);

        if (p.resting) {
          p.settleT = Math.min(1, p.settleT + dt * 2.4);
          const settled =
            Math.abs(p.squash - 1) < 0.004 &&
            Math.abs(p.squashV) < 0.02 &&
            p.settleT >= 1;
          if (!settled) done = false;
        }

        drawParticle(p);
      }

      if (!done) {
        raf = requestAnimationFrame(step);
      } else {
        // Everything has landed — snap to a clean final frame and stop.
        for (const p of particles) {
          p.squash = 1;
          p.squashV = 0;
        }
        raf = 0;
        finished = true;
        drawAll();
      }
    };

    raf = requestAnimationFrame(step);

    const ro = new ResizeObserver(() => {
      relayout();
      // The loop repaints every frame while it runs; once it has stopped the
      // resting pile has to be repainted here or the resize leaves it blank.
      if (finished) drawAll();
    });
    ro.observe(host);
    observeLandingTargets(ro);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, speed, kindsKey, landingOffset]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-10 overflow-hidden ${containerClassName}`}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
