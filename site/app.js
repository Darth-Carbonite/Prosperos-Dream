// Prospero's Dream station map.
// All content comes from data.json, which the build script makes from the
// Markdown files in content/. You shouldn't need to edit this file to add
// or change locations, people or factions.

const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER = 500;

const AREA_NAMES = {
  "outer-ring": "Outer ring",
  "ring-structures": "Ring structures",
  "center-spire": "Center spire",
  "the-choke": "The Choke",
};

const state = { data: null, byId: { location: {}, person: {}, faction: {} } };

const els = {
  map: document.getElementById("map"),
  panel: document.getElementById("panel"),
  tooltip: document.getElementById("tooltip"),
  legend: document.getElementById("legend-list"),
  tagline: document.getElementById("tagline"),
};

// ---------- Helpers ----------

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function svg(tag, attrs = {}, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (parent) parent.appendChild(el);
  return el;
}

function polar(angleDeg, radius) {
  const a = (angleDeg * Math.PI) / 180;
  return [CENTER + radius * Math.sin(a), CENTER - radius * Math.cos(a)];
}

function sectorPath(startDeg, endDeg, inner, outer) {
  const [x1, y1] = polar(startDeg, outer);
  const [x2, y2] = polar(endDeg, outer);
  const [x3, y3] = polar(endDeg, inner);
  const [x4, y4] = polar(startDeg, inner);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${x1},${y1} A${outer},${outer} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${inner},${inner} 0 ${large} 0 ${x4},${y4} Z`;
}

const href = (kind, id) => `#${kind}/${id}`;
const isHazard = (loc) => loc.area === "the-choke";

// ---------- Map drawing ----------

// Wide screens show place names beside the markers, so leave room for them
// on either side. Narrow screens hide the names and use the full width.
const NARROW = "(max-width: 600px)";
function fitViewBox() {
  const narrow = window.matchMedia(NARROW).matches;
  els.map.setAttribute("viewBox", narrow ? "0 0 1000 1000" : "-170 0 1340 1000");
  els.map.style.aspectRatio = narrow ? "1" : "1.34";
}

function drawBackdrop() {
  const defs = svg("defs", {}, els.map);
  const pattern = svg("pattern", { id: "hazard-stripes", width: 16, height: 16, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
  svg("rect", { width: 16, height: 16, fill: "#1a0f10" }, pattern);
  svg("rect", { width: 6, height: 16, fill: "#3a1518" }, pattern);

  const g = svg("g", { class: "backdrop", "aria-hidden": "true" }, els.map);

  // Outer ring and ring structures, drawn as wide bands.
  svg("circle", { class: "ring-band", cx: CENTER, cy: CENTER, r: 400, "stroke-width": 80 }, g);
  svg("circle", { class: "ring-band", cx: CENTER, cy: CENTER, r: 290, "stroke-width": 140 }, g);
  for (const r of [440, 360, 220]) svg("circle", { class: "ring-edge", cx: CENTER, cy: CENTER, r }, g);

  // Slices around the outer ring.
  for (let deg = 0; deg < 360; deg += 30) {
    const [x1, y1] = polar(deg + 15, 360);
    const [x2, y2] = polar(deg + 15, 440);
    svg("line", { class: "slice", x1, y1, x2, y2 }, g);
  }

  // Spokes from the spire to the ring.
  for (let deg = 0; deg < 360; deg += 60) {
    const [x1, y1] = polar(deg + 30, 110);
    const [x2, y2] = polar(deg + 30, 220);
    svg("line", { class: "spoke", x1, y1, x2, y2 }, g);
  }

  // The Choke: a quarantined sector in the station's depths.
  svg("path", { class: "choke-zone", d: sectorPath(145, 215, 200, 448) }, g);

  // Center spire.
  svg("circle", { class: "spire", cx: CENTER, cy: CENTER, r: 110 }, g);

  const label = (text, x, y, extra = "") => {
    const t = svg("text", { class: `area-label ${extra}`, x, y, "text-anchor": "middle" }, g);
    t.textContent = text;
  };
  label("Outer ring", CENTER, 32);
  label("Center spire", CENTER, 642);
  label("Quarantine", CENTER, 985, "hazard");
}

function drawConnections() {
  const g = svg("g", { class: "connections", "aria-hidden": "true" }, els.map);
  const seen = new Set();
  for (const loc of state.data.locations) {
    for (const otherId of loc.connects_to) {
      const key = [loc.id, otherId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const other = state.byId.location[otherId];
      svg("line", {
        class: "connection",
        "data-a": loc.id,
        "data-b": otherId,
        x1: loc.map.x,
        y1: loc.map.y,
        x2: other.map.x,
        y2: other.map.y,
      }, g);
    }
  }
}

function drawMarkers() {
  const g = svg("g", {}, els.map);
  for (const loc of state.data.locations) {
    const { x, y } = loc.map;
    const a = svg("a", {
      class: `marker${isHazard(loc) ? " is-hazard" : ""}`,
      href: href("location", loc.id),
      "data-id": loc.id,
      "aria-label": loc.name,
    }, g);
    svg("circle", { class: "marker-dot", cx: x, cy: y, r: 22 }, a);
    const num = svg("text", { class: "marker-num", x, y }, a);
    num.textContent = loc.number ?? "•";

    // Put labels on the outside so they don't cover the middle of the map.
    let lx = x, ly = y + 48, anchor = "middle";
    if (x > CENTER + 120) [lx, ly, anchor] = [x + 34, y + 7, "start"];
    else if (x < CENTER - 120) [lx, ly, anchor] = [x - 34, y + 7, "end"];
    const label = svg("text", { class: "marker-label", x: lx, y: ly, "text-anchor": anchor }, a);
    label.textContent = loc.name;

    a.addEventListener("mouseenter", () => showTooltip(loc, a));
    a.addEventListener("focus", () => showTooltip(loc, a));
    a.addEventListener("mouseleave", hideTooltip);
    a.addEventListener("blur", hideTooltip);
  }
}

function drawLegend() {
  els.legend.innerHTML = state.data.locations
    .map(
      (loc) => `<li><a href="${href("location", loc.id)}" data-id="${escapeHtml(loc.id)}">
        <span class="legend-num">${escapeHtml(loc.number ?? "")}</span>
        <span class="legend-name">${escapeHtml(loc.name)}</span></a></li>`
    )
    .join("");
}

function showTooltip(loc, anchor) {
  const wrap = els.map.parentElement.getBoundingClientRect();
  const box = anchor.querySelector(".marker-dot").getBoundingClientRect();
  els.tooltip.innerHTML = `<strong>${escapeHtml(loc.name)}</strong>${escapeHtml(loc.summary || "")}`;
  els.tooltip.hidden = false;
  const tip = els.tooltip.getBoundingClientRect();
  let left = box.left - wrap.left + box.width / 2 - tip.width / 2;
  left = Math.max(0, Math.min(left, wrap.width - tip.width));
  let top = box.top - wrap.top - tip.height - 10;
  if (top < 0) top = box.bottom - wrap.top + 10;
  els.tooltip.style.left = `${left}px`;
  els.tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  els.tooltip.hidden = true;
}

function highlight(locationIds, selectedId) {
  const related = new Set(locationIds);
  els.map.classList.toggle("has-selection", related.size > 0);
  els.map.querySelectorAll(".marker").forEach((m) => {
    m.classList.toggle("is-selected", m.dataset.id === selectedId || (!selectedId && related.has(m.dataset.id)));
    m.classList.toggle("is-linked", related.has(m.dataset.id));
  });
  els.map.querySelectorAll(".connection").forEach((line) => {
    const active = selectedId && (line.dataset.a === selectedId || line.dataset.b === selectedId);
    line.classList.toggle("is-active", Boolean(active));
  });
  els.legend.querySelectorAll("a").forEach((a) => {
    a.setAttribute("aria-current", related.has(a.dataset.id) ? "true" : "false");
  });
}

// ---------- Panel views ----------

const chip = (kind, entry) => `<li><a class="chip" href="${href(kind, entry.id)}">${escapeHtml(entry.name)}</a></li>`;

function chipList(kind, entries, emptyText) {
  return entries.length ? `<ul class="chips">${entries.map((e) => chip(kind, e)).join("")}</ul>` : `<p class="empty">${emptyText}</p>`;
}

function peopleList(people, emptyText) {
  if (!people.length) return `<p class="empty">${emptyText}</p>`;
  return `<ul class="people">${people
    .map((p) => `<li><a href="${href("person", p.id)}"><strong>${escapeHtml(p.name)}</strong><span class="role">${escapeHtml(p.role || "")}</span></a></li>`)
    .join("")}</ul>`;
}

const back = `<a class="back" href="#">← Station overview</a>`;

function renderStation() {
  const s = state.data.station;
  const stats = (s.stats || [])
    .map((st) => `<div class="stat"><dt>${escapeHtml(st.label)}</dt><dd>${escapeHtml(st.value)}</dd></div>`)
    .join("");
  highlight([]);
  return `
    <p class="panel-kicker">Station overview</p>
    <h1>${escapeHtml(s.name)}</h1>
    <dl class="stats">${stats}</dl>
    <div class="body">${s.html}</div>`;
}

function renderLocation(loc) {
  const people = state.data.people.filter((p) => p.location === loc.id);
  const connections = loc.connects_to.map((id) => state.byId.location[id]);
  const factions = loc.factions.map((id) => state.byId.faction[id]);
  const inside = loc.inside ? state.byId.location[loc.inside] : null;
  const contains = state.data.locations.filter((l) => l.inside === loc.id);
  highlight([loc.id, ...loc.connects_to], loc.id);

  return `
    ${back}
    <p class="panel-kicker ${isHazard(loc) ? "hazard" : ""}">
      ${loc.number != null ? `${String(loc.number).padStart(2, "0")} · ` : ""}${escapeHtml(AREA_NAMES[loc.area] || "")}
    </p>
    <h1>${escapeHtml(loc.name)}</h1>
    ${loc.summary ? `<p class="summary">${escapeHtml(loc.summary)}</p>` : ""}
    ${inside ? `<p>Located inside ${chip("location", inside).replace(/<\/?li>/g, "")}</p>` : ""}
    <div class="body">${loc.html}</div>
    ${contains.length ? `<h2>Places within</h2>${chipList("location", contains, "")}` : ""}
    <h2>Connects to</h2>
    ${chipList("location", connections, "No known routes.")}
    <h2>Who you'll find here</h2>
    ${peopleList(people, "No one of note.")}
    <h2>Factions present</h2>
    ${chipList("faction", factions, "No faction holds sway here.")}`;
}

function renderPerson(person) {
  const loc = person.location ? state.byId.location[person.location] : null;
  const factions = person.factions.map((id) => state.byId.faction[id]);
  highlight(loc ? [loc.id] : []);
  return `
    ${back}
    <p class="panel-kicker">Person of interest</p>
    <h1>${escapeHtml(person.name)}</h1>
    ${person.role ? `<p class="summary">${escapeHtml(person.role)}</p>` : ""}
    <div class="body">${person.html}</div>
    <h2>Usually found at</h2>
    ${loc ? chipList("location", [loc], "") : `<p class="empty">Whereabouts unknown.</p>`}
    <h2>Factions</h2>
    ${chipList("faction", factions, "Unaffiliated.")}`;
}

function renderFaction(faction) {
  const base = faction.base ? state.byId.location[faction.base] : null;
  const locations = state.data.locations.filter((l) => l.factions.includes(faction.id));
  const members = state.data.people.filter((p) => p.factions.includes(faction.id));
  highlight(locations.map((l) => l.id).concat(base ? [base.id] : []));
  return `
    ${back}
    <p class="panel-kicker">Faction</p>
    <h1>${escapeHtml(faction.name)}</h1>
    ${faction.summary ? `<p class="summary">${escapeHtml(faction.summary)}</p>` : ""}
    <div class="body">${faction.html}</div>
    ${base ? `<h2>Headquarters</h2>${chipList("location", [base], "")}` : ""}
    <h2>Present at</h2>
    ${chipList("location", locations, "No known presence.")}
    <h2>Known members</h2>
    ${peopleList(members, "No known members.")}`;
}

function notFound() {
  highlight([]);
  return `${back}<h1>Not found</h1><p class="empty">That entry doesn't exist (yet).</p>`;
}

// ---------- Routing ----------

function route() {
  const [kind, id] = decodeURIComponent(location.hash.slice(1)).split("/");
  const entry = kind && id ? state.byId[kind]?.[id] : null;
  let html;
  if (!kind) html = renderStation();
  else if (!entry) html = notFound();
  else if (kind === "location") html = renderLocation(entry);
  else if (kind === "person") html = renderPerson(entry);
  else html = renderFaction(entry);

  els.panel.innerHTML = html;
  els.panel.scrollTop = 0;
  document.title = entry ? `${entry.name} · Prospero's Dream` : "Prospero's Dream Station Map";
  hideTooltip();

  // On phones the panel sits under the map, so bring it into view.
  if (kind && window.matchMedia("(max-width: 860px)").matches) {
    els.panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ---------- Start ----------

async function init() {
  try {
    const res = await fetch("data.json");
    state.data = await res.json();
  } catch (err) {
    els.panel.innerHTML = `<h1>Couldn't load the map</h1><p class="empty">${escapeHtml(err.message)}</p>`;
    return;
  }
  for (const loc of state.data.locations) state.byId.location[loc.id] = loc;
  for (const p of state.data.people) state.byId.person[p.id] = p;
  for (const f of state.data.factions) state.byId.faction[f.id] = f;

  els.tagline.textContent = state.data.station.tagline || "";
  fitViewBox();
  window.matchMedia(NARROW).addEventListener("change", fitViewBox);
  drawBackdrop();
  drawConnections();
  drawMarkers();
  drawLegend();
  window.addEventListener("hashchange", route);
  route();
}

init();
