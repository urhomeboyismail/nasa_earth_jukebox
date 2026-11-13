/* Ixia's page effects: sparks, fireworks, confetti, stardust, hearts, a comet and themed showers, drawn on one canvas
   over the page that never takes a click. Nothing stays: every piece dissolves before it leaves. */

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Shapes, drawn about (0, 0) at a size of about 1 unit. */
const SHAPES = {
  star: (() => {
    const p = new Path2D();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.42 : 1;
      if (i) p.lineTo(r * Math.cos(a), r * Math.sin(a)); else p.moveTo(r * Math.cos(a), r * Math.sin(a));
    }
    p.closePath();
    return p;
  })(),
  sparkle: new Path2D('M0 -1 0.22 -0.22 1 0 0.22 0.22 0 1 -0.22 0.22 -1 0 -0.22 -0.22Z'),
  heart: new Path2D('M0 0.9C-0.6 0.5 -1 0.1 -1 -0.35 -1 -0.75 -0.7 -1 -0.4 -1 -0.2 -1 -0.06 -0.9 0 -0.75 0.06 -0.9 0.2 -1 0.4 -1 0.7 -1 1 -0.75 1 -0.35 1 0.1 0.6 0.5 0 0.9Z'),
  cloud: new Path2D('M-0.95 0.45C-1.2 0.45 -1.25 0.05 -0.95 -0.02 -0.95 -0.4 -0.5 -0.55 -0.25 -0.32 -0.1 -0.75 0.55 -0.75 0.62 -0.2 0.95 -0.25 1.2 0.15 0.95 0.45Z'),
  shield: new Path2D('M0 -1 0.8 -0.7 0.75 0.05C0.7 0.5 0.4 0.8 0 1 -0.4 0.8 -0.7 0.5 -0.75 0.05L-0.8 -0.7Z'),
  bolt: new Path2D('M0.15 -1 -0.6 0.15 -0.05 0.15 -0.2 1 0.6 -0.2 0.05 -0.2Z'),
  cap: new Path2D('M0 -0.75 1.05 -0.25 0 0.25 -1.05 -0.25ZM-0.6 0 -0.6 0.45C-0.3 0.75 0.3 0.75 0.6 0.45L0.6 0 0 0.3Z'),
  node: (() => {
    const p = new Path2D();
    p.arc(0, 0, 0.42, 0, TAU);
    p.moveTo(0.95, 0);
    p.arc(0, 0, 0.95, 0, TAU);
    return p;
  })(),
};

/** Colours and shapes per kind of page. */
const BRAND = ['#5ff3ff', '#a5ecf3', '#2a25c4', '#7d78ff', '#ffffff', '#153ed9'];
const THEMES = {
  home: { colors: BRAND, shapes: ['star', 'sparkle'] },
  cloud: { colors: ['#ffffff', '#cfe9ff', '#9fd7ff', '#5ff3ff'], shapes: ['cloud', 'sparkle'] },
  ai: { colors: ['#7d78ff', '#5ff3ff', '#c4b8ff', '#ffffff'], shapes: ['node', 'sparkle'] },
  security: { colors: ['#5ff3ff', '#153ed9', '#9ff5e1', '#ffffff'], shapes: ['shield', 'sparkle'] },
  digital: { colors: ['#5ff3ff', '#a5ecf3', '#ffffff'], shapes: ['bit', 'sparkle'] },
  course: { colors: ['#ffcf4a', '#5ff3ff', '#7d78ff', '#ffffff'], shapes: ['cap', 'star'] },
  about: { colors: ['#153ed9', '#2a25c4', '#5ff3ff', '#ffffff'], shapes: ['star', 'sparkle'] },
  stories: { colors: ['#ff5a87', '#ff9ab4', '#ffffff', '#ffcf4a'], shapes: ['heart', 'sparkle'] },
  workshops: { colors: ['#ffcf4a', '#5ff3ff', '#ffffff'], shapes: ['bolt', 'sparkle'] },
  account: { colors: ['#ffcf4a', '#5ff3ff', '#ff5a87', '#7d78ff', '#2a25c4'], shapes: ['star', 'confetti'] },
  plain: { colors: ['#5ff3ff', '#2a25c4', '#ff5a87', '#ffcf4a', '#a5ecf3'], shapes: ['confetti', 'sparkle'] },
};

