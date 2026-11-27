// Prospero's Dream station map.
// All content comes from data.json, which the build script makes from the
// Markdown files in content/. You shouldn't need to edit this file to add
// or change locations, people or factions. The 3D drawing lives in scene.js.

const SVG_NS = "http://www.w3.org/2000/svg";

const AREA_NAMES = {
  "outer-ring": "Outer ring",
  spokes: "Spokes",
  hub: "Central hub",
  "center-spire": "Center spire",
  "the-choke": "The Choke",
};

const state = { data: null, scene: null, byId: { location: {}, person: {}, faction: {} }, facesByLoc: {} };

const els = {
  map: document.getElementById("map"),
  panel: document.getElementById("panel"),
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

// Links look like #the-court (locations), #person-sem and #faction-teamsters.
function href(kind, id) {
  return kind === "location" ? `#${id}` : `#${kind}-${id}`;
}

function parseHash() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash) return {};
  for (const kind of ["person", "faction"]) {
    if (hash.startsWith(`${kind}-`)) return { kind, id: hash.slice(kind.length + 1) };
  }
  return { kind: "location", id: hash };
}

const isHazard = (loc) => loc.area === "the-choke";
const NARROW = "(max-width: 600px)";

// ---------- Map drawing ----------

function fitViewBox() {
  const { minX, minY, maxX, maxY } = state.scene.bounds;
  // Wide screens show place names beside the markers, so leave room for them.
  const side = window.matchMedia(NARROW).matches ? 30 : 190;
  const x = minX - side;
  const y = minY - 20;
  const w = maxX - minX + side * 2;
  const h = maxY - minY + 40;
  els.map.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  els.map.style.aspectRatio = `${w} / ${h}`;
}

function drawScene() {
  // Building one string is much faster than creating ~2,000 elements one by one.
  const parts = state.scene.faces.map((face) => {
    const points = face.pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const loc = face.loc ? ` data-loc="${escapeHtml(face.loc)}"` : "";
    return `<polygon class="${face.cls}" points="${points}"${loc}/>`;
  });
  const g = svg("g", { class: "station" }, els.map);
  g.innerHTML = parts.join("");

  for (const poly of g.querySelectorAll("[data-loc]")) {
    (state.facesByLoc[poly.dataset.loc] ||= []).push(poly);
  }

  // Modules are clickable too, not just the numbered markers.
  g.addEventListener("click", (event) => {
    const id = event.target.dataset?.loc;
    if (id) location.hash = href("location", id);
  });
  g.addEventListener("mouseover", (event) => {
    setHot(event.target.dataset?.loc);
  });
  g.addEventListener("mouseleave", () => setHot(null));
}

function setHot(id) {
  if (state.hot === id) return;
  for (const poly of state.facesByLoc[state.hot] || []) poly.classList.remove("is-hot");
  state.hot = id;
  for (const poly of state.facesByLoc[id] || []) poly.classList.add("is-hot");
}

function drawMarkers() {
  svg("g", { class: "connections", id: "connections" }, els.map);
  const g = svg("g", { class: "markers" }, els.map);
  const labels = placeLabels();

  for (const loc of state.data.locations) {
    const { x, y } = state.scene.anchors[loc.id];
    const a = svg("a", {
      class: `marker${isHazard(loc) ? " is-hazard" : ""}`,
      href: href("location", loc.id),
      "data-id": loc.id,
      "aria-label": loc.name,
    }, g);
    svg("circle", { class: "marker-dot", cx: x, cy: y, r: 20 }, a);
    const num = svg("text", { class: "marker-num", x, y }, a);
    num.textContent = loc.number ?? "•";

    const label = svg("text", { class: "marker-label", ...labels[loc.id] }, a);
    label.textContent = loc.name;

    a.addEventListener("mouseenter", () => setHot(loc.id));
    a.addEventListener("focus", () => setHot(loc.id));
    a.addEventListener("mouseleave", () => setHot(null));
    a.addEventListener("blur", () => setHot(null));
  }
}

