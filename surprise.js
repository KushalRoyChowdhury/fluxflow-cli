// 🎆 surprise.js — A tiny fireworks show for your terminal
// Run: node surprise.js   (auto-exits after ~14s, or Ctrl+C anytime)
// Zero dependencies. Pure ANSI chaos.

const W = process.stdout.columns || 100;
const H = Math.min(process.stdout.rows || 30, 40);
const DURATION_MS = 60000;

const COLORS = [196, 202, 208, 214, 220, 226, 118, 46, 51, 87, 123, 159, 213, 207, 201];
const SPARK_CHARS = ['*', '+', '·', '✦', '˙', '.'];

let rockets = [];
let sparks = [];
let running = true;

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function launchRocket() {
  rockets.push({
    x: rand(5, W - 5),
    y: H - 2,
    vy: -rand(0.9, 1.6),
    targetY: rand(3, H * 0.35),
    color: pick(COLORS),
    trail: true,
  });
}

function explode(x, y) {
  const count = Math.floor(rand(30, 70));
  const baseColor = pick(COLORS);
  const shape = pick(['burst', 'ring', 'willow']);
  for (let i = 0; i < count; i++) {
    let vx, vy;
    if (shape === 'ring') {
      const angle = (i / count) * Math.PI * 2;
      const speed = rand(0.8, 1.1);
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed * 0.55; // squashed ring
    } else {
      const angle = rand(0, Math.PI * 2);
      const speed = shape === 'willow' ? rand(0.2, 0.7) : rand(0.4, 1.4);
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed * 0.6;
    }
    sparks.push({
      x, y, vx, vy,
      life: shape === 'willow' ? rand(60, 110) : rand(25, 55),
      maxLife: 0,
      color: Math.random() < 0.75 ? baseColor : pick(COLORS),
      gravity: shape === 'willow' ? 0.02 : 0.045,
      char: pick(SPARK_CHARS),
    });
    sparks[sparks.length - 1].maxLife = sparks[sparks.length - 1].life;
  }
}

function step() {
  // rockets
  for (const r of rockets) {
    r.y += r.vy;
    if (r.y <= r.targetY || r.vy >= -0.2) {
      r.dead = true;
      explode(r.x, r.y);
    }
  }
  rockets = rockets.filter((r) => !r.dead);

  // sparks
  for (const s of sparks) {
    s.x += s.vx;
    s.y += s.vy;
    s.vy += s.gravity;
    s.vx *= 0.985;
    s.life--;
  }
  sparks = sparks.filter((s) => s.life > 0 && s.x > 0 && s.x < W && s.y > 0 && s.y < H);
}

function render() {
  const buf = Array.from({ length: H }, () => new Array(W).fill(null));

  for (const r of rockets) {
    const cx = Math.round(r.x), cy = Math.round(r.y);
    if (cy >= 0 && cy < H && cx >= 0 && cx < W)
      buf[cy][cx] = { ch: '|', color: 250 };
    // faint trail
    const ty = cy + 1;
    if (ty < H && Math.random() < 0.6 && buf[ty][cx] === null)
      buf[ty][cx] = { ch: '.', color: 240 };
  }

  for (const s of sparks) {
    const cx = Math.round(s.x), cy = Math.round(s.y);
    if (cy >= 0 && cy < H && cx >= 0 && cx < W) {
      const ratio = s.life / s.maxLife;
      const ch = ratio > 0.66 ? s.char : ratio > 0.33 ? '+' : '.';
      buf[cy][cx] = { ch, color: s.color };
    }
  }

  let out = '\x1b[H';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cell = buf[y][x];
      out += cell ? `\x1b[38;5;${cell.color}m${cell.ch}` : ' ';
    }
    out += '\x1b[0m\n';
  }
  process.stdout.write(out);
}

function cleanup(msg) {
  running = false;
  process.stdout.write(`\x1b[?25h\x1b[0m\n${msg}\n`);
  process.exit(0);
}

// ── Showtime ──────────────────────────────────────────────
process.stdout.write('\x1b[2J\x1b[?25l'); // clear screen, hide cursor
process.on('SIGINT', () =>
  cleanup('\n🎆 Show cut short! The sky will miss you.')
);

const QUOTES = [
  '🎆 Boom. You just watched math become art.',
  '✨ Physics called — it wants its gravity back.',
  '🎇 That was 100% JavaScript. No pixels were harmed.',
  '🌟 Thanks for watching! Tip your local terminal.',
];

setTimeout(() => cleanup('\n' + pick(QUOTES)), DURATION_MS).unref();

setInterval(() => {
  if (!running) return;
  if (Math.random() < 0.35 && rockets.length < 4) launchRocket();
  step();
  render();
}, 33); // ~30fps