/** The theme for a page, by its address. */
export function themeFor(path) {
  if (path === '/') return 'home';
  const area = /^\/subjects\/([^/]+)/.exec(path);
  if (area) {
    const slug = area[1];
    if (/cloud/.test(slug)) return 'cloud';
    if (/intelligence|\bai\b|machine/.test(slug)) return 'ai';
    if (/secur/.test(slug)) return 'security';
    if (/digital|data|network/.test(slug)) return 'digital';
    return 'home';
  }
  if (/^\/(courses\/[^/]+|my-courses|levels)/.test(path)) return 'course';
  if (path.startsWith('/about')) return 'about';
  if (path.startsWith('/stories')) return 'stories';
  if (path.startsWith('/workshops')) return 'workshops';
  if (path.startsWith('/account') || path.startsWith('/admin')) return 'account';
  return 'plain';
}

const MAX_LIVE = 700;
/** Falling pieces dissolve over the lowest part of the window rather than reaching its edge. */
const FLOOR_FADE = 0.28;
/** Every piece also fades over the last stretch before the edge it is heading for. */
const EDGE_FADE = 90;
/** How long what is left of a page takes to dissolve once the page has changed. */
const PAGE_FADE = 650;

export class PageFx {
  constructor() {
    const c = (this.canvas = document.createElement('canvas'));
    c.setAttribute('aria-hidden', 'true');
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: '2147482990', display: 'block' });
    document.body.appendChild(c);
    this.ctx = c.getContext('2d');
    this.live = [];
    this.raf = 0;
    this.last = 0;
    this.theme = THEMES.plain;
    this.loop = this.loop.bind(this);
    this.size();
    this.onResize = () => this.size();
    addEventListener('resize', this.onResize);
    if (window.visualViewport) visualViewport.addEventListener('resize', this.onResize);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.onResize);
    if (window.visualViewport) visualViewport.removeEventListener('resize', this.onResize);
    this.canvas.remove();
  }

  size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    // The visible window, scroll bar excluded; the canvas's own CSS size matches its drawing size exactly.
    this.w = document.documentElement.clientWidth || innerWidth;
    this.h = innerHeight;
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.kick();
  }

  setPage(path) {
    this.theme = THEMES[themeFor(path)] || THEMES.plain;
  }

  /** Whatever is still in the air fades away (it does so by itself once the page it was played on is left). */
  clear() {
    const now = performance.now();
    for (const p of this.live) if (!p.fadeFrom) p.fadeFrom = now;
    if (this.live.length) this.kick();
  }

  add(p) {
    if (this.live.length >= MAX_LIVE) return;
    this.live.push(Object.assign({ age: 0, rot: rand(0, TAU), vr: rand(-4, 4), drag: 0.6, g: 0, flutter: 0, glow: false, trail: 0, page: location.pathname, fadeFrom: 0 }, p));
  }

  colour() { return pick(this.theme.colors); }
  shape() { return pick(this.theme.shapes); }

  /** Plays an effect from a point of the window (the robot, usually). */
  play(kind, at = { x: this.w * 0.8, y: this.h * 0.8 }, opts = {}) {
    this.setPage(location.pathname);
    const n = (k) => Math.round(k * (opts.amount || 1));
    const { x, y } = at;
    if (kind === 'sparks') {
      for (let i = 0; i < n(70); i++) {
        const a = rand(0, TAU), v = rand(260, 820);
        this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, g: 420, drag: 1.6, life: rand(0.8, 1.6), s: rand(1.4, 2.6), c: this.colour(), shape: 'spark', glow: true });
      }
    } else if (kind === 'fireworks') {
      const bursts = opts.bursts || 3;
      for (let b = 0; b < bursts; b++) {
        const tx = rand(this.w * 0.15, this.w * 0.85), ty = rand(this.h * 0.14, this.h * 0.42);
        this.add({ x: tx + rand(-40, 40), y: this.h + 10, vx: 0, vy: 0, life: 0.85 + b * 0.32, s: 2.4, c: '#ffffff', shape: 'rocket', glow: true, tx, ty, delay: b * 0.32, burst: n(64) });
      }
    } else if (kind === 'confetti') {
      for (let i = 0; i < n(130); i++) {
        this.add({ x: rand(0, this.w), y: rand(-this.h * 0.4, -10), vx: rand(-40, 40), vy: rand(60, 160), g: 90, drag: 0.4, flutter: rand(2, 5), life: rand(4, 7), s: rand(5, 9), c: pick(THEMES.plain.colors.concat(this.theme.colors)), shape: Math.random() < 0.65 ? 'confetti' : this.shape(), falls: true });
      }
    } else if (kind === 'stardust') {
      const cx = opts.centre ? opts.centre.x : this.w / 2, cy = opts.centre ? opts.centre.y : this.h * 0.45;
      for (let i = 0; i < n(110); i++) {
        const a = (i / n(110)) * TAU * 3 + rand(-0.2, 0.2), r = rand(10, 40);
        this.add({ x, y, sx: cx, sy: cy, a, r, vr2: rand(2.2, 3.4), grow: rand(260, Math.max(this.w, this.h) * 0.42), life: rand(2.2, 3.4), s: rand(1.2, 2.6), c: this.colour(), shape: 'swirl', glow: true });
      }
    } else if (kind === 'hearts') {
      for (let i = 0; i < n(20); i++) {
        this.add({ x: x + rand(-30, 30), y: y + rand(-20, 10), vx: rand(-70, 70), vy: rand(-240, -120), g: -30, drag: 0.8, flutter: rand(1.5, 3), life: rand(1.8, 2.8), s: rand(7, 13), c: pick(['#ff5a87', '#ff7fa1', '#ffb3c6', '#ffffff']), shape: 'heart' });
      }
    } else if (kind === 'comet') {
      const fromLeft = Math.random() < 0.5, y0 = rand(this.h * 0.08, this.h * 0.3);
      this.add({ x: fromLeft ? -40 : this.w + 40, y: y0, vx: (fromLeft ? 1 : -1) * rand(900, 1200), vy: rand(160, 260), life: 1.5, s: 3.2, c: '#ffffff', shape: 'comet', glow: true });
    } else if (kind === 'shower') {
      for (let i = 0; i < n(46); i++) {
        this.add({ x: rand(0, this.w), y: rand(-this.h * 0.5, -10), vx: rand(-20, 20), vy: rand(40, 110), g: 60, drag: 0.5, flutter: rand(1, 2.5), life: rand(5, 8), s: rand(7, 12), c: this.colour(), shape: this.shape(), falls: true });
      }
    } else if (kind === 'bubbles') {
      for (let i = 0; i < n(18); i++) {
        this.add({ x: rand(this.w * 0.1, this.w * 0.9), y: this.h + rand(10, 120), vx: rand(-15, 15), vy: rand(-150, -80), g: -10, drag: 0.2, flutter: rand(1, 2), life: rand(3, 5), s: rand(8, 20), c: '#ffffff', shape: 'bubble' });
      }
    }
    this.kick();
  }

  kick() {
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  loop(ms) {
    this.raf = 0;
    const dt = Math.min(0.05, this.last ? (ms - this.last) / 1000 : 1 / 60);
    this.last = ms;
    const { ctx, w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const here = location.pathname, now = performance.now();
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      // Played on a page that has since been left: it dissolves from the first frame after the change.
      if (p.page !== here && !p.fadeFrom) p.fadeFrom = now;
      const fade = p.fadeFrom ? 1 - (now - p.fadeFrom) / PAGE_FADE : 1;
      if (fade <= 0) { this.live.splice(i, 1); continue; }
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      if (this.step(p, dt)) { this.live.splice(i, 1); continue; }
      this.draw(p, fade);
    }
    ctx.globalAlpha = 1;
    if (this.live.length) this.kick();
    else this.last = 0;
  }

  /** Moves a piece on; returns true when it is gone. */
  step(p, dt) {
    if (p.shape === 'rocket') {
      const k = Math.min(1, p.age / p.life), e = 1 - (1 - k) ** 3;
      p.px = p.x; p.py = p.y;
      p.y = this.h + 10 + (p.ty - this.h - 10) * e;
      p.x += (p.tx - p.x) * Math.min(1, dt * 3);
      if (k >= 1) {
        for (let i = 0; i < p.burst; i++) {
          const a = (i / p.burst) * TAU + rand(-0.06, 0.06), v = rand(180, 380);
          this.add({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 160, drag: 1.4, life: rand(1.2, 2), s: rand(1.5, 2.6), c: this.colour(), shape: 'spark', glow: true, page: p.page, fadeFrom: p.fadeFrom });
        }
        return true;
      }
      return false;
    }
    if (p.shape === 'swirl') {
      const k = Math.min(1, p.age / p.life);
      p.px = p.x; p.py = p.y;
      const r = p.r + p.grow * (1 - (1 - k) ** 2), a = p.a + p.vr2 * p.age;
      p.x = p.sx + Math.cos(a) * r; p.y = p.sy + Math.sin(a) * r * 0.62 + 60 * k * k;
      return k >= 1;
    }
    const drag = Math.exp(-p.drag * dt);
    p.vx *= drag; p.vy = p.vy * drag + p.g * dt;
    p.px = p.x; p.py = p.y;
    p.x += (p.vx + (p.flutter ? Math.sin(p.age * p.flutter * 2 + p.rot) * 28 : 0)) * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    return p.age > p.life || (p.vy > 0 && p.y > this.h + 40) || (p.vy < 0 && p.y < -160) || p.x < -80 || p.x > this.w + 80 || (p.falls && p.y > this.h);
  }

  glow(x, y, r, c, a) {
    if (a <= 0.01) return;
    const { ctx } = this;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /** How much of a piece is left: it dissolves over the last third of its life, and a falling one also over the
      lowest part of the window, shrinking a little as it goes. */
  left(p) {
    const k = p.age / p.life;
    let a = k < 0.66 ? 1 : Math.max(0, 1 - (k - 0.66) / 0.34);
    if (p.falls) a = Math.min(a, Math.max(0, (this.h - p.y) / (this.h * FLOOR_FADE)));
    // Heading for an edge: fades over its last stretch before it (a comet coming in from one is heading away from it).
    // A swaying piece's sideways heading comes from its own velocity, not the sway, so it never flickers by an edge.
    const dx = p.flutter ? p.vx : p.px == null ? p.vx || 0 : p.x - p.px, dy = p.py == null ? p.vy || 0 : p.y - p.py;
    if (dx > 0) a = Math.min(a, (this.w - p.x) / EDGE_FADE);
    else if (dx < 0) a = Math.min(a, p.x / EDGE_FADE);
    if (dy > 0) a = Math.min(a, (this.h - p.y) / EDGE_FADE);
    else if (dy < 0) a = Math.min(a, p.y / EDGE_FADE);
    a = Math.max(0, Math.min(1, a));
    return a * a * (3 - 2 * a);
  }

  draw(p, fade) {
    const { ctx } = this;
    const left = this.left(p), a = left * fade;
    if (a <= 0.01) return;
    const size = 0.6 + 0.4 * left;
    ctx.globalAlpha = a;
    if (p.shape === 'spark' || p.shape === 'swirl' || p.shape === 'rocket' || p.shape === 'comet') {
      const tx = p.px == null ? p.x : p.px, ty = p.py == null ? p.y : p.py;
      const stretch = p.shape === 'comet' ? 0.16 : p.shape === 'rocket' ? 2.2 : p.shape === 'swirl' ? 0.55 : 1.6;
      ctx.strokeStyle = p.c;
      ctx.lineCap = 'round';
      ctx.lineWidth = p.s * size;
      ctx.beginPath();
      ctx.moveTo(p.x - (p.x - tx) * stretch * (p.shape === 'comet' ? 20 : 1), p.y - (p.y - ty) * stretch * (p.shape === 'comet' ? 20 : 1));
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      if (p.glow) this.glow(p.x, p.y, p.s * size * (p.shape === 'comet' ? 9 : 4), p.c, a * 0.55);
      if (p.shape === 'comet' && Math.random() < 0.9) {
        this.add({ x: p.x, y: p.y, vx: rand(-40, 40), vy: rand(-20, 30), g: 80, drag: 1.2, life: rand(0.8, 1.6), s: rand(1, 2), c: pick(['#ffffff', '#a5ecf3', '#5ff3ff']), shape: 'spark', glow: true, page: p.page, fadeFrom: p.fadeFrom });
      }
      return;
    }
    if (p.shape === 'bubble') {
      const r = p.s * size;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = 'rgba(165,236,243,0.25)';
      ctx.fill();
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x - r * 0.35, p.y - r * 0.35, r * 0.18, 0, TAU);
      ctx.fill();
      return;
    }
    const s = p.s * size;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.shape === 'confetti') {
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.age * 7 + p.rot));
      ctx.fillStyle = p.c;
      ctx.fillRect(-s * 0.5, -s * 0.3, s, s * 0.6);
    } else if (p.shape === 'bit') {
      ctx.fillStyle = p.c;
      ctx.font = `600 ${Math.round(s * 1.5)}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      p.bit = p.bit == null ? (Math.random() < 0.5 ? '0' : '1') : p.bit;
      ctx.fillText(p.bit, 0, 0);
    } else {
      const path = SHAPES[p.shape] || SHAPES.sparkle;
      ctx.rotate(p.shape === 'heart' || p.shape === 'cloud' ? Math.sin(p.age * 2) * 0.2 : p.rot);
      ctx.scale(s * 0.5, s * 0.5);
      ctx.fillStyle = p.c;
      if (p.shape === 'node') {
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 0.22;
        ctx.stroke(path);
        ctx.beginPath();
        ctx.arc(0, 0, 0.42, 0, TAU);
        ctx.fill();
      } else ctx.fill(path);
    }
    ctx.restore();
  }
}
