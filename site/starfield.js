// A slowly turning field of stars behind the station map.
//
// Stars are scattered over a disc big enough to cover the whole map area at
// any angle, then the disc is rotated a little every frame. A few stars are
// tinted pink or purple to match the station, and each one twinkles gently.
// People who ask their system for reduced motion get a still starfield.

(function () {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const TURN_SECONDS = 420; // one full turn every 7 minutes
  const SPEED = (2 * Math.PI) / TURN_SECONDS; // radians per second
  const STAR_DENSITY = 1 / 520; // stars per square pixel

  const COLORS = {
    white: "236, 230, 255",
    pink: "255, 120, 190",
    purple: "190, 150, 255",
  };

  let stars = [];
  let width = 0;
  let height = 0;
  let angle = 0;
  let last = performance.now();
  let frame = null;

  // Seeded random numbers, so the same sky appears on every visit.
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeStars() {
    const rand = rng(1979);
    const radius = Math.hypot(width, height) / 2 + 8;
    const count = Math.round(Math.PI * radius * radius * STAR_DENSITY);
    stars = [];
    for (let i = 0; i < count; i++) {
      const roll = rand();
      const bright = roll > 0.95;
      const tint = rand();
      stars.push({
        r: radius * Math.sqrt(rand()), // even spread over the disc
        a: rand() * Math.PI * 2,
        size: bright ? 1.3 + rand() * 1.2 : 0.6 + rand() * 0.8,
        alpha: bright ? 0.85 + rand() * 0.15 : 0.3 + rand() * 0.6,
        color: tint < 0.08 ? COLORS.pink : tint < 0.16 ? COLORS.purple : COLORS.white,
        bright,
        twinkle: 0.4 + rand() * 1.4,
        phase: rand() * Math.PI * 2,
      });
    }
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    // Turn around a point a little above the middle, near the station's hub.
    const cx = width / 2;
    const cy = height * 0.42;
    const still = reducedMotion.matches;

    for (const s of stars) {
      const x = cx + s.r * Math.cos(s.a + angle);
      const y = cy + s.r * Math.sin(s.a + angle);
      if (x < -4 || y < -4 || x > width + 4 || y > height + 4) continue;

      const flicker = still ? 1 : 0.7 + 0.3 * Math.sin(time * 0.001 * s.twinkle + s.phase);
      const alpha = s.alpha * flicker;

      if (s.bright) {
        // A soft halo around the brightest stars.
        ctx.fillStyle = `rgba(${s.color}, ${alpha * 0.18})`;
        ctx.beginPath();
        ctx.arc(x, y, s.size * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${s.color}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, s.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(${s.color}, ${alpha})`;
        ctx.fillRect(x - s.size / 2, y - s.size / 2, s.size, s.size);
      }
    }
  }

  function tick(now) {
    const seconds = Math.min((now - last) / 1000, 0.1); // no jump after the tab was hidden
    last = now;
    angle += SPEED * seconds;
    draw(now);
    frame = requestAnimationFrame(tick);
  }

  function start() {
    cancelAnimationFrame(frame);
    if (reducedMotion.matches) {
      draw(0);
      return;
    }
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeStars();
    draw(performance.now());
  }

  new ResizeObserver(resize).observe(canvas);
  reducedMotion.addEventListener("change", start);
  resize();
  start();
})();
