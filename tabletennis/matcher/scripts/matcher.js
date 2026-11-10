import { bladeHasHandle, computeSetupStats, recommendSetup, withRatings } from "./matchLogic.js";

const HANDLE_NAMES = { FL: "Flared", ST: "Straight", AN: "Anatomic" };
const SLIDER_IDS = ["speed", "spin", "control", "weight"];
const RUBBER_AXES = ["speed", "spin", "control"];
const SIDES = ["forehand", "backhand"];
const WEIGHT_RANGE = { min: 70, max: 95 }; // must match the weight slider in index.html
const NOT_PUBLISHED = "Not published";

let catalog = null;
let brand = ""; // "" = all brands
let handle = ""; // "" = any, else FL / ST / AN
// Current setup is the single source of truth; the sliders, dropdowns and cards
// are all rendered from it, never from each other.
let current = { bladeId: null, forehandId: null, backhandId: null };

document.addEventListener("DOMContentLoaded", () => {
  fetch("data/catalog.json")
    .then((response) => response.json())
    .then((data) => {
      catalog = withRatings(data);
      buildBrandChips();
      buildAdvanced();
      resetPool();
      applySelectionToSliders();
      render();
      wireSelectionInputs();
      wireSliderInputs();
      wireHandleFilter();
      wireAdvanced();
    })
    .catch((error) => {
      console.error("Error loading equipment catalog:", error);
    });
});

// ---------- small DOM helpers (all catalog text goes through textContent) ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Value with an optional unit, or "Not published" when the catalog has none.
function fmt(value, unit = "") {
  return value == null ? NOT_PUBLISHED : `${value}${unit}`;
}

function isLocked(piece) {
  return document.getElementById(`lock-${piece}`).checked;
}

// ---------- filters: brand and handle ----------

function buildBrandChips() {
  const container = document.getElementById("brand-chips");
  const brands = [...new Set([...catalog.blades, ...catalog.rubbers].map((item) => item.brand))].sort((a, b) =>
    a.localeCompare(b)
  );
  ["", ...brands].forEach((name) => {
    const chip = el("button", "chip", name || "All brands");
    chip.type = "button";
    chip.dataset.brand = name;
    chip.setAttribute("aria-pressed", String(name === brand));
    chip.addEventListener("click", () => {
      brand = name;
      container.querySelectorAll(".chip").forEach((other) => {
        other.setAttribute("aria-pressed", String(other.dataset.brand === brand));
      });
      ["blade", "forehand", "backhand"].forEach((piece) => {
        document.getElementById(`lock-${piece}`).checked = false;
      });
      resetPool();
      applySelectionToSliders();
      render();
    });
    container.appendChild(chip);
  });
}

function wireHandleFilter() {
  const buttons = document.querySelectorAll("#handle-filter .seg");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      handle = button.dataset.handle;
      buttons.forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      // Keep a locked blade; otherwise re-run the recommendation from the sliders.
      recommendFromTargets();
    });
  });
}

// The brand and handle filters limit the dropdown choices and the recommendation.
// A filter that would leave nothing falls back to the unfiltered list, with a note.
function pool() {
  const notes = [];
  const byBrand = (items, kind) => {
    const matches = brand ? items.filter((item) => item.brand === brand) : items;
    if (matches.length) return matches;
    notes.push(`No ${brand} ${kind} with published ratings yet, so all brands' ${kind} are shown.`);
    return items;
  };
  let blades = byBrand(catalog.blades, "blades");
  const rubbers = byBrand(catalog.rubbers, "rubbers");
  if (handle) {
    const withHandle = blades.filter((blade) => bladeHasHandle(blade, handle));
    if (withHandle.length) {
      blades = withHandle;
    } else {
      notes.push(`No blades with a ${HANDLE_NAMES[handle].toLowerCase()} handle in this selection, so all handles are shown.`);
    }
  }
  return { blades, rubbers, notes };
}

function updateNote() {
  document.getElementById("brand-note").textContent = pool().notes.join(" ");
}