// Puts each name beside its marker (right, left, below or above), choosing
// the first spot that doesn't cover another marker or name.
function placeLabels() {
  const H = 28;
  // Measure each name in the label font (24px bold D-DIN, 0.02em spacing).
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = '700 24px "D-DIN", "Arial Narrow", sans-serif';
  const widthOf = (text) => ctx.measureText(text).width + text.length * 0.48 + 4;
  const anchors = state.scene.anchors;
  const taken = Object.values(anchors).map(({ x, y }) => ({ x: x - 22, y: y - 22, w: 44, h: 44 }));
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const centerX = (state.scene.bounds.minX + state.scene.bounds.maxX) / 2;
  const result = {};

  for (const loc of state.data.locations) {
    const { x, y } = anchors[loc.id];
    const w = widthOf(loc.name);
    const options = [
      { box: { x: x + 28, y: y - H / 2, w, h: H }, attrs: { x: x + 30, y: y + 7, "text-anchor": "start" } },
      { box: { x: x - 28 - w, y: y - H / 2, w, h: H }, attrs: { x: x - 30, y: y + 7, "text-anchor": "end" } },
      { box: { x: x - w / 2, y: y + 26, w, h: H }, attrs: { x, y: y + 46, "text-anchor": "middle" } },
      { box: { x: x - w / 2, y: y - 26 - H, w, h: H }, attrs: { x, y: y - 32, "text-anchor": "middle" } },
    ];
    // Prefer the side facing away from the station's center.
    if (x < centerX - 40) [options[0], options[1]] = [options[1], options[0]];
    const own = taken.find((t) => t.x === x - 22 && t.y === y - 22);
    const choice = options.find((o) => !taken.some((t) => t !== own && overlaps(o.box, t))) || options[0];
    taken.push(choice.box);
    result[loc.id] = choice.attrs;
  }
  return result;
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

// Lights up the given locations; if one is selected, draws its routes.
function highlight(locationIds, selectedId) {
  const related = new Set(locationIds);
  els.map.classList.toggle("has-selection", related.size > 0);

  els.map.querySelectorAll(".marker").forEach((m) => {
    const id = m.dataset.id;
    m.classList.toggle("is-selected", id === selectedId || (!selectedId && related.has(id)));
    m.classList.toggle("is-linked", related.has(id));
  });
  for (const [id, polys] of Object.entries(state.facesByLoc)) {
    const selected = id === selectedId || (!selectedId && related.has(id));
    for (const poly of polys) {
      poly.classList.toggle("is-selected", selected);
      poly.classList.toggle("is-linked", related.has(id) && !selected);
    }
  }
  els.legend.querySelectorAll("a").forEach((a) => {
    // Like the map: the selected location is pink and its connections blue.
    const id = a.dataset.id;
    const selected = id === selectedId || (!selectedId && related.has(id));
    a.classList.toggle("is-selected", selected);
    a.classList.toggle("is-linked", related.has(id) && !selected);
    if (selected) a.setAttribute("aria-current", "location");
    else a.removeAttribute("aria-current");
  });

  const layer = document.getElementById("connections");
  layer.innerHTML = "";
  if (selectedId) {
    const loc = state.byId.location[selectedId];
    const from = state.scene.anchors[selectedId];
    for (const otherId of loc.connects_to) {
      const to = state.scene.anchors[otherId];
      svg("line", { class: "connection", x1: from.x, y1: from.y, x2: to.x, y2: to.y }, layer);
    }
  }
}

// "20 min", "Unknown", or "" when no time was given.
function travelText(minutes) {
  if (minutes === "unknown") return "Unknown";
  if (typeof minutes === "number") return `${minutes} min`;
  return "";
}

// ---------- Panel views ----------

const chip = (kind, entry, note = "") =>
  `<li><a class="chip" href="${href(kind, entry.id)}">${escapeHtml(entry.name)}${
    note ? `<span class="chip-note">${escapeHtml(note)}</span>` : ""
  }</a></li>`;

// Neighboring locations, nearest first, each with its travel time.
function routeList(loc) {
  if (!loc.connects_to.length) return `<p class="empty">No known routes.</p>`;
  const order = (id) => {
    const m = loc.travel_minutes?.[id];
    return typeof m === "number" ? m : m === "unknown" ? Infinity : Infinity - 1;
  };
  const ids = [...loc.connects_to].sort((a, b) => order(a) - order(b));
  return `<ul class="chips">${ids
    .map((id) => chip("location", state.byId.location[id], travelText(loc.travel_minutes?.[id])))
    .join("")}</ul>`;
}

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
    ${routeList(loc)}
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
  const { kind, id } = parseHash();
  const entry = kind ? state.byId[kind]?.[id] : null;
  let html;
  if (!kind) html = renderStation();
  else if (!entry) html = notFound();
  else if (kind === "location") html = renderLocation(entry);
  else if (kind === "person") html = renderPerson(entry);
  else html = renderFaction(entry);

  els.panel.innerHTML = html;
  els.panel.scrollTop = 0;
  document.title = entry ? `${entry.name} · Prospero's Dream` : "Prospero's Dream Station Map";

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
  // Wait for the fonts so labels are measured and placed with the real widths.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 24px "D-DIN"'), document.fonts.load('400 16px "D-DIN"')]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // If the font can't load, the fallback font is used and the map still works.
  }
  state.scene = window.StationScene.build(state.data.locations);
  fitViewBox();
  window.matchMedia(NARROW).addEventListener("change", fitViewBox);
  drawScene();
  drawMarkers();
  drawLegend();
  window.addEventListener("hashchange", route);
  route();
}

init();
