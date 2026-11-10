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

// Rubber pairs are indexed once per pair of pools: stats of every (forehand, backhand) pair in
// flat typed arrays, bucketed by pair spin (0.01 wide). The index only depends on the pools, not
// on the targets, so slider moves reuse it.
const SPIN_BUCKET = 0.01;
const SPIN_BUCKETS = 1101;
let pairCache = { key: "", index: null };

function pairIndex(forehands, backhands) {
  const key = forehands.map((f) => f.id).join(",") + "|" + backhands.map((h) => h.id).join(",");
  if (pairCache.key === key) return pairCache.index;
  const nh = backhands.length;
  const n = forehands.length * nh;
  const speed = new Float64Array(n);
  const spin = new Float64Array(n);
  const control = new Float64Array(n);
  const fIndex = new Int32Array(n);
  const hIndex = new Int32Array(n);
  const bucketOf = new Int32Array(n);
  const starts = new Int32Array(SPIN_BUCKETS + 1);
  const range = { speed: [Infinity, -Infinity], spin: [Infinity, -Infinity], control: [Infinity, -Infinity] };
  const widen = (name, value) => {
    if (value < range[name][0]) range[name][0] = value;
    if (value > range[name][1]) range[name][1] = value;
  };
  for (let f = 0; f < forehands.length; f += 1) {
    for (let h = 0; h < nh; h += 1) {
      const p = f * nh + h;
      speed[p] = forehands[f].speed * 0.35 + backhands[h].speed * 0.25;
      spin[p] = forehands[f].spin * 0.6 + backhands[h].spin * 0.4;
      control[p] = forehands[f].control * 0.3 + backhands[h].control * 0.3;
      fIndex[p] = f;
      hIndex[p] = h;
      bucketOf[p] = clamp(Math.floor(spin[p] / SPIN_BUCKET), 0, SPIN_BUCKETS - 1);
      starts[bucketOf[p] + 1] += 1;
      widen("speed", speed[p]);
      widen("spin", spin[p]);
      widen("control", control[p]);
    }
  }
  for (let k = 0; k < SPIN_BUCKETS; k += 1) starts[k + 1] += starts[k];
  const fill = starts.slice(0, SPIN_BUCKETS);
  const order = new Int32Array(n);
  for (let p = 0; p < n; p += 1) order[fill[bucketOf[p]]++] = p;
  // Within a bucket, pairs are ordered by speed so a speed window can be found by binary search.
  for (let k = 0; k < SPIN_BUCKETS; k += 1) {
    if (starts[k + 1] - starts[k] > 1) order.subarray(starts[k], starts[k + 1]).sort((x, y) => speed[x] - speed[y]);
  }
  const index = { n, speed, spin, control, fIndex, hIndex, starts, order, range };
  pairCache = { key, index };
  return index;
}

// Distance from 0 to the interval [lo, hi].
function gapToZero(lo, hi) {
  if (lo > 0) return lo;
  if (hi < 0) return -hi;
  return 0;
}

