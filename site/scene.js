// Draws the station as an angled 3D wireframe.
//
// Everything is built from simple boxes and cylinders in 3D, then flattened
// onto the screen with a fixed camera angle. Each location's module is
// generated from its id, so it looks the same every time the page loads.
//
// World axes: x points right, y points up, z points toward the viewer.
// Angles go around the station: 0 = front (nearest you), 90 = right,
// 180 = back, 270 = left.

window.StationScene = (function () {
  const DEG = Math.PI / 180;
  const PITCH = 26 * DEG; // how far the camera looks down onto the station
  const COS = Math.cos(PITCH);
  const SIN = Math.sin(PITCH);
  const VIEW = [0, SIN, COS]; // direction from the station toward the camera

  const RING_R = 400; // ring radius
  const TUBE_W = 26; // half-width of the ring tube
  const TUBE_H = 22; // half-height of the ring tube
  const HUB_R = 120;
  const HUB_TOP = 58;
  const SPIRE_LEN = 720;
  const SPIRE_COLLAR = -176; // height of the hazard collar; The Choke starts below it

  // ---------- Small vector helpers ----------

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const centroid = (pts) => mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length);

  function project([x, y, z]) {
    return { x, y: -(y * COS - z * SIN), depth: z * COS + y * SIN };
  }

  function radial(angleDeg, r, y = 0) {
    const a = angleDeg * DEG;
    return [r * Math.sin(a), y, r * Math.cos(a)];
  }

  // A local frame at an angle: u runs along the ring, v points up and
  // w points outward from the center.
  function frameAt(angleDeg) {
    const a = angleDeg * DEG;
    return { u: [Math.cos(a), 0, -Math.sin(a)], v: [0, 1, 0], w: [Math.sin(a), 0, Math.cos(a)] };
  }

  // Seeded random numbers, so a location's module never changes shape.
  function rng(seed) {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => {
      h = (h + 0x6d2b79f5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Shape builders ----------

  // Adds a face only if it points toward the camera.
  function pushFace(faces, pts, outward, meta) {
    if (dot(outward, VIEW) <= 1e-6) return;
    faces.push({ pts, ...meta });
  }

  // A box in a local frame. Tall boxes are cut into slices so they sort
  // correctly against things beside them.
  function box(faces, origin, f, center, size, meta) {
    const [cu, cv, cw] = center;
    const [su, sv, sw] = size;
    const slices = Math.max(1, Math.ceil(sv / 70));
    const h = sv / slices;
    for (let i = 0; i < slices; i++) {
      const midV = cv - sv / 2 + h * (i + 0.5);
      const at = (du, dv, dw) =>
        add(origin, add(mul(f.u, cu + du), add(mul(f.v, midV + dv), mul(f.w, cw + dw))));
      const [hu, hv, hw] = [su / 2, h / 2, sw / 2];
      const c = [
        at(-hu, -hv, -hw), at(hu, -hv, -hw), at(hu, hv, -hw), at(-hu, hv, -hw),
        at(-hu, -hv, hw), at(hu, -hv, hw), at(hu, hv, hw), at(-hu, hv, hw),
      ];
      const mid = centroid(c);
      for (const q of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]]) {
        const pts = q.map((k) => c[k]);
        pushFace(faces, pts, sub(centroid(pts), mid), meta);
      }
    }
  }

  // An upright cylinder around the station's axis (or any x/z center).
  function cylinder(faces, { r, y0, y1, sides = 32, cx = 0, cz = 0, slice = 60 }, meta) {
    const slices = Math.max(1, Math.ceil((y1 - y0) / slice));
    const h = (y1 - y0) / slices;
    const at = (k, y) => {
      const a = (k / sides) * 360 * DEG;
      return [cx + r * Math.sin(a), y, cz + r * Math.cos(a)];
    };
    for (let s = 0; s < slices; s++) {
      const ya = y0 + h * s;
      const yb = ya + h;
      for (let k = 0; k < sides; k++) {
        const pts = [at(k, ya), at(k + 1, ya), at(k + 1, yb), at(k, yb)];
        const mid = centroid(pts);
        pushFace(faces, pts, [mid[0] - cx, 0, mid[2] - cz], meta);
      }
    }
    const cap = [];
    for (let k = 0; k < sides; k++) cap.push(at(k, y1));
    faces.push({ pts: cap, ...meta });
  }

  function ring(faces) {
    const segments = 90;
    const ri = RING_R - TUBE_W;
    const ro = RING_R + TUBE_W;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * 360;
      const a1 = ((i + 1) / segments) * 360;
      const meta = { cls: "face ring" };
      const outward = radial((a0 + a1) / 2, 1);
      pushFace(faces, [radial(a0, ri, TUBE_H), radial(a0, ro, TUBE_H), radial(a1, ro, TUBE_H), radial(a1, ri, TUBE_H)], [0, 1, 0], meta);
      pushFace(faces, [radial(a0, ro, -TUBE_H), radial(a1, ro, -TUBE_H), radial(a1, ro, TUBE_H), radial(a0, ro, TUBE_H)], outward, meta);
      pushFace(faces, [radial(a0, ri, -TUBE_H), radial(a1, ri, -TUBE_H), radial(a1, ri, TUBE_H), radial(a0, ri, TUBE_H)], mul(outward, -1), meta);
    }
  }

  function spoke(faces, angle) {
    const f = frameAt(angle);
    const start = HUB_R - 10;
    const end = RING_R - TUBE_W;
    const pieces = 8;
    const len = (end - start) / pieces;
    for (let i = 0; i < pieces; i++) {
      box(faces, [0, 0, 0], f, [0, 0, start + len * (i + 0.5)], [20, 16, len], { cls: "face spoke" });
    }
  }

  function hub(faces) {
    cylinder(faces, { r: 178, y0: -6, y1: 6, sides: 48 }, { cls: "face hub" });
    cylinder(faces, { r: HUB_R, y0: -26, y1: 44, sides: 40 }, { cls: "face hub" });
    cylinder(faces, { r: 86, y0: 44, y1: HUB_TOP, sides: 36 }, { cls: "face hub" });
  }

  function spire(faces) {
    const rand = rng("spire");
    cylinder(faces, { r: 78, y0: -SPIRE_LEN, y1: -20, sides: 14 }, { cls: "face spire" });
    // Pillars of different lengths hang from the hub, like a tangle of decks.
    for (let k = 0; k < 14; k++) {
      const angle = k * (360 / 14) + rand() * 12;
      const f = frameAt(angle);
      const dist = 82 + rand() * 26;
      const top = -24 - rand() * 50;
      const bottom = -SPIRE_LEN * (0.42 + rand() * 0.66);
      const width = 24 + rand() * 26;
      box(faces, [0, 0, 0], f, [0, (top + bottom) / 2, dist], [width, top - bottom, 22 + rand() * 22], { cls: "face spire" });
    }
    // Buttresses under the hub.
    for (let k = 0; k < 6; k++) {
      const f = frameAt(k * 60 + 30);
      box(faces, [0, 0, 0], f, [0, -70, 118], [34, 90, 30], { cls: "face spire" });
    }
    // A hazard collar: below this line is The Choke.
    cylinder(faces, { r: 134, y0: SPIRE_COLLAR - 14, y1: SPIRE_COLLAR, sides: 40, slice: 100 }, { cls: "face hazard" });
  }

  // ---------- Location modules ----------

  function rangeRand(rand, lo, hi) {
    return lo + rand() * (hi - lo);
  }

  // Returns the module's highest point (in local units above its origin).
  function moduleShape(faces, origin, f, type, scale, meta, rand) {
    const s = scale;
    const put = (c, size) => box(faces, origin, f, mul(c, s), mul(size, s), meta);
    let top = 0;
    const track = (cv, sv) => (top = Math.max(top, (cv + sv / 2) * s));

    if (type === "tower") {
      put([0, 30, 0], [110, 80, 100]);
      track(30, 80);
      const columns = 5 + Math.floor(rand() * 2);
      for (let i = 0; i < columns; i++) {
        const sv = rangeRand(rand, 140, 320);
        const c = [rangeRand(rand, -38, 38), 70 + sv / 2, rangeRand(rand, -32, 32)];
        put(c, [rangeRand(rand, 24, 44), sv, rangeRand(rand, 24, 44)]);
        track(c[1], sv);
      }
      for (let i = 0; i < 3; i++) {
        const side = i % 2 ? 1 : -1;
        put([side * rangeRand(rand, 60, 80), rangeRand(rand, 0, 60), rangeRand(rand, -30, 30)], [40, 36, 40]);
      }
      return top;
    }

    if (type === "cluster") {
      const n = 10 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        const sv = rangeRand(rand, 24, 70);
        const c = [rangeRand(rand, -85, 85), rangeRand(rand, -50, 60), rangeRand(rand, -50, 50)];
        put(c, [rangeRand(rand, 24, 64), sv, rangeRand(rand, 24, 64)]);
        track(c[1], sv);
      }
      return top;
    }

    // "block": a main body with smaller pieces stacked on, beside and under it.
    put([0, 25, 0], [104, 72, 92]);
    track(25, 72);
    const extras = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < extras; i++) {
      const su = rangeRand(rand, 26, 60);
      const sv = rangeRand(rand, 20, 56);
      const sw = rangeRand(rand, 26, 60);
      const pick = rand();
      let c;
      if (pick < 0.5) c = [rangeRand(rand, -34, 34), 61 + sv / 2, rangeRand(rand, -28, 28)];
      else if (pick < 0.8) c = [(rand() < 0.5 ? -1 : 1) * (52 + su / 2 - 8), rangeRand(rand, 0, 50), rangeRand(rand, -30, 30)];
      else c = [rangeRand(rand, -30, 30), -11 - sv / 2, rangeRand(rand, -26, 26)];
      put(c, [su, sv, sw]);
      track(c[1], sv);
    }
    return top;
  }

  // Works out where a location sits, from its `placement` fields.
  function placementOf(loc) {
    const p = loc.placement;
    const distance = p.distance ?? 1;
    const level = p.level ?? 0;
    if (distance === 0 && level < 0) return { kind: "spire", angle: p.angle, level };
    if (distance === 0) return { kind: "hub", angle: p.angle };
    if (distance < 1) return { kind: "spoke", angle: p.angle, r: HUB_R + (RING_R - HUB_R) * distance };
    return { kind: "ring", angle: p.angle };
  }

  // Locations on the spire don't get a building of their own. Instead each
  // one owns a section of the spire around its level, so it lights up and
  // can be clicked like any other module. Sections run from the hazard
  // collar down to the bottom, split halfway between neighboring locations.
  function claimSpireSections(faces, locations) {
    const onSpire = locations
      .map((loc) => ({ loc, where: placementOf(loc) }))
      .filter(({ where }) => where.kind === "spire")
      .sort((a, b) => b.where.level - a.where.level);
    if (!onSpire.length) return;

    const sections = onSpire.map(({ loc, where }, i) => {
      const above = onSpire[i - 1];
      const below = onSpire[i + 1];
      return {
        loc,
        top: above ? ((above.where.level + where.level) / 2) * SPIRE_LEN : SPIRE_COLLAR,
        bottom: below ? ((below.where.level + where.level) / 2) * SPIRE_LEN : -Infinity,
      };
    });

    for (const face of faces) {
      if (!face.cls.includes("spire")) continue;
      const y = centroid(face.pts)[1];
      const section = sections.find((s) => y <= s.top && y > s.bottom);
      if (!section) continue;
      face.loc = section.loc.id;
      face.cls += ` module${section.loc.area === "the-choke" ? " is-hazard" : ""}`;
    }
  }

  function build(locations) {
    const faces = [];
    const anchors = {}; // where each location's numbered marker floats
    const docks = {}; // the middle of each location's module, where ships fly in
    const spokeAngles = new Set();

    for (const loc of locations) {
      const where = placementOf(loc);
      if (where.kind === "ring" || where.kind === "spoke") spokeAngles.add(Math.round(where.angle));
    }

    ring(faces);
    for (const angle of spokeAngles) spoke(faces, angle);
    hub(faces);
    spire(faces);

    for (const loc of locations) {
      const where = placementOf(loc);
      const meta = { cls: `face module${loc.area === "the-choke" ? " is-hazard" : ""}`, loc: loc.id };
      const rand = rng(loc.id);
      const f = frameAt(where.angle);

      if (where.kind === "spire") {
        anchors[loc.id] = project(radial(where.angle, 104, where.level * SPIRE_LEN));
        docks[loc.id] = anchors[loc.id];
        continue;
      }

      let origin, scale;
      if (where.kind === "hub") [origin, scale] = [[0, HUB_TOP + 8, 0], 1.05];
      else if (where.kind === "spoke") [origin, scale] = [radial(where.angle, where.r, 0), 0.72];
      else [origin, scale] = [radial(where.angle, RING_R, 0), 1];

      const type = loc.module || "block";
      const top = type === "none" ? 20 : moduleShape(faces, origin, f, type, scale, meta, rand);
      anchors[loc.id] = project(add(origin, [0, top + 34, 0]));
      docks[loc.id] = project(add(origin, [0, 25 * scale, 0]));
    }

    claimSpireSections(faces, locations);

    const drawn = faces
      .map((face) => {
        const pts = face.pts.map(project);
        const depth = pts.reduce((sum, p) => sum + p.depth, 0) / pts.length;
        return { ...face, pts, depth };
      })
      .sort((a, b) => a.depth - b.depth);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const face of drawn) {
      for (const p of face.pts) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
    for (const a of Object.values(anchors)) {
      minY = Math.min(minY, a.y - 30);
    }

    return { faces: drawn, anchors, docks, bounds: { minX, minY, maxX, maxY } };
  }

  return { build };
})();
