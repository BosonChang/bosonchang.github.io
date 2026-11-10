// Run with: node tabletennis/matcher/scripts/matchLogic.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { bladeHasHandle, computeSetupStats, recommendSetup, withRatings } from "./matchLogic.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = withRatings(JSON.parse(readFileSync(path.join(here, "..", "data", "catalog.json"), "utf8")));
const blade = (id) => catalog.blades.find((b) => b.id === id);
const rubber = (id) => catalog.rubbers.find((r) => r.id === id);

test("withRatings converts published values to 1-10 ratings", () => {
  const t05 = rubber("rubber-tenergy-05");
  assert.deepEqual([t05.speed, t05.spin, t05.control], [8.3, 7.6, 7.9]);
  for (const item of [...catalog.blades, ...catalog.rubbers]) {
    for (const key of ["speed", "control"]) assert.ok(item[key] >= 1 && item[key] <= 10, `${item.id} ${key}`);
  }
});

test("computeSetupStats blends ratings; weight is blade weight and has no power", () => {
  const stats = computeSetupStats(blade("blade-viscaria"), rubber("rubber-tenergy-64"), rubber("rubber-tenergy-05"));
  assert.equal(stats.weight, 86);
  assert.equal("power" in stats, false);
  assert.ok(stats.speed >= 1 && stats.speed <= 10);
});

test("recommendSetup recovers the exact combo that produced the targets", () => {
  const b = blade("blade-primorac");
  const best = recommendSetup(catalog, computeSetupStats(b, rubber("rubber-tenergy-25"), rubber("rubber-rozena")));
  assert.equal(best.distance, 0);
  assert.equal(best.blade.id, b.id);
});

test("recommendSetup is deterministic", () => {
  const targets = { speed: 6, spin: 6, control: 6, weight: 85 };
  const first = recommendSetup(catalog, targets);
  const second = recommendSetup(catalog, targets);
  assert.deepEqual(
    [first.blade.id, first.forehand.id, first.backhand.id],
    [second.blade.id, second.forehand.id, second.backhand.id]
  );
});

test("recommendSetup favors faster gear when asked for max speed", () => {
  const fast = recommendSetup(catalog, { speed: 10, spin: 5, control: 1, weight: 86 });
  const slow = recommendSetup(catalog, { speed: 1, spin: 5, control: 10, weight: 86 });
  assert.ok(fast.stats.speed > slow.stats.speed);
});

test("missing weight does not break matching", () => {
  const nitt = blade("blade-nittaku-acoustic-carbon");
  const c1 = rubber("rubber-nittaku-fastarc-c1");
  const stats = computeSetupStats(nitt, c1, c1);
  assert.equal(stats.weight, null);
  assert.ok(recommendSetup(catalog, { ...stats, weight: 85 }).distance < 1);
});

test("narrowed forehand pool keeps a locked pick", () => {
  const locked = rubber("rubber-tenergy-25");
  const best = recommendSetup(
    { blades: catalog.blades, forehands: [locked], backhands: catalog.rubbers },
    { speed: 10, spin: 10, control: 1, weight: 90 }
  );
  assert.equal(best.forehand.id, locked.id);
});

test("per-side targets steer each rubber separately", () => {
  const targets = { speed: 7, spin: 7, control: 7, weight: 85 };
  const fastSpinny = { speed: 10, spin: 10, control: 3 };
  const slowControl = { speed: 4, spin: 5, control: 10 };
  const best = recommendSetup(catalog, { ...targets, forehand: fastSpinny, backhand: slowControl });
  assert.ok(best.forehand.speed > best.backhand.speed);
  assert.ok(best.forehand.spin >= best.backhand.spin);
  assert.ok(best.backhand.control > best.forehand.control);
});

test("bladeHasHandle reads the catalog handle codes", () => {
  assert.equal(bladeHasHandle({ handles: "FL, ST" }, "ST"), true);
  assert.equal(bladeHasHandle({ handles: "AN, FL, ST" }, "AN"), true);
  assert.equal(bladeHasHandle({ handles: "FL" }, "ST"), false);
  assert.equal(bladeHasHandle({ handles: null }, "FL"), false);
  assert.ok(catalog.blades.some((b) => bladeHasHandle(b, "AN")));
});

test("every catalog item has a brand, a product link and an image URL (empty = no photo)", () => {
  for (const item of [...catalog.blades, ...catalog.rubbers]) {
    assert.ok(item.brand && (item.imageUrl === "" || item.imageUrl.startsWith("https://")) && item.productUrl.startsWith("https://"), item.id);
  }
});

test("every item with a status uses a known value, and discontinued items explain why", () => {
  for (const item of [...catalog.blades, ...catalog.rubbers]) {
    if (item.status === undefined) continue;
    assert.ok(["current", "discontinued"].includes(item.status), item.id);
    if (item.status === "discontinued") assert.ok(item.statusNote && item.statusNote.length > 10, item.id);
  }
  assert.ok(catalog.blades.filter((b) => b.brand === "Butterfly" && b.status === "current").length >= 52);
});

test("pruned search returns exactly what a plain scan of every combination returns", () => {
  const plain = (targets) => {
    let best = null;
    for (const blade of catalog.blades) {
      for (const fh of catalog.rubbers) {
        for (const bh of catalog.rubbers) {
          const s = computeSetupStats(blade, fh, bh);
          const w = blade.weightG == null ? 0 : Math.abs(blade.weightG - targets.weight) / 25;
          const d = Math.abs(s.speed - targets.speed) / 9 + Math.abs(s.spin - targets.spin) / 9 + Math.abs(s.control - targets.control) / 9 + w;
          if (!best || d < best.d) best = { d, blade, fh, bh };
        }
      }
    }
    return best;
  };
  for (const targets of [
    { speed: 8, spin: 8, control: 8, weight: 85 },
    { speed: 9.5, spin: 9.5, control: 5, weight: 75 },
    { speed: 3, spin: 4, control: 9, weight: 90 }
  ]) {
    const expected = plain(targets);
    const got = recommendSetup(catalog, targets);
    assert.equal(got.blade.id, expected.blade.id);
    assert.equal(got.forehand.id, expected.fh.id);
    assert.equal(got.backhand.id, expected.bh.id);
  }
});