// Finds the blade + forehand + backhand combination closest to the targets
// { speed, spin, control, weight, forehand?, backhand? }. The optional forehand/backhand
// targets add a per-rubber distance for the advanced mode. catalog.forehands / catalog.backhands
// optionally narrow each side (e.g. a locked pick); they default to catalog.rubbers.
// Deterministic: ties resolve to the first (blade, forehand, backhand) in catalog order.
export function recommendSetup(catalog, targets) {
  const forehands = catalog.forehands ?? catalog.rubbers;
  const backhands = catalog.backhands ?? catalog.rubbers;
  const r1 = (v) => Math.round(v * 10) / 10;
  const fhDist = forehands.map((f) => sideDistance(f, targets.forehand));
  const bhDist = backhands.map((h) => sideDistance(h, targets.backhand));
  const { speed: pSpeed, spin: pSpin, control: pControl, fIndex, hIndex, starts, order, range } = pairIndex(forehands, backhands);
  const blades = catalog.blades;
  const SR = TARGET_RANGES.speed;
  const PR = TARGET_RANGES.spin;
  const CR = TARGET_RANGES.control;
  // Displayed stats are rounded to 0.1, which moves each axis term by at most 0.05 / range, so
  // the exact winner is within 2 * ROUND_SLACK of the smallest unrounded distance. The search
  // first finds that smallest unrounded distance, then checks the few combinations inside the
  // window with the exact (rounded) arithmetic.
  const ROUND_SLACK = 0.05 / SR + 0.05 / PR + 0.05 / CR + 1e-9;
  // Blades without a published gram weight are not penalized on weight.
  const weightTerms = blades.map((blade) => (blade.weightG == null ? 0 : axisDistance(blade.weightG, targets.weight, TARGET_RANGES.weight)));
  // Lower bound per blade over every possible rubber pair.
  const spinFloor = gapToZero(range.spin[0] - targets.spin, range.spin[1] - targets.spin) / PR;
  const lower = blades.map(
    (blade, b) =>
      weightTerms[b] +
      spinFloor +
      gapToZero(blade.speed * 0.4 + range.speed[0] - targets.speed, blade.speed * 0.4 + range.speed[1] - targets.speed) / SR +
      gapToZero(blade.control * 0.4 + range.control[0] - targets.control, blade.control * 0.4 + range.control[1] - targets.control) / CR
  );
  // A blade with the same speed, control and weight term as an earlier blade can never win (equal
  // distance, later in catalog order), so only the first of each kind is searched.
  const seenKinds = new Set();
  const distinct = blades.map((blade, b) => {
    const kind = blade.speed + "|" + blade.control + "|" + weightTerms[b];
    if (seenKinds.has(kind)) return false;
    seenKinds.add(kind);
    return true;
  });
  const byLower = blades.map((_, b) => b).filter((b) => distinct[b]).sort((x, y) => lower[x] - lower[y] || x - y);
  const centre = clamp(Math.floor(targets.spin / SPIN_BUCKET), 0, SPIN_BUCKETS - 1);

  // Calls visit(p, unroundedDistance) for every pair of blade b whose unrounded distance can still
  // be <= limit(). Buckets are walked outward from the target spin and the walk stops once the
  // spin gap alone exceeds the allowance.
  const walk = (b, limit, visit) => {
    const bs = blades[b].speed * 0.4 - targets.speed;
    const bc = blades[b].control * 0.4 - targets.control;
    const wt = weightTerms[b];
    for (let dir = 0; dir < 2; dir += 1) {
      for (let k = dir === 0 ? centre : centre - 1; k >= 0 && k < SPIN_BUCKETS; k += dir === 0 ? 1 : -1) {
        const gap = dir === 0 ? Math.max(0, k * SPIN_BUCKET - targets.spin) : Math.max(0, targets.spin - (k + 1) * SPIN_BUCKET);
        if (gap / PR + wt > limit()) break;
        const allowance = limit() - gap / PR - wt;
        // First pair in this bucket with speed >= the lower edge of the window.
        const speedLo = -bs - allowance * SR;
        const speedHi = -bs + allowance * SR;
        let lo = starts[k];
        let hi = starts[k + 1];
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (pSpeed[order[mid]] < speedLo) lo = mid + 1;
          else hi = mid;
        }
        for (let i = lo; i < starts[k + 1] && pSpeed[order[i]] <= speedHi; i += 1) {
          const p = order[i];
          const u = Math.abs(bs + pSpeed[p]) / SR + Math.abs(pSpin[p] - targets.spin) / PR + Math.abs(bc + pControl[p]) / CR + wt + fhDist[fIndex[p]] + bhDist[hIndex[p]];
          if (u <= limit()) visit(p, u);
        }
      }
    }
  };

  let minUnrounded = Infinity;
  for (const b of byLower) {
    if (lower[b] > minUnrounded) break;
    walk(b, () => minUnrounded, (p, u) => {
      if (u < minUnrounded) minUnrounded = u;
    });
  }
  const windowEnd = minUnrounded + 2 * ROUND_SLACK;
  let bestDistance = Infinity;
  let bestB = -1;
  let bestF = -1;
  let bestH = -1;
  let bestOrder = -1;
  const nh = backhands.length;
  for (let b = 0; b < blades.length; b += 1) {
    if (!distinct[b] || lower[b] > windowEnd) continue;
    const blade = blades[b];
    walk(b, () => windowEnd, (p) => {
      const f = fIndex[p];
      const h = hIndex[p];
      const fh = forehands[f];
      const bh = backhands[h];
      const speed = r1(blade.speed * 0.4 + fh.speed * 0.35 + bh.speed * 0.25);
      const spin = r1(fh.spin * 0.6 + bh.spin * 0.4);
      const control = r1(blade.control * 0.4 + fh.control * 0.3 + bh.control * 0.3);
      const distance =
        Math.abs(speed - targets.speed) / SR +
        Math.abs(spin - targets.spin) / PR +
        Math.abs(control - targets.control) / CR +
        weightTerms[b] +
        fhDist[f] +
        bhDist[h];
      const pairOrder = f * nh + h;
      // Blades are visited in catalog order, so only an earlier pair of the same blade beats an equal distance.
      if (distance < bestDistance || (distance === bestDistance && b === bestB && pairOrder < bestOrder)) {
        bestDistance = distance;
        bestB = b;
        bestF = f;
        bestH = h;
        bestOrder = pairOrder;
      }
    });
  }
  const blade = catalog.blades[bestB];
  const forehand = forehands[bestF];
  const backhand = backhands[bestH];
  return { blade, forehand, backhand, stats: computeSetupStats(blade, forehand, backhand), distance: bestDistance };
}
