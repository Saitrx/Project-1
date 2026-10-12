const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

const LINK_DISTANCE = 130;
const MOUSE_RADIUS = 150;
const MAX_PARTICLES = 300;

let width = 0;
let height = 0;
const particles = [];
const mouse = { x: null, y: null };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createParticle(x = Math.random() * width, y = Math.random() * height) {
  const speed = 0.3 + Math.random() * 0.7;
  const angle = Math.random() * Math.PI * 2;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 1.5 + Math.random() * 2,
    hue: 180 + Math.random() * 120, // cyan through purple
  };
}

function update(p) {
  // Push particles away from the cursor.
  if (mouse.x !== null) {
    const dx = p.x - mouse.x;
    const dy = p.y - mouse.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0 && dist < MOUSE_RADIUS) {
      const force = (1 - dist / MOUSE_RADIUS) * 3;
      p.x += (dx / dist) * force;
      p.y += (dy / dist) * force;
    }
  }

  p.x += p.vx;
  p.y += p.vy;

  // Bounce off the edges of the screen.
  if (p.x < 0 || p.x > width) p.vx *= -1;
  if (p.y < 0 || p.y > height) p.vy *= -1;
  p.x = Math.max(0, Math.min(width, p.x));
  p.y = Math.max(0, Math.min(height, p.y));
}

function draw() {
  ctx.fillStyle = "#0a0c18";
  ctx.fillRect(0, 0, width, height);

  // Connect nearby particles; lines fade out as they get longer.
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i];
      const b = particles[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < LINK_DISTANCE) {
        const alpha = (1 - dist / LINK_DISTANCE) * 0.5;
        ctx.strokeStyle = `hsla(${a.hue}, 80%, 65%, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  for (const p of particles) {
    ctx.fillStyle = `hsl(${p.hue}, 90%, 70%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function frame() {
  particles.forEach(update);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);

canvas.addEventListener("pointermove", (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});

canvas.addEventListener("pointerleave", () => {
  mouse.x = null;
  mouse.y = null;
});

canvas.addEventListener("pointerdown", (event) => {
  for (let i = 0; i < 8 && particles.length < MAX_PARTICLES; i++) {
    particles.push(createParticle(event.clientX, event.clientY));
  }
});

resize();

// Scale the starting particle count to the screen size.
const startCount = Math.min(150, Math.max(40, Math.round((width * height) / 12000)));
for (let i = 0; i < startCount; i++) {
  particles.push(createParticle());
}

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  draw(); // Show a still frame for people who prefer less motion.
} else {
  requestAnimationFrame(frame);
}
