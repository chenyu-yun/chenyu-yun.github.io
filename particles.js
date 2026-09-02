(function () {
  "use strict";

  const hero = document.querySelector("[data-particle-hero]");
  if (!hero) return;

  const canvas = hero.querySelector(".particle-grid");
  const context = canvas && canvas.getContext("2d");
  if (!canvas || !context) return;

  const settings = {
    gap: 90,
    radius: 140,
    spring: 0.05,
    damping: 0.85,
    fps: 30
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const interactive = finePointer && !reducedMotion;
  const mouse = { x: Number.NaN, y: Number.NaN };

  let width = 0;
  let height = 0;
  let columns = 0;
  let rows = 0;
  let points = [];
  let frameRequest = 0;
  let lastFrame = 0;
  let visible = true;
  let resizeTimer = 0;

  function rebuild() {
    const rect = hero.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    columns = Math.ceil(width / settings.gap) + 1;
    rows = Math.ceil(height / settings.gap) + 1;

    const offsetX = (width - (columns - 1) * settings.gap) / 2;
    const offsetY = (height - (rows - 1) * settings.gap) / 2;

    points = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = offsetX + column * settings.gap;
        const y = offsetY + row * settings.gap;
        points.push({ restX: x, restY: y, x: x, y: y, vx: 0, vy: 0 });
      }
    }

    wake();
  }

  function connect(first, second) {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 20) return;

    const normalX = dx / distance;
    const normalY = dy / distance;
    context.moveTo(first.x + normalX * 10, first.y + normalY * 10);
    context.lineTo(second.x - normalX * 10, second.y - normalY * 10);
  }

  function updatePoints() {
    let maximumVelocity = 0;

    for (const point of points) {
      if (interactive && Number.isFinite(mouse.x)) {
        const dx = point.x - mouse.x;
        const dy = point.y - mouse.y;
        const distance = Math.hypot(dx, dy);

        if (distance < settings.radius && distance > 0.1) {
          const force = (1 - distance / settings.radius) * 3;
          point.vx += (dx / distance) * force;
          point.vy += (dy / distance) * force;
        }
      }

      point.vx += (point.restX - point.x) * settings.spring;
      point.vy += (point.restY - point.y) * settings.spring;
      point.vx *= settings.damping;
      point.vy *= settings.damping;
      point.x += point.vx;
      point.y += point.vy;

      maximumVelocity = Math.max(
        maximumVelocity,
        Math.abs(point.vx) + Math.abs(point.vy)
      );
    }

    return maximumVelocity;
  }

  function drawLines() {
    context.beginPath();
    context.strokeStyle = "rgba(255, 255, 255, 0.08)";
    context.lineWidth = 0.5;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        if (column < columns - 1) connect(points[index], points[index + 1]);
        if (row < rows - 1) connect(points[index], points[index + columns]);
      }
    }

    context.stroke();
  }

  function drawDots() {
    context.fillStyle = "#ffffff";

    for (const point of points) {
      let size = 1.8;
      let opacity = 0.16;

      if (Number.isFinite(mouse.x)) {
        const distance = Math.hypot(point.x - mouse.x, point.y - mouse.y);
        const influence = Math.max(0, 1 - distance / settings.radius);
        size += influence * 2;
        opacity += influence * 0.4;
      }

      context.globalAlpha = opacity;
      context.fillRect(point.x - size, point.y - size, size * 2, size * 2);
    }

    context.globalAlpha = 1;
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    const velocity = updatePoints();
    drawLines();
    drawDots();
    return velocity;
  }

  function animate(time) {
    frameRequest = 0;
    if (!visible) return;

    if (time - lastFrame < 1000 / settings.fps) {
      wake();
      return;
    }

    lastFrame = time;
    if (draw() > 0.01) wake();
  }

  function wake() {
    if (!frameRequest && visible) frameRequest = window.requestAnimationFrame(animate);
  }

  if (interactive) {
    hero.addEventListener("pointermove", function (event) {
      const rect = hero.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;

      hero.style.setProperty("--hero-mouse-x", (mouse.x / rect.width) * 100 + "%");
      hero.style.setProperty("--hero-mouse-y", (mouse.y / rect.height) * 100 + "%");
      wake();
    }, { passive: true });

    hero.addEventListener("pointerleave", function () {
      mouse.x = Number.NaN;
      mouse.y = Number.NaN;
      wake();
    });
  }

  new ResizeObserver(function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(rebuild, 120);
  }).observe(hero);

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible) wake();
  }, { threshold: 0 }).observe(hero);

  rebuild();
}());
