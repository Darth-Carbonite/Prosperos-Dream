// Builds the site: reads the Markdown files in content/, checks them for
// mistakes, and writes dist/ (the site files plus dist/data.json).
//
// Run with: npm run build

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const siteDir = path.join(root, "site");
const distDir = path.join(root, "dist");

const AREAS = ["outer-ring", "spokes", "hub", "center-spire", "the-choke"];
const MODULES = ["block", "tower", "cluster", "none"];
const errors = [];

function fail(file, message) {
  errors.push(`  ${path.relative(root, file)}: ${message}`);
}

function asList(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// Reads every .md file in a content folder. The file name (without .md)
// becomes the entry's id, which is what other files use to link to it.
function readFolder(folder) {
  const dir = path.join(contentDir, folder);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      const id = name.replace(/\.md$/, "");
      let parsed;
      try {
        parsed = matter(fs.readFileSync(file, "utf8"));
      } catch (err) {
        fail(file, `the fields block at the top could not be read (${err.reason || err.message})`);
        return null;
      }
      if (!/^[a-z0-9-]+$/.test(id)) {
        fail(file, "file names may only use lowercase letters, numbers and dashes");
      }
      if (!parsed.data.name) fail(file, "missing `name:`");
      return { id, file, ...parsed.data, html: marked.parse(parsed.content.trim()) };
    })
    .filter(Boolean);
}

// Locations are listed by their map number, then by name.
const locations = readFolder("locations").sort(
  (a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || String(a.name).localeCompare(String(b.name))
);
const people = readFolder("people");
const factions = readFolder("factions");
const ships = readFolder("ships");

const stationFile = path.join(contentDir, "station.md");
const stationParsed = matter(fs.readFileSync(stationFile, "utf8"));
const station = { ...stationParsed.data, html: marked.parse(stationParsed.content.trim()) };

const ids = {
  location: new Set(locations.map((l) => l.id)),
  person: new Set(people.map((p) => p.id)),
  faction: new Set(factions.map((f) => f.id)),
};

// `connects_to` can be a plain list of ids, or ids with travel times:
//   connects_to:
//     the-court: 40        (minutes)
//     the-choke: unknown
// This turns either form into [{ to, minutes }], where minutes is a
// number, "unknown", or null when no time was given.
function readConnections(loc) {
  const value = loc.connects_to;
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((to) => ({ to, minutes: null }));
  if (typeof value === "object") {
    return Object.entries(value).map(([to, minutes]) => {
      if (minutes === null || minutes === "unknown" || (typeof minutes === "number" && minutes > 0)) {
        return { to, minutes };
      }
      fail(loc.file, `travel time to "${to}" must be a number of minutes or \`unknown\` (got "${minutes}")`);
      return { to, minutes: null };
    });
  }
  fail(loc.file, "`connects_to` must be a list of ids, or ids with travel times in minutes");
  return [];
}

function checkRefs(entry, field, kind) {
  for (const ref of asList(entry[field])) {
    if (!ids[kind].has(ref)) {
      fail(entry.file, `\`${field}\` lists "${ref}", but there is no ${kind} file named ${ref}.md`);
    }
  }
}

// Check locations.
const numbers = new Map();
for (const loc of locations) {
  if (!AREAS.includes(loc.area)) {
    fail(loc.file, `\`area:\` must be one of: ${AREAS.join(", ")}`);
  }
  const p = loc.placement;
  if (!p || typeof p.angle !== "number") {
    fail(loc.file, "missing `placement:` with an angle, e.g. `placement: { angle: 90 }`");
  } else {
    if (p.distance !== undefined && (typeof p.distance !== "number" || p.distance < 0 || p.distance > 1)) {
      fail(loc.file, "`placement` distance must be a number from 0 (center) to 1 (the ring)");
    }
    if (p.level !== undefined && (typeof p.level !== "number" || p.level < -1 || p.level > 0)) {
      fail(loc.file, "`placement` level must be a number from 0 (top of the spire) to -1 (the bottom)");
    }
  }
  if (loc.module !== undefined && !MODULES.includes(loc.module)) {
    fail(loc.file, `\`module:\` must be one of: ${MODULES.join(", ")}`);
  }
  if (loc.number !== undefined) {
    if (numbers.has(loc.number)) {
      fail(loc.file, `number ${loc.number} is already used by ${numbers.get(loc.number)}.md`);
    }
    numbers.set(loc.number, loc.id);
  }
  loc.links = readConnections(loc);
  for (const { to } of loc.links) {
    if (!ids.location.has(to)) {
      fail(loc.file, `\`connects_to\` lists "${to}", but there is no location file named ${to}.md`);
    }
  }
  checkRefs(loc, "factions", "faction");
  if (loc.inside) checkRefs(loc, "inside", "location");
}

// Check people.
for (const person of people) {
  checkRefs(person, "location", "location");
  checkRefs(person, "factions", "faction");
}

// Check ships. The hull class (the Roman numeral in a designation like
// "J1C-III") sets the size of the ship's icon on the map.
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
for (const ship of ships) {
  if (!ship.classification) {
    fail(ship.file, "missing `classification:`, e.g. `classification: Bas-Lehman Contessa J1C-III Jumpliner`");
    continue;
  }
  const match = String(ship.classification).match(/J\d+C-(I{1,3}|IV|V)\b/);
  ship.hull_class = match ? ROMAN[match[1]] : 2;
}

// Check factions.
for (const faction of factions) {
  checkRefs(faction, "base", "location");
}

if (errors.length) {
  console.error(`\nThe site was NOT built. Please fix these ${errors.length} problem(s):\n`);
  console.error(errors.join("\n"));
  console.error("");
  process.exit(1);
}

// Connections only need to be written in one of the two files; build them
// both ways here so the map and side panel always agree. If both files give
// a travel time, they must match.
const connections = new Map(locations.map((l) => [l.id, new Map()]));
for (const loc of locations) {
  for (const { to, minutes } of loc.links) {
    for (const [a, b] of [[loc.id, to], [to, loc.id]]) {
      const known = connections.get(a).get(b);
      if (known != null && minutes != null && known !== minutes) {
        fail(loc.file, `travel time to "${to}" is ${minutes}, but ${to}.md says ${known}`);
      }
      connections.get(a).set(b, minutes ?? known ?? null);
    }
  }
}

if (errors.length) {
  console.error(`\nThe site was NOT built. Please fix these ${errors.length} problem(s):\n`);
  console.error(errors.join("\n"));
  console.error("");
  process.exit(1);
}

const strip = ({ file, links, ...rest }) => rest;

const data = {
  station,
  locations: locations.map((loc) => ({
    ...strip(loc),
    connects_to: [...connections.get(loc.id).keys()].sort(),
    travel_minutes: Object.fromEntries(connections.get(loc.id)),
    factions: asList(loc.factions),
  })),
  people: people.map((p) => ({
    ...strip(p),
    location: p.location ?? null,
    factions: asList(p.factions),
  })),
  factions: factions.map((f) => ({ ...strip(f), base: f.base ?? null })),
  ships: ships.map(({ id, name, classification, hull_class }) => ({ id, name, classification, hull_class })),
};

fs.rmSync(distDir, { recursive: true, force: true });
fs.cpSync(siteDir, distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "data.json"), JSON.stringify(data, null, 2));

console.log(
  `Built dist/ with ${locations.length} locations, ${people.length} people, ${factions.length} factions and ${ships.length} ships.`
);
