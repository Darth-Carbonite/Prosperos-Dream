// Ships that fly in from the edge of the map, dock at the Dry Dock for a
// while, then leave again.
//
// Each ship is always in one of four states: away (off the map), arriving,
// docked (hidden inside the Dry Dock), or departing. Timers are random so
// traffic stays slow and spread out, and only a few ships fly at once.
// Hovering over a ship pauses it and shows its classification.
//
// All the timing knobs are in TIMING below.

window.StationShips = (function () {
  const SVG_NS = "http://www.w3.org/2000/svg";

  const TIMING = {
    flight: [45, 70], // seconds to fly between the map edge and the dock
    docked: [60, 200], // seconds spent inside the Dry Dock
    away: [40, 160], // seconds spent off the map between visits
    firstArrival: 4, // seconds before the first ship shows up
    maxFlying: 3, // never more than this many ships in the air at once
    minGap: 12, // at least this many seconds between ships setting off
    retry: [5, 15], // if a ship can't go yet, try again after this long
  };

  const between = ([lo, hi]) => lo + Math.random() * (hi - lo);
  const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t); // gentle start and stop

  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  function start({ layer, ships, dock, getView, isNarrow }) {
    if (!ships?.length || !dock) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let clock = 0;
    let lastLaunch = -Infinity;

    // A point just outside the edge of the map, on the side nearest the
    // Dry Dock so ships don't cross the whole station.
    function edgePoint() {
      const v = getView();
      const pad = 60;
      const roll = Math.random() * 6;
      if (roll < 3) return { x: v.x - pad, y: v.y + v.h * (0.15 + Math.random() * 0.75) }; // left
      if (roll < 5) return { x: v.x + v.w * Math.random() * 0.28, y: v.y + v.h + pad }; // bottom left
      return { x: v.x + v.w * Math.random() * 0.35, y: v.y - pad }; // top left
    }

    // A gently curved path between two points.
    function makePath(from, to) {
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const bend = (Math.random() - 0.5) * 0.5;
      return { from, to, ctrl: { x: mx - dy * bend, y: my + dx * bend } };
    }

    function pointOn({ from, ctrl, to }, t) {
      const u = 1 - t;
      return {
        x: u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x,
        y: u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y,
        dx: 2 * u * (ctrl.x - from.x) + 2 * t * (to.x - ctrl.x),
        dy: 2 * u * (ctrl.y - from.y) + 2 * t * (to.y - ctrl.y),
      };
    }

    const fleet = ships.map((data, i) => {
      const g = el("g", { class: "ship", visibility: "hidden" }, layer);
      el("circle", { class: "ship-hit", r: 22 }, g);
      const hull = el("g", { class: "ship-hull" }, g);
      el("circle", { class: "ship-engine", cx: -7, cy: 0, r: 2.4 }, hull);
      el("path", { class: "ship-body", d: "M9,0 L-6,-5.5 L-3.5,0 L-6,5.5 Z" }, hull);
      const name = el("text", { class: "ship-name", x: 18, y: -10 }, g);
      name.textContent = data.name;
      const cls = el("text", { class: "ship-class", x: 18, y: 12 }, g);
      cls.textContent = data.classification;

      const ship = { data, g, hull, state: "away", timer: 0, paused: false, path: null, progress: 0, duration: 0 };
      g.addEventListener("pointerenter", () => {
        ship.paused = true;
        g.classList.add("is-hover");
      });
      g.addEventListener("pointerleave", () => {
        ship.paused = false;
        g.classList.remove("is-hover");
      });
      return ship;
    });

    // Start with about half the fleet docked, the rest away, on staggered timers.
    const order = [...fleet].sort(() => Math.random() - 0.5);
    order.forEach((ship, i) => {
      if (i % 2 === 0) {
        ship.state = "docked";
        ship.timer = between([20, TIMING.docked[1]]);
      } else {
        ship.state = "away";
        ship.timer = i === 1 ? TIMING.firstArrival : between([20, TIMING.away[1]]);
      }
    });

    function flying() {
      return fleet.filter((s) => s.state === "arriving" || s.state === "departing").length;
    }

    function launch(ship, nextState) {
      const size = ship.data.hull_class || 2;
      ship.duration = between(TIMING.flight) * (1 + 0.06 * (size - 1)); // big ships are a little slower
      ship.progress = 0;
      ship.state = nextState;
      ship.path = nextState === "arriving" ? makePath(edgePoint(), dock) : makePath(dock, edgePoint());
      lastLaunch = clock;
      ship.g.setAttribute("visibility", "visible");
    }

    function update(ship, dt) {
      if (ship.state === "away" || ship.state === "docked") {
        ship.timer -= dt;
        if (ship.timer > 0) return;
        if (flying() >= TIMING.maxFlying || clock - lastLaunch < TIMING.minGap) {
          ship.timer = between(TIMING.retry);
          return;
        }
        launch(ship, ship.state === "away" ? "arriving" : "departing");
        return;
      }

      if (!ship.paused) ship.progress += dt / ship.duration;
      if (ship.progress >= 1) {
        ship.g.setAttribute("visibility", "hidden");
        ship.g.classList.remove("is-hover");
        ship.paused = false;
        if (ship.state === "arriving") {
          ship.state = "docked";
          ship.timer = between(TIMING.docked);
        } else {
          ship.state = "away";
          ship.timer = between(TIMING.away);
        }
        return;
      }
      draw(ship);
    }

    function draw(ship) {
      const t = ease(Math.min(ship.progress, 1));
      const p = pointOn(ship.path, t);
      // Ships shrink and fade as they slip into the Dry Dock, and grow back
      // as they leave it.
      const nearDock = ship.state === "arriving" ? (t - 0.88) / 0.12 : (0.12 - t) / 0.12;
      const fade = Math.max(0, Math.min(1, nearDock));
      const size = (1.05 + 0.2 * (ship.data.hull_class || 2)) * (isNarrow() ? 1.7 : 1);
      const scale = size * (1 - 0.6 * fade);
      const angle = (Math.atan2(p.dy, p.dx) * 180) / Math.PI;
      ship.g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      ship.hull.setAttribute("transform", `rotate(${angle.toFixed(1)}) scale(${scale.toFixed(2)})`);
      ship.g.style.opacity = (1 - fade).toFixed(2);
    }

    let last = performance.now();
    function tick(now) {
      const dt = Math.min((now - last) / 1000, 0.1); // timers pause while the tab is hidden
      last = now;
      clock += dt;
      for (const ship of fleet) update(ship, dt);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  return { start };
})();