function populateSelect(selectId, items) {
  const select = document.getElementById(selectId);
  clearChildren(select);
  items.forEach((item) => {
    const option = el("option", "", `${item.brand} ${item.name}`);
    option.value = item.id;
    select.appendChild(option);
  });
}

function resetPool() {
  const { blades, rubbers } = pool();
  populateSelect("select-blade", blades);
  populateSelect("select-forehand", rubbers);
  populateSelect("select-backhand", rubbers);
  current = {
    bladeId: blades[0].id,
    forehandId: rubbers[0].id,
    backhandId: rubbers[1] ? rubbers[1].id : rubbers[0].id
  };
  syncSelects();
  updateNote();
}

function syncSelects() {
  document.getElementById("select-blade").value = current.bladeId;
  document.getElementById("select-forehand").value = current.forehandId;
  document.getElementById("select-backhand").value = current.backhandId;
}

function findBlade(id) {
  return catalog.blades.find((blade) => blade.id === id);
}

function findRubber(id) {
  return catalog.rubbers.find((rubber) => rubber.id === id);
}

function currentStats() {
  return computeSetupStats(findBlade(current.bladeId), findRubber(current.forehandId), findRubber(current.backhandId));
}

// ---------- targets, advanced section and recommendation ----------

function buildAdvanced() {
  SIDES.forEach((side) => {
    const box = document.getElementById(`adv-${side}`);
    RUBBER_AXES.forEach((axis) => {
      const id = `adv-${side}-${axis}`;
      const row = el("div", "target-row");
      const label = el("label", "", axis[0].toUpperCase() + axis.slice(1));
      label.htmlFor = id;
      const output = el("output", "", "6");
      output.id = `${id}-value`;
      output.htmlFor = id;
      const slider = el("input");
      slider.type = "range";
      slider.id = id;
      slider.min = "1";
      slider.max = "10";
      slider.step = "1";
      slider.value = "6";
      row.append(label, output, slider);
      box.appendChild(row);
    });
  });
}

function advancedOn() {
  return document.getElementById("adv-enable").checked;
}

function setAdvancedFromGear() {
  SIDES.forEach((side) => {
    const rubber = findRubber(current[`${side}Id`]);
    RUBBER_AXES.forEach((axis) => {
      document.getElementById(`adv-${side}-${axis}`).value = rubber[axis];
      document.getElementById(`adv-${side}-${axis}-value`).textContent = String(rubber[axis]);
    });
  });
}

function wireAdvanced() {
  document.getElementById("adv-enable").addEventListener("change", (event) => {
    SIDES.forEach((side) => {
      document.getElementById(`adv-${side}`).disabled = !event.target.checked;
    });
    if (event.target.checked) setAdvancedFromGear();
    render();
  });
  SIDES.forEach((side) => {
    RUBBER_AXES.forEach((axis) => {
      const slider = document.getElementById(`adv-${side}-${axis}`);
      slider.addEventListener("input", () => {
        document.getElementById(`adv-${side}-${axis}-value`).textContent = slider.value;
        recommendFromTargets();
      });
    });
  });
}

function readTargets() {
  const targets = {};
  SLIDER_IDS.forEach((key) => {
    targets[key] = Number(document.getElementById(`target-${key}`).value);
  });
  if (advancedOn()) {
    SIDES.forEach((side) => {
      targets[side] = {};
      RUBBER_AXES.forEach((axis) => {
        targets[side][axis] = Number(document.getElementById(`adv-${side}-${axis}`).value);
      });
    });
  }
  return targets;
}

// Locked pieces stay fixed; the recommendation only searches the unlocked ones.
function recommendationPool() {
  const { blades, rubbers } = pool();
  return {
    blades: isLocked("blade") ? [findBlade(current.bladeId)] : blades,
    forehands: isLocked("forehand") ? [findRubber(current.forehandId)] : rubbers,
    backhands: isLocked("backhand") ? [findRubber(current.backhandId)] : rubbers
  };
}

