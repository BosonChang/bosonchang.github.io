// Pure matching logic — no DOM access, so it can run under Node for tests
// and in the browser for the live matcher page.

// Rating dimensions are on a 1-10 scale (range 9); weight is blade grams on a
// 70-95 scale (range 25). These ranges normalize each dimension's distance
// contribution and must match the slider min/max set in index.html.
export const TARGET_RANGES = { speed: 9, spin: 9, control: 9, weight: 25 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

// Scales a raw spec onto the 1-10 rating scale.
function normalizeToTen(value, min, max) {
  const scaled = ((value - min) / (max - min)) * 10;
  return clamp(scaled, 1, 10);
}

// Sources publish ratings on different scales. This adds the 1-10 ratings used
// by the matcher: published 0-100 ratings are divided by 10. Butterfly blades
// only publish reaction/vibration, so blade speed scales reaction 9-12.5 onto
// 1-10 and blade control is inverted vibration (13 = 1, 7 = 10), a heuristic.
// Butterfly rubbers publish arc, used as the rubber control rating (arc / 10).
export function withRatings(catalog) {
  return {
    ...catalog,
    blades: catalog.blades.map((blade) => ({
      ...blade,
      speed: blade.speedRating != null ? round1(blade.speedRating / 10) : round1(normalizeToTen(blade.reaction, 9, 12.5)),
      control: blade.controlRating != null ? round1(blade.controlRating / 10) : round1(normalizeToTen(13 - blade.vibration, 0, 6))
    })),
    rubbers: catalog.rubbers.map((rubber) => ({
      ...rubber,
      speed: round1(rubber.speed / 10),
      spin: round1(rubber.spin / 10),
      control: round1((rubber.control ?? rubber.arc) / 10)
    }))
  };
}

// Handle codes used in the catalog: FL (flared), ST (straight), AN (anatomic).
export function bladeHasHandle(blade, code) {
  if (!blade.handles) return false;
  return blade.handles.toUpperCase().split(/[ ,/]+/).includes(code);
}

// Combines one blade and two rubbers into the setup-level stats shown in the UI.
// Blade weight is null when the source lists no gram weight.
export function computeSetupStats(blade, forehand, backhand) {
  return {
    speed: round1(blade.speed * 0.4 + forehand.speed * 0.35 + backhand.speed * 0.25),
    spin: round1(forehand.spin * 0.6 + backhand.spin * 0.4),
    control: round1(blade.control * 0.4 + forehand.control * 0.3 + backhand.control * 0.3),
    weight: blade.weightG ?? null
  };
}

function axisDistance(a, b, range) {
  return Math.abs(a - b) / range;
}

// Distance of one rubber from optional per-side targets { speed, spin, control }.
function sideDistance(rubber, target) {
  if (!target) return 0;
  return (
    axisDistance(rubber.speed, target.speed, TARGET_RANGES.speed) +
    axisDistance(rubber.spin, target.spin, TARGET_RANGES.spin) +
    axisDistance(rubber.control, target.control, TARGET_RANGES.control)
  );
}

// Scans the pools for the blade + forehand + backhand combination closest to the
// targets { speed, spin, control, weight, forehand?, backhand? }. The optional
// forehand/backhand targets add a per-rubber distance for the advanced mode.
// catalog.forehands / catalog.backhands optionally narrow each side (e.g. a locked
// pick); they default to catalog.rubbers. Deterministic: iterates in a fixed order
// and keeps the first strictly-closer match.
export function recommendSetup(catalog, targets) {
  const forehands = catalog.forehands ?? catalog.rubbers;
  const backhands = catalog.backhands ?? catalog.rubbers;
  let best = null;
  for (const blade of catalog.blades) {
    for (const forehand of forehands) {
      for (const backhand of backhands) {
        const stats = computeSetupStats(blade, forehand, backhand);
        const distance =
          axisDistance(stats.speed, targets.speed, TARGET_RANGES.speed) +
          axisDistance(stats.spin, targets.spin, TARGET_RANGES.spin) +
          axisDistance(stats.control, targets.control, TARGET_RANGES.control) +
          // Blades without a published gram weight are not penalized on weight.
          (stats.weight == null ? 0 : axisDistance(stats.weight, targets.weight, TARGET_RANGES.weight)) +
          sideDistance(forehand, targets.forehand) +
          sideDistance(backhand, targets.backhand);
        if (!best || distance < best.distance) {
          best = { blade, forehand, backhand, stats, distance };
        }
      }
    }
  }
  return best;
}
