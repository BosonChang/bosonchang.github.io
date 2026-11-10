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
  const r1 = (v) => Math.round(v * 10) / 10;
  const fhDist = forehands.map((f) => sideDistance(f, targets.forehand));
  const bhDist = backhands.map((h) => sideDistance(h, targets.backhand));
  // One scan with plain numbers (no per-combination objects), then an exact check of the
  // near-best combinations. The scan uses unrounded stats and remembers every combination
  // within a window of the best unrounded distance so far. Displayed stats are rounded to
  // 0.1, which moves each of the three axis terms by at most 0.05 / range, so the exact
  // winner is always within 2 * ROUND_SLACK of the smallest unrounded distance. Only those
  // few candidates get the exact (rounded) distance. Ties resolve to the first (blade,
  // forehand, backhand) in catalog order, as a plain scan would.
  const ROUND_SLACK = 0.05 / TARGET_RANGES.speed + 0.05 / TARGET_RANGES.spin + 0.05 / TARGET_RANGES.control + 1e-9;
  const nh = backhands.length;
  const n = forehands.length * nh;
  const pSpeed = new Float64Array(n);
  const pControl = new Float64Array(n);
  const pFloor = new Float64Array(n); // spin + per-side target terms: independent of the blade
  for (let f = 0; f < forehands.length; f += 1) {
    for (let h = 0; h < nh; h += 1) {
      const p = f * nh + h;
      pSpeed[p] = forehands[f].speed * 0.35 + backhands[h].speed * 0.25;
      pControl[p] = forehands[f].control * 0.3 + backhands[h].control * 0.3;
      pFloor[p] = Math.abs(forehands[f].spin * 0.6 + backhands[h].spin * 0.4 - targets.spin) / TARGET_RANGES.spin + fhDist[f] + bhDist[h];
    }
  }
  // Blades without a published gram weight are not penalized on weight.
  const weightTerms = catalog.blades.map((blade) => (blade.weightG == null ? 0 : axisDistance(blade.weightG, targets.weight, TARGET_RANGES.weight)));
  const candB = [];
  const candP = [];
  const candU = [];
  let minUnrounded = Infinity;
  for (let b = 0; b < catalog.blades.length; b += 1) {
    const bs = catalog.blades[b].speed * 0.4 - targets.speed;
    const bc = catalog.blades[b].control * 0.4 - targets.control;
    const wt = weightTerms[b];
    for (let p = 0; p < n; p += 1) {
      const u = Math.abs(bs + pSpeed[p]) / TARGET_RANGES.speed + pFloor[p] + Math.abs(bc + pControl[p]) / TARGET_RANGES.control + wt;
      if (u <= minUnrounded + 2 * ROUND_SLACK) {
        if (u < minUnrounded) minUnrounded = u;
        candB.push(b);
        candP.push(p);
        candU.push(u);
      }
    }
  }
  const limit = minUnrounded + 2 * ROUND_SLACK;
  let bestDistance = Infinity;
  let bestB = -1;
  let bestF = -1;
  let bestH = -1;
  let bestOrder = -1;
  for (let c = 0; c < candB.length; c += 1) {
    if (candU[c] > limit) continue;
    const b = candB[c];
    const p = candP[c];
    const f = Math.floor(p / nh);
    const h = p - f * nh;
    const blade = catalog.blades[b];
    const fh = forehands[f];
    const bh = backhands[h];
    const speed = r1(blade.speed * 0.4 + fh.speed * 0.35 + bh.speed * 0.25);
    const spin = r1(fh.spin * 0.6 + bh.spin * 0.4);
    const control = r1(blade.control * 0.4 + fh.control * 0.3 + bh.control * 0.3);
    const distance =
      Math.abs(speed - targets.speed) / TARGET_RANGES.speed +
      Math.abs(spin - targets.spin) / TARGET_RANGES.spin +
      Math.abs(control - targets.control) / TARGET_RANGES.control +
      weightTerms[b] +
      fhDist[f] +
      bhDist[h];
    // Candidates arrive in (blade, forehand, backhand) order, so a strict < keeps the first tie.
    if (distance < bestDistance) {
      bestDistance = distance;
      bestB = b;
      bestF = f;
      bestH = h;
    }
  }
  const blade = catalog.blades[bestB];
  const forehand = forehands[bestF];
  const backhand = backhands[bestH];
  return { blade, forehand, backhand, stats: computeSetupStats(blade, forehand, backhand), distance: bestDistance };
}