function recommendFromTargets() {
  const best = recommendSetup(recommendationPool(), readTargets());
  current = { bladeId: best.blade.id, forehandId: best.forehand.id, backhandId: best.backhand.id };
  // Show only the filtered blades, keeping a locked blade that the filter excludes.
  const { blades } = pool();
  populateSelect("select-blade", blades.some((b) => b.id === current.bladeId) ? blades : [best.blade, ...blades]);
  syncSelects();
  updateNote();
  render();
}

// Direct selection is the authoritative gear choice: move the sliders to show
// the exact stats that gear produces. Writing slider .value never dispatches an
// "input" event, so this cannot re-trigger the slider handler and loop back.
function applySelectionToSliders() {
  const stats = currentStats();
  SLIDER_IDS.forEach((key) => setSliderDisplay(key, stats[key]));
  if (advancedOn()) setAdvancedFromGear();
}

function setSliderDisplay(key, value) {
  const output = document.getElementById(`${key}-value`);
  if (value == null) {
    // Blade weight not published: leave the slider where it is.
    output.textContent = "n/a";
    return;
  }
  document.getElementById(`target-${key}`).value = value;
  output.textContent = key === "weight" ? `${value} g` : String(value);
}

function wireSelectionInputs() {
  ["select-blade", "select-forehand", "select-backhand"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      current = {
        bladeId: document.getElementById("select-blade").value,
        forehandId: document.getElementById("select-forehand").value,
        backhandId: document.getElementById("select-backhand").value
      };
      applySelectionToSliders();
      render();
    });
  });
}

// Slider targets drive a recommendation. The recommended gear is written into
// the selects without dispatching events, so it cannot overwrite the slider
// position the user is dragging.
function wireSliderInputs() {
  SLIDER_IDS.forEach((key) => {
    const slider = document.getElementById(`target-${key}`);
    slider.addEventListener("input", () => {
      document.getElementById(`${key}-value`).textContent = key === "weight" ? `${slider.value} g` : slider.value;
      recommendFromTargets();
    });
  });
}

// ---------- rendering ----------

function render() {
  const blade = findBlade(current.bladeId);
  const forehand = findRubber(current.forehandId);
  const backhand = findRubber(current.backhandId);
  renderBladeCard(blade);
  renderRubberCard("forehand-card", forehand, "Forehand rubber");
  renderRubberCard("backhand-card", backhand, "Backhand rubber");
  renderStats(computeSetupStats(blade, forehand, backhand));
  document.getElementById("result-status").textContent =
    `${blade.brand} ${blade.name} with ${forehand.name} on the forehand and ${backhand.name} on the backhand.`;
}

// A 1-10 meter. `target` (optional) draws a red tick at the user's slider target.
function meterRow(label, value, valueText, target, scale = { min: 1, max: 10 }) {
  const row = el("div", "meter-row");
  row.appendChild(el("span", "meter-label", label));
  const meter = el("div", "meter");
  meter.setAttribute("role", "img");
  meter.setAttribute("aria-label", `${label}: ${valueText}`);
  const span = scale.max - scale.min;
  const frac = (x) => Math.min(1, Math.max(0, (x - scale.min) / span));
  if (value != null) {
    const fill = el("div", "meter-fill");
    fill.style.setProperty("--v", frac(value));
    meter.appendChild(fill);
  }
  if (target != null) {
    const tick = el("div", "meter-target");
    tick.style.setProperty("--t", frac(target));
    meter.appendChild(tick);
  }
  row.appendChild(meter);
  row.appendChild(el("span", "meter-value", valueText));
  return row;
}

function addSpec(list, label, value) {
  list.appendChild(el("dt", "", label));
  list.appendChild(el("dd", "", value));
}

// Shared card frame: role band, product photo (hotlinked from the shop, no local copy), body.
function buildCard(card, item, roleText) {
  clearChildren(card);
  card.appendChild(el("div", "gear-role", roleText));

  const media = el("div", "gear-media");
  const link = el("a");
  link.href = item.productUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `${item.brand} ${item.name} on the ${item.shop}`);
  const img = el("img", "product-image");
  if (item.imageUrl) {
    img.src = item.imageUrl;
  } else {
    // no photo for this item: show the placeholder without making a request
    media.classList.add("no-photo");
  }
  img.alt = `${item.brand} ${item.name}`;
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.addEventListener("error", () => {
    img.remove();
    media.classList.add("no-photo");
  });
  link.appendChild(img);
  media.appendChild(link);
  card.appendChild(media);

  const body = el("div", "gear-body");
  body.appendChild(el("div", "gear-brand", item.brand));
  body.appendChild(el("h3", "", item.name));
  card.appendChild(body);
  return body;
}

