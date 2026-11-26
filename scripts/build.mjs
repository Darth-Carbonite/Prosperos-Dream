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

const stationFile = path.join(contentDir, "station.md");
const stationParsed = matter(fs.readFileSync(stationFile, "utf8"));
const station = { ...stationParsed.data, html: marked.parse(stationParsed.content.trim()) };

const ids = {
  location: new Set(locations.map((l) => l.id)),
  person: new Set(people.map((p) => p.id)),
  faction: new Set(factions.map((f) => f.id)),
};

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
  checkRefs(loc, "connects_to", "location");
  checkRefs(loc, "factions", "faction");
  if (loc.inside) checkRefs(loc, "inside", "location");
}

// Check people.
for (const person of people) {
  checkRefs(person, "location", "location");
  checkRefs(person, "factions", "faction");
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
// both ways here so the map and side panel always agree.
const connections = new Map(locations.map((l) => [l.id, new Set()]));
for (const loc of locations) {
  for (const other of asList(loc.connects_to)) {
    connections.get(loc.id).add(other);
    connections.get(other).add(loc.id);
  }
}

const strip = ({ file, ...rest }) => rest;

const data = {
  station,
  locations: locations.map((loc) => ({
    ...strip(loc),
    connects_to: [...connections.get(loc.id)].sort(),
    factions: asList(loc.factions),
  })),
  people: people.map((p) => ({
    ...strip(p),
    location: p.location ?? null,
    factions: asList(p.factions),
  })),
  factions: factions.map((f) => ({ ...strip(f), base: f.base ?? null })),
};

fs.rmSync(distDir, { recursive: true, force: true });
fs.cpSync(siteDir, distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "data.json"), JSON.stringify(data, null, 2));

console.log(
  `Built dist/ with ${locations.length} locations, ${people.length} people and ${factions.length} factions.`
);