function finishCard(body, item, specs) {
  const details = el("details", "gear-details");
  details.appendChild(el("summary", "", "All specs"));
  details.appendChild(specs);
  body.appendChild(details);
  const linkP = el("p", "gear-link");
  const link = el("a", "", `View on the ${item.shop}`);
  link.href = item.productUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  linkP.appendChild(link);
  body.appendChild(linkP);
}

function renderBladeCard(blade) {
  const body = buildCard(document.getElementById("blade-card"), blade, "Blade");
  body.appendChild(el("p", "gear-kicker", [blade.plies, blade.composition].filter(Boolean).join(" · ") || NOT_PUBLISHED));
  body.appendChild(meterRow("Speed", blade.speed, `${blade.speed}`));
  body.appendChild(meterRow("Control", blade.control, `${blade.control}`));
  body.appendChild(meterRow("Weight", blade.weightG, blade.weightG == null ? "n/a" : `${blade.weightG} g`, null, WEIGHT_RANGE));
  body.appendChild(el("p", "gear-handle", `Handle: ${fmt(blade.handles)}`));

  const specs = el("dl", "spec-list");
  addSpec(specs, "Handles", fmt(blade.handles));
  addSpec(specs, "Head thickness", fmt(blade.headThicknessMm, " mm"));
  if (blade.reaction != null) {
    addSpec(specs, "Reaction (published)", String(blade.reaction));
    addSpec(specs, "Vibration (published)", String(blade.vibration));
  }
  if (blade.speedRating != null) {
    addSpec(specs, "Speed (published)", `${blade.speedRating} / 100`);
    addSpec(specs, "Control (published)", `${blade.controlRating} / 100`);
  }
  finishCard(body, blade, specs);
}

function renderRubberCard(cardId, rubber, roleText) {
  const body = buildCard(document.getElementById(cardId), rubber, roleText);
  body.appendChild(
    el("p", "gear-kicker", rubber.thicknessMm ? `${rubber.type} · ${rubber.thicknessMm.join(" / ")} mm sponge` : `${rubber.type} · sponge thickness not listed`)
  );
  body.appendChild(meterRow("Speed", rubber.speed, `${rubber.speed}`));
  body.appendChild(meterRow("Spin", rubber.spin, `${rubber.spin}`));
  body.appendChild(meterRow("Control", rubber.control, `${rubber.control}`));

  const specs = el("dl", "spec-list");
  addSpec(specs, "Hardness", rubber.hardness == null ? NOT_PUBLISHED : `${rubber.hardness} (${rubber.hardnessUnit || "scale not stated"})`);
  addSpec(specs, "Speed (published)", `${Math.round(rubber.speed * 10)} / 100`);
  addSpec(specs, "Spin (published)", `${Math.round(rubber.spin * 10)} / 100`);
  addSpec(specs, rubber.arc != null ? "Arc (published)" : "Control (published)", `${Math.round(rubber.control * 10)} / 100`);
  finishCard(body, rubber, specs);
}

// Setup-level result bars; the red tick shows where the user's slider target sits.
function renderStats(stats) {
  const targets = readTargets();
  const box = document.getElementById("stats-readout");
  clearChildren(box);
  box.appendChild(meterRow("Speed", stats.speed, `${stats.speed}`, targets.speed));
  box.appendChild(meterRow("Spin", stats.spin, `${stats.spin}`, targets.spin));
  box.appendChild(meterRow("Control", stats.control, `${stats.control}`, targets.control));
  box.appendChild(
    meterRow("Blade weight", stats.weight, stats.weight == null ? "n/a" : `${stats.weight} g`, stats.weight == null ? null : targets.weight, WEIGHT_RANGE)
  );
}
