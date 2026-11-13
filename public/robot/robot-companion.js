/* <robot-companion> — Ixia, the learning hub's 3D companion: it floats beside the page, reacts to what happens on it,
   answers premade questions, guides tours and asks revision questions. three.js loads once the page has.

   JS API
     robot.say(text, { gesture, face, at, side, hold, speed }) · gesture(name, opts) · face(name, seconds) · emote(kind, n)
     robot.guide(target, text) · tour([{ target, say }], { title }) · tip({ text, target, important }) · ask(question)
     robot.openChat() · closeChat() · hush() · configure({...}) · navigate = href => router.push(href)
   Page events  window 'robot:moment' { kind: success | error | form-invalid | no-results | quiz-result | enrolled |
                registered | course-completed, ... }
   Config       name · greeting(s) · welcomeBack · chatIntro(s) · placeholder · noMatch · dismiss · returns · recharged ·
                moments · audience · firstName · featured · action · lines · pokes · invitations · labels · tipTiming ·
                faq · tips · pages · private · revision { questions, focus, label }
   Attributes   config · three · bubble (left | right | top) · look (cursor | none) · logo · quiet
   Events       robot-ready · robot-click (cancelable) · robot-ask · robot-tip
   Theming      the --robot-* custom properties below, each with a light-theme fallback. */
(() => {
  if (customElements.get('robot-companion')) return;
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || new URL('/robot/robot-companion.js', location.href).href;
  const FX_URL = new URL('robot-fx.js', SCRIPT_SRC).href;
  const THREE_URL = 'https://unpkg.com/three@0.184.0/build/three.module.js';
  const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAEACAYAAADFkM5nAAAQAElEQVR4AeydB9hdRbm2s39pKuWiCQgIKk1aDhB+pEiTKp0EDYmEonRCR5pKgqIgASUQgeBPCZAQShASkHZoAgEp0qX9SI1waAcIhyrfuR9IQspX9l57tZl5uN6HWXvvtWbe956db9691ppZ/6eX/zMBEzABEzABE0iOgBOA5LrcAZuACZiACZhAr15OAPwtMAETMAETMIEECTgBSLDTHbIJmIAJmEDaBBS9EwBRsEzABEzABEwgMQJOABLrcIdrAiZgAiaQOoHP43cC8DkH/98ETMAETMAEkiLgBCCp7nawJmACJlAfAh0dHb07OjomoEcC0fj60MvuydQjnQBMJeHSBEzABEygbAJfo8F10MqBSL7iahzmBCCOfnQUJmACJmACJtAEgS92cQLwBQtvmYAJmIAJmEAyBJwAJNPVDtQETMAETCB1AtPH7wRgehreNgETMAETMIFECDgBSKSjHaYJmIAJmEDqBGaM3wnAjDz8ygRMwARMwASSIOAEIIludpAmYAImYAKpE5g5ficAMxPxaxMwARMwARNIgIATgAQ62SGagAmYgAmkTmDW+J0AzMrE75iACZiACZhA9AScAETfxQ7QBEzABEwgdQKdxe8EoDMqfs8ETMAETMAEIifgBCDyDnZ4JmACJmACqRPoPH4nAJ1z8bsmYAImYAImEDUBJwBRd6+DMwETMAETSJ1AV/E7AeiKjN83ARMwARMwgYgJOAGIuHMdmgmYgAmYQOoEuo7fCUDXbPyJCZiACZiACURLwAlAtF3rwEzABEzABFIn0F38TgC6o+PPTMAETMAETCBSAk4AIu1Yh2UCJmACJpA6ge7jdwLQPR9/agImYAImYAJREnACEGW3OigTMAETMIHUCfQUvxOAngj5cxMwARMwAROIkIATgAg71SGZgAmYgAmkTqDn+J0A9MzIe5iACZiACZhAdAScAETXpQ7IBEzABEwgdQLNxO8EoBlK3scETMAETMAEIiPgBCCyDnU4JmACJmACqRNoLn4nAM1x8l4mYAImYAImEBUBJwBRdaeDMQETMAETSJ1As/E7AWiWlPczARMwARMwgYgIOAGIqDMdigmYgAmYQOoEmo/fCUDzrLynCZiACZiACURDwAlANF3pQEzABEzABFIn0Er8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';
  const K_SEEN = 'robot-companion:seen-tips', K_SESSION = 'robot-companion:session', K_PENDING = 'robot-companion:pending-guide';
  const sm = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const env = (t, D, a, b) => Math.min(sm(t / a), sm((D - t) / b));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now() / 1000;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const choice = list => list[Math.floor(Math.random() * list.length)];
  /** A weighted pick from [[item, weight], ...] that skips the last few picks (kept in `recent`), so it rarely repeats. */
  const pickFresh = (table, recent, keep = 2) => {
    const pool = table.filter(([x]) => !recent.includes(x)), list = pool.length ? pool : table;
    let r = Math.random() * list.reduce((sum, [, w]) => sum + (w || 1), 0);
    const out = (list.find(([, w]) => (r -= w || 1) < 0) || list[0])[0];
    recent.push(out); while (recent.length > keep) recent.shift();
    return out;
  };
  /** A line from a list, never one of the last few said from it; '' for an empty list. */
  const pickLine = (list, recent, keep = 2) => (list && list.length ? pickFresh([].concat(list).map(l => [l, 1]), recent, Math.min(keep, list.length - 1)) : '');
  /** The owner's own invitation to click again: one among many, never on every click. */
  const POKE_CORE = 'Punch me again to ask a question.';
  /** Set once this browser has met Ixia, so later visits are welcomed back rather than introduced to it again. */
  const K_MET = 'robot-companion:met';
  /** The greeting said last, kept from visit to visit so the next one is never the same. */
  const K_LAST_GREETING = 'robot-companion:last-greeting';
  /**
   * Seconds from landing to the greeting (the bob of the landing first), and the most of the page a spot may cover for
   * Ixia to say hello from it in full view rather than from its corner (see _busyAt).
   */
  const GREET_AFTER = 1, GREET_COVER = 4;
  /** How long the 3D waits for the page's own pictures to load before it is set up regardless (milliseconds). */
  const LOAD_WAIT_MS = 1500;
  /** Seconds from the opening intro's lift (the dark opens on the page) to Ixia's entrance. */
  const LIFT_WAIT = 0.7;
  /**
   * For this many seconds after arriving, nothing takes Ixia out of sight or across the window (a dive, a visit, a
   * crossing, a pop from the corner): it has only just come in.
   */
  const SETTLE_IN = 20;
  const FAR = new Set(['cross', 'visit', 'peekaboo']);
  /** The chat fades away after this long with nothing done in it. */
  const CHAT_IDLE_MS = 7000;
  /**
   * A spot this busy or more is not one to rest on: one of the twenty sampled points on a control, or two on text or a
   * picture.
   */
  const MOVE_AT = 2;
  /**
   * Tucked into the corner, Ixia stays there while the page is being read: it comes out only once it has been there
   * this long and the page has been still for READ_PAUSE, so it does not hop about between scrolls.
   */
  const PEEK_HOLD = 6;
  const READ_PAUSE = 3;
  /**
   * Least seconds between two moves from one side of the window to the other to find a clear spot (a resize or a new
   * page aside), so it never ping-pongs across the window as the page scrolls.
   */
  const CROSS_GAP = 20;
  /** Places along the bottom of the window between its two corners, tried when nowhere up either side is clear. */
  const SLOT_STEP = 60, SLOTS_MAX = 16;
  /** Below this height the chat opens beside Ixia rather than above it. */
  const SHORT_WINDOW = 600;
  /** Moments from the page kept while Ixia is on its way (or sent away) are played if no older than this (ms). */
  const MOMENT_FRESH_MS = 20000;
  /**
   * The corner button's size and its distance from the window's edges (match .dock), and how far it may be lifted, in
   * steps, to sit clear of something it would cover.
   */
  const DOCK = 50, DOCK_M = 20, DOCK_STEP = 28, DOCK_LIFTS = 5;
  /** How long an element Ixia shows stays marked before the ring fades away, and the ring's distance from it. */
  const HIGHLIGHT_MS = 3200;
  const RING_PAD = 6;
  /** How long the page must be still after a scroll before Ixia checks what it covers. */
  const SCROLL_SETTLE_MS = 700;
  /** Elements Ixia keeps clear of although the pointer passes through them, such as the hub animation's brand. */
  const AVOID = '[data-robot-avoid]';
  /** What Ixia must not rest on: anything that can be clicked or typed in, pictures, and text. */
  const INTERACTIVE = 'a[href], button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="switch"], [role="combobox"], [role="option"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
  const MEDIA = 'img, video, iframe, canvas, picture';
  const TEXTY = 'p, h1, h2, h3, h4, h5, h6, li, dt, dd, td, th, blockquote, figcaption, small, strong, em, span, code, pre';
  /** Ease in and out with no jolt at either end, for turns, so a spin never blurs past in a frame or two. */
  const smoother = s => (s <= 0 ? 0 : s >= 1 ? 1 : s * s * s * (s * (s * 6 - 15) + 10));
  const samePath = href => { try { return new URL(href, location.href).pathname === location.pathname; } catch (e) { return false; } };
  const matchPath = (pat, path) => !pat || pat === '*' || pat === path || (pat.endsWith('*') && path.startsWith(pat.slice(0, -1)));
  // Targets resolve to a visible element: a responsive page often renders one control per breakpoint.
  const shown = el => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || el.closest('[inert], [aria-hidden="true"]')) return false;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return false;
    return getComputedStyle(el).visibility !== 'hidden';
  };
  /**
   * Whether an entry (a tip, a question, a link or one of its variants) suits the page as it is now: `when` must find
   * something on it and `unless` nothing.
   */
  const meets = x => !!x && (!x.when || !!pick(x.when)) && (!x.unless || !pick(x.unless));
  const splitList = sel => {
    const parts = []; let depth = 0, quote = '', cur = '';
    for (const ch of String(sel)) {
      if (quote) { if (ch === quote) quote = ''; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if (ch === ',' && !depth) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    return parts.concat(cur).map(x => x.trim()).filter(Boolean);
  };
  const pick = sel => {
    for (const part of splitList(sel)) {
      let all; try { all = document.querySelectorAll(part); } catch (e) { continue; }
      for (const el of all) if (shown(el)) return el;
    }
    return null;
  };
  // A tall element (a whole section) is aimed at by its top band, where its heading is.
  const focusRect = el => { const r = el.getBoundingClientRect(), vh = innerHeight; if (r.height <= vh * 0.45) return r; const h = Math.max(120, vh * 0.28); return { left: r.left, right: r.right, width: r.width, top: r.top, bottom: r.top + h, height: h }; };
  const inView = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  // A menu of the site's bar standing open (its button says so): the bar sits above Ixia, so the menu covers it.
  const MENU_OPEN = 'header [aria-expanded="true"]';
  const STOP = new Set('the and for are was can you our your how what where when which who does this that with find get about have has from into page website site please'.split(' '));
  // The words of a text, lower case; signing up, in and out as one word each ("log in" is signing in, "create an
  // account" signing up), so that "up" and "in" (too short to keep) still tell them apart.
  const tokens = s => String(s || '').toLowerCase()
    .replace(/\b(?:log|sign)[\s-]?(?:in|on)\b/g, 'signin').replace(/\b(?:log|sign)[\s-]?out\b/g, 'signout')
    .replace(/\b(?:sign[\s-]?up|creat(?:e|ing)\s+(?:an?\s+|my\s+)?account)\b/g, 'signup')
    .match(/[\p{L}\p{N}]+/gu) || [];
  const words = s => tokens(s).filter(w => w.length > 2 && !STOP.has(w)).map(w => w.slice(0, 6));

  // ---------- matching a typed question ----------
  // Words that say nothing about the subject of a typed question (greetings, politeness, "want", "help"): left out of
  // it, so they neither match a question nor count against one.
  const FILLER = new Set('hello hey thanks thank could would should want know tell like just also really kindly help some any'.split(' ').map(w => w.slice(0, 6)));
  /** The words of a typed question that carry its subject, each once. */
  const askWords = s => [...new Set(words(s).filter(w => !FILLER.has(w)))];
  /** Every word of a text, the common ones too, cut as `words` cuts them. */
  const allWords = s => tokens(s).filter(w => w.length > 2).map(w => w.slice(0, 6));
  /** Its plainer words, for a question made only of common ones ("What is this site about?"). */
  const plainWords = s => [...new Set(allWords(s).filter(w => !FILLER.has(w)))];
  /** A question about where something is, which a page or a part of one can answer ("Where is the search box?"). */
  const WHERE = /\b(where|locate|show me|which page)\b/i;
  /** Text as compared whole: lower case, words only. */
  const flat = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  /** Single-letter slips between two short words (a letter wrong, missing, extra, or two swapped), counted up to 2. */
  const slips = (a, b) => {
    if (Math.abs(a.length - b.length) > 1) return 2;
    let before = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) {
        let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (before && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, before[j - 2] + 1);
        row.push(d);
      }
      before = prev; prev = row;
    }
    return prev[b.length];
  };
  /**
   * How surely two words (as `words` cuts them) are one: 1 the same, 0.85 one the start of the other in words of five
   * letters or more ("enrol", "enrolment"; not "logo" and "logout"), 0.75 one slip apart in such words ("certficate"),
   * else 0.
   */
  const near = (a, b) => {
    if (a === b) return 1;
    const [s, l] = a.length <= b.length ? [a, b] : [b, a];
    if (s.length >= 5 && l.startsWith(s)) return 0.85;
    return s.length >= 5 && slips(a, b) <= 1 ? 0.75 : 0;
  };
  /** The best `near` of a word to any word of a set. */
  const nearest = (w, set) => { let m = 0; for (const v of set) { const x = near(w, v); if (x > m) { m = x; if (m === 1) break; } } return m; };
  // A typed word no question uses weighs in the middle: it lowers the match (the question asked is about something
  // else too) without swamping it.
  const UNKNOWN_WEIGHT = 2;
  // The share of a typed question's weight one premade question must answer before Ixia gives that answer outright.
  const SURE = 0.72;

  // Pose offsets per gesture at local time t (s) over duration D.
  const GESTURES = {
    wave: { dur: 2.4, fn: (t, o, D) => {
      const e = env(t, D, 0.45, 0.5), w = Math.sin(Math.max(0, t - 0.4) * 13) * sm((t - 0.35) / 0.25);
      return { [o.s + 'z']: (1.85 + 0.28 * w) * e, [o.s + 'x']: 0.4 * e, hz: -o.dir * 0.12 * e, hy: o.dir * 0.1 * e };
    } },
    nod: { dur: 1.3, fn: (t, o, D) => {
      const e = env(t, D, 0.12, 0.3);
      return { hx: 0.08 * (1 - Math.cos(t * Math.PI * 3.2)) * e, lift: -3 * e };
    } },
    point: { dur: 2.8, fn: (t, o, D) => {
      const e = env(t, D, 0.4, 0.6), k = Math.max(0, t - 0.45), jab = 0.09 * Math.sin(k * 10) * Math.exp(-k * 3.5);
      return { [o.s + 'z']: (o.angle + jab) * e, [o.s + 'x']: 0.12 * e, hy: o.dir * 0.38 * e, hx: o.pitch * e, ex: o.dir * 7 * e, ey: o.up * 4 * e };
    } },
    think: { dur: 3.2, fn: (t, o, D) => {
      const e = env(t, D, 0.55, 0.6);
      return { lx: (-1.9 + 0.06 * Math.sin(t * 7)) * e, lz: -0.35 * e, hz: 0.14 * e, hx: -0.12 * e, hy: 0.1 * e, ex: 6 * e, ey: 5 * e };
    } },
    roll: { dur: 1.9, fn: (t, o, D) => ({ spin: Math.PI * 2 * smoother(clamp(t / D, 0, 1)), lift: 28 * Math.sin(Math.PI * clamp(t / D, 0, 1)) ** 2 }) },
    celebrate: { dur: 2.3, fn: (t, o, D) => {
      const e = env(t, D, 0.35, 0.5), w = 0.14 * Math.sin(t * 17);
      return { lz: (1.95 + w) * e, rz: (1.95 - w) * e, lx: 0.2 * e, rx: 0.2 * e, lift: 16 * (1 - Math.cos(t * Math.PI * 4)) / 2 * e, hx: -0.1 * e };
    } },
    // A little jump: crouch, spring up with the arms out, and land with a squash.
    hop: { dur: 0.95, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), up = Math.sin(Math.PI * clamp((s - 0.15) / 0.7, 0, 1));
      const crouch = s < 0.15 ? Math.sin(Math.PI * s / 0.15) : s > 0.85 ? Math.sin(Math.PI * (s - 0.85) / 0.15) : 0;
      return { lift: 38 * up - 4 * crouch, squash: 0.09 * crouch - 0.05 * up, lz: 0.55 * up, rz: 0.55 * up };
    } },
    // Side to side with the arms up, bobbing on the beat.
    dance: { dur: 2.8, fn: (t, o, D) => {
      const e = env(t, D, 0.3, 0.45), w = Math.sin(t * 8.4);
      return { lean: 0.13 * w * e, hz: -0.12 * w * e, spin: 0.28 * w * e, lz: (1.35 + 0.45 * Math.sin(t * 8.4 + 1)) * e,
        rz: (1.35 - 0.45 * Math.sin(t * 8.4 + 1)) * e, lift: 9 * (1 - Math.cos(t * 16.8)) / 2 * e, squash: 0.03 * Math.cos(t * 16.8) * e };
    } },
    // Dizzy: the head wobbles and the body sways.
    shake: { dur: 1.8, fn: (t, o, D) => {
      const e = env(t, D, 0.15, 0.6);
      return { hz: 0.22 * Math.sin(t * 15) * e, hy: 0.28 * Math.sin(t * 6.5) * e, lean: 0.09 * Math.sin(t * 9) * e };
    } },
    // A look round: left, then right, then back.
    look: { dur: 2.8, fn: (t, o, D) => {
      const e = env(t, D, 0.35, 0.45), s = clamp(t / D, 0, 1), turn = Math.sin(s * Math.PI * 2);
      return { hy: 0.55 * turn * e, ex: 11 * turn * e, hx: -0.04 * e };
    } },
    // Arms up slowly, a stretch on tiptoe, and down again.
    stretch: { dur: 3, fn: (t, o, D) => {
      const e = env(t, D, 0.9, 0.9);
      return { lz: 2.3 * e, rz: 2.3 * e, lx: -0.2 * e, rx: -0.2 * e, lift: 7 * e, hx: -0.16 * e, squash: -0.04 * e };
    } },
    // One quick turn on the spot.
    spin: { dur: 1.5, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), a = Math.sin(Math.PI * s) ** 2;
      return { spin: Math.PI * 2 * smoother(s), lift: 16 * a, lz: 0.5 * a, rz: 0.5 * a };
    } },
    // A quick side-to-side wiggle, as if shaking off a tickle.
    wiggle: { dur: 1.1, fn: (t, o, D) => {
      const e = env(t, D, 0.12, 0.3), w = Math.sin(t * 22);
      return { lean: 0.12 * w * e, spin: 0.14 * w * e, squash: 0.04 * Math.abs(w) * e, hz: -0.1 * w * e };
    } },
    // Three little bounces on the spot, each a touch lower.
    bounce: { dur: 1.35, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), k = (s * 3) % 1, up = Math.sin(Math.PI * k) * (1 - s * 0.35);
      return { lift: 24 * up, squash: 0.08 * Math.max(0, 1 - k * 5) - 0.04 * up, lz: 0.35 * up, rz: 0.35 * up };
    } },
    // A second dance: a twist with the arms pumping in turn.
    boogie: { dur: 3, fn: (t, o, D) => {
      const e = env(t, D, 0.3, 0.5), w = Math.sin(t * 9.5), u = Math.sin(t * 19), up = (x) => 0.5 * (x + Math.sqrt(x * x + 0.04));
      return { spin: 0.4 * w * e, lean: -0.08 * w * e, lz: (1.1 + 0.9 * up(w)) * e, rz: (1.1 + 0.9 * up(-w)) * e,
        lx: 0.3 * e, rx: 0.3 * e, lift: 7 * (1 - Math.cos(t * 38)) / 2 * e, hz: 0.1 * w * e, squash: 0.03 * u * e };
    } },
    // Bashful: arms tucked in front, head down, swaying a little.
    shy: { dur: 1.9, fn: (t, o, D) => {
      const e = env(t, D, 0.4, 0.6);
      return { lx: 0.9 * e, rx: 0.9 * e, lz: -0.15 * e, rz: -0.15 * e, hx: 0.16 * e, hz: 0.12 * Math.sin(t * 3) * e, lean: 0.05 * e, squash: 0.03 * e };
    } },
    // Proud: both arms up and bent, with a little lift.
    flex: { dur: 1.8, fn: (t, o, D) => {
      const e = env(t, D, 0.3, 0.5), pump = 0.12 * Math.sin(t * 12);
      return { lz: (1.6 + pump) * e, rz: (1.6 - pump) * e, lx: -0.9 * e, rx: -0.9 * e, lift: 8 * e, hx: -0.1 * e, squash: -0.03 * e };
    } },
    // Two quick turns with the arms out.
    twirl: { dur: 2, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), a = Math.sin(Math.PI * s) ** 2;
      return { spin: Math.PI * 4 * smoother(s), lift: 20 * a, lz: 1.2 * a, rz: 1.2 * a, hx: -0.08 * a };
    } },
    // One neat turn with the arms tucked in close.
    pirouette: { dur: 1.3, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), a = Math.sin(Math.PI * s) ** 2;
      return { spin: Math.PI * 2 * smoother(s), lift: 12 * a, lz: -0.14 * a, rz: -0.14 * a, lx: 0.6 * a, rx: 0.6 * a, hx: -0.04 * a, squash: -0.03 * a };
    } },
    // A skater's spin: three turns, quick with the arms in, slowing as they open out wide.
    whirl: { dur: 2.7, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), a = Math.sin(Math.PI * s) ** 2, open = smoother(clamp((s - 0.3) / 0.55, 0, 1));
      const arms = (-0.14 + 1.6 * open) * a;
      return { spin: Math.PI * 6 * smoother(Math.pow(s, 0.72)), lift: 18 * a, lz: arms, rz: arms, lx: 0.55 * (1 - open) * a, rx: 0.55 * (1 - open) * a, hx: -0.06 * a };
    } },
    // A spiral: two turns while it floats up and settles back, the arms out like wings.
    corkscrew: { dur: 2.3, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), a = Math.sin(Math.PI * s) ** 2, up = Math.sin(Math.PI * s);
      return { spin: Math.PI * 4 * smoother(s), lift: 46 * up * up, lz: 1 * a, rz: 1 * a, lean: 0.1 * Math.sin(Math.PI * 2 * s) * a, hx: -0.1 * a };
    } },
    // A slow sway with the arms up, side to side.
    sway: { dur: 3.4, fn: (t, o, D) => {
      const e = env(t, D, 0.5, 0.6), w = Math.sin(t * 3.4);
      return { lean: 0.15 * w * e, spin: 0.2 * w * e, hz: -0.1 * w * e, lz: (2 + 0.25 * w) * e, rz: (2 - 0.25 * w) * e, lift: 6 * (1 - Math.cos(t * 6.8)) / 2 * e };
    } },
    // The robot: stiff arm moves on the beat and a head that ticks from side to side.
    robot: { dur: 3.2, fn: (t, o, D) => {
      const e = env(t, D, 0.25, 0.4), beat = Math.floor(t * 3.2), k = beat % 4;
      const L = [[1.6, 0], [0.2, 1.3], [1.6, -0.6], [0.2, 0]][k], R = [[0.2, 0], [1.6, 0], [0.2, 1.3], [1.6, -0.6]][k];
      return { lz: L[0] * e, lx: L[1] * e, rz: R[0] * e, rx: R[1] * e, hy: (k % 2 ? 0.28 : -0.28) * e, lift: (k % 2 ? 4 : 0) * e, squash: (k % 2 ? 0 : 0.025) * e };
    } },
    // Startled: a sharp little jump with the head thrown back, and a squash on landing.
    jolt: { dur: 0.75, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), up = s < 0.6 ? Math.sin(Math.PI * s / 0.6) : 0, land = s >= 0.6 ? Math.sin(Math.PI * (s - 0.6) / 0.4) : 0;
      return { lift: 30 * up, hx: -0.22 * up, lz: 1.1 * up, rz: 1.1 * up, squash: 0.09 * land - 0.06 * up };
    } },
    // A shrug: arms out, shoulders up, head tilted.
    shrug: { dur: 1.6, fn: (t, o, D) => {
      const e = env(t, D, 0.3, 0.5);
      return { lz: 0.75 * e, rz: 0.75 * e, lx: -0.4 * e, rx: -0.4 * e, hz: 0.18 * e, lift: 5 * e };
    } },
    // Ducks down, then pops up with the arms raised.
    peek: { dur: 1.3, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), down = s < 0.45 ? Math.sin(Math.PI * s / 0.45) : 0, up = s >= 0.45 ? Math.sin(Math.PI * (s - 0.45) / 0.55) : 0;
      return { squash: 0.14 * down - 0.05 * up, lift: -6 * down + 26 * up, lz: 1.5 * up, rz: 1.5 * up, hx: 0.12 * down - 0.1 * up };
    } },
    // Touching down after a flight.
    land: { dur: 0.55, fn: (t, o, D) => ({ squash: 0.11 * Math.sin(Math.PI * clamp(t / D, 0, 1)), lift: -5 * Math.sin(Math.PI * clamp(t / D, 0, 1)) }) },
    // A somersault: a crouch, up and over forwards with the arms tucked, and a squash on landing.
    flip: { dur: 1.35, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), turn = smoother(clamp((s - 0.16) / 0.66, 0, 1)), air = Math.sin(Math.PI * clamp((s - 0.12) / 0.76, 0, 1));
      const crouch = s < 0.16 ? Math.sin(Math.PI * s / 0.16) : s > 0.86 ? Math.sin(Math.PI * (s - 0.86) / 0.14) : 0;
      return { flip: -Math.PI * 2 * turn, lift: 44 * air - 5 * crouch, squash: 0.1 * crouch, lx: 0.8 * air, rx: 0.8 * air, lz: -0.1 * air, rz: -0.1 * air };
    } },
    // A cartwheel to one side and back to where it began, the arms up and out.
    wheel: { dur: 1.7, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), turn = smoother(clamp((s - 0.1) / 0.8, 0, 1)), air = Math.sin(Math.PI * s);
      return { wheel: o.dir * Math.PI * 2 * turn, sx: o.dir * 46 * Math.sin(Math.PI * 2 * s) * 0.5, lift: 34 * air, lz: 2.2 * air, rz: 2.2 * air, hx: -0.08 * air };
    } },
    // A yawn: a long stretch, the head back and the mouth wide open.
    yawn: { dur: 2.7, fn: (t, o, D) => {
      const e = env(t, D, 0.8, 0.9);
      return { lz: 1.7 * e, rz: 1.7 * e, lx: -0.25 * e, rx: -0.25 * e, hx: -0.26 * e, mouth: 0.75 * e, lift: 5 * e, squash: -0.03 * e };
    } },
    // Puzzled: one hand up to the head, scratching, the head tilted.
    scratch: { dur: 2.3, fn: (t, o, D) => {
      const e = env(t, D, 0.4, 0.5), k = o.s;
      return { [k + 'z']: 2.45 * e, [k + 'x']: (-1.15 + 0.12 * Math.sin(t * 16)) * e, hz: -o.dir * 0.2 * e, hy: o.dir * 0.12 * e };
    } },
    // A sigh: the shoulders drop, the head bows and it sinks a little.
    sigh: { dur: 2.2, fn: (t, o, D) => {
      const e = env(t, D, 0.6, 0.8);
      return { lift: -9 * e, hx: 0.24 * e, lz: -0.12 * e, rz: -0.12 * e, lx: 0.2 * e, rx: 0.2 * e, squash: 0.05 * e };
    } },
    // Applause: the hands meet in front, quick and light.
    clap: { dur: 1.9, fn: (t, o, D) => {
      const e = env(t, D, 0.25, 0.4), c = Math.abs(Math.sin(t * 13));
      return { lx: 1.3 * e, rx: 1.3 * e, lz: (0.18 + 0.32 * c) * e, rz: (0.18 + 0.32 * c) * e, hx: -0.06 * e, lift: 4 * c * e };
    } },
    // Juggling: the arms toss in turn, the eyes up on what flies.
    juggle: { dur: 3.3, fn: (t, o, D) => {
      const e = env(t, D, 0.3, 0.5), w = Math.sin(t * 9.5);
      return { lz: (0.95 + 0.6 * w) * e, rz: (0.95 - 0.6 * w) * e, lx: 0.55 * e, rx: 0.55 * e, hx: -0.2 * e, ey: 6 * e, lift: 3 * Math.abs(w) * e };
    } },
    // Peering at something: a lean forward, the head out and tilted.
    peer: { dur: 2.5, fn: (t, o, D) => {
      const e = env(t, D, 0.5, 0.6);
      return { hx: 0.16 * e, hz: o.dir * 0.16 * e, hy: o.dir * 0.3 * e, lean: o.dir * 0.07 * e, ex: o.dir * 10 * e, lift: -3 * e };
    } },
    // A cheer: two jumps with the arms punching the air.
    cheer: { dur: 1.9, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), k = (s * 2) % 1, up = Math.sin(Math.PI * k);
      return { lift: 26 * up, lz: (1.4 + 0.9 * up), rz: (1.4 + 0.9 * up), lx: -0.3, rx: -0.3, squash: 0.08 * Math.max(0, 1 - k * 6) - 0.05 * up, hx: -0.12 * up };
    } },
    // Charged up after a nap: a deep crouch, then off like a rocket with two turns and the arms out.
    boost: { dur: 2, fn: (t, o, D) => {
      const s = clamp(t / D, 0, 1), crouch = s < 0.28 ? Math.sin(Math.PI * s / 0.28) : 0, air = Math.sin(Math.PI * clamp((s - 0.24) / 0.76, 0, 1));
      return { squash: 0.15 * crouch - 0.06 * air, lift: -6 * crouch + 50 * air, spin: Math.PI * 4 * smoother(clamp((s - 0.24) / 0.7, 0, 1)), lz: 1.3 * air, rz: 1.3 * air, hx: -0.12 * air };
    } },
  };

  // Faces: which eye and mouth shapes show, and how they are scaled.
  const FACES = {
    neutral: { eyes: 'dome', mouth: 'smile' },
    happy: { eyes: 'arc', mouth: 'smile', ms: [1.2, 1.3] },
    laugh: { eyes: 'arc', mouth: 'smile', ms: [1.45, 1.75] },
    love: { eyes: 'heart', mouth: 'smile', ms: [1.05, 1.15] },
    star: { eyes: 'star', mouth: 'smile', ms: [1.35, 1.5] },
    surprised: { eyes: 'dome', es: [1.18, 1.22], mouth: 'o' },
    dizzy: { eyes: 'x', mouth: 'o', ms: [0.75, 0.8] },
    sleepy: { eyes: 'dome', es: [1.05, 0.12], mouth: 'flat', ms: [0.7, 1] },
    wink: { eyes: 'dome', right: 'arc', mouth: 'smile', ms: [1.15, 1.2] },
    think: { eyes: 'dome', es: [0.95, 0.78], mouth: 'flat', ms: [0.8, 1] },
    sad: { eyes: 'dome', es: [1, 0.72], tilt: 0.22, mouth: 'smile', ms: [0.75, 0.6], flip: true },
    // One eye narrowed and the mouth set askew.
    confused: { eyes: 'dome', es: [1.05, 0.95], esR: [0.82, 0.55], mouth: 'flat', ms: [0.85, 1], mt: 0.24 },
    // Eyes wide, one a little wider, and a small o.
    curious: { eyes: 'dome', es: [1.14, 1.18], esR: [1, 0.96], mouth: 'o', ms: [0.62, 0.62] },
    tired: { eyes: 'dome', es: [1.05, 0.42], mouth: 'flat', ms: [0.9, 1] },
    yawn: { eyes: 'dome', es: [1.05, 0.22], mouth: 'o', ms: [1.25, 1.5] },
    excited: { eyes: 'star', mouth: 'smile', ms: [1.55, 1.85] },
    proud: { eyes: 'arc', mouth: 'smile', ms: [1.3, 1.15], tilt: -0.08 },
  };

  // Emotes float up from the head: small drawings in the site's aqua, its blue and a warm accent.
  const EMOTES = {
    heart: { n: 3, svg: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.8 1.3 5.4 3.2 1.6-1.9 3.2-3.2 5.4-3.2 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21Z" fill="#ff5a87"/></svg>' },
    sparkle: { n: 4, svg: '<svg viewBox="0 0 24 24"><path d="M12 1.5 14.2 9.8 22.5 12l-8.3 2.2L12 22.5l-2.2-8.3L1.5 12l8.3-2.2Z" fill="#5ff3ff"/></svg>' },
    star: { n: 3, svg: '<svg viewBox="0 0 24 24"><path d="m12 2 2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17l-6 3.3 1.3-6.7-5-4.6 6.8-.8Z" fill="#ffcf4a"/></svg>' },
    note: { n: 3, svg: '<svg viewBox="0 0 24 24"><path d="M9 18.5a3 3 0 1 1-2-2.8V4.5l12-2.5v13a3 3 0 1 1-2-2.8V6.6l-8 1.7Z" fill="#7d78ff"/></svg>' },
    zzz: { n: 2, svg: '<svg viewBox="0 0 24 24"><path d="M5 6h10L5 18h10" fill="none" stroke="#5ff3ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
    bulb: { n: 1, svg: '<svg viewBox="0 0 24 24"><path d="M12 2.5a7 7 0 0 0-4.2 12.6c.7.6 1.2 1.4 1.2 2.4h6c0-1 .5-1.8 1.2-2.4A7 7 0 0 0 12 2.5Z" fill="#ffcf4a"/><path d="M9.5 20h5M10.5 22.5h3" stroke="#7d78ff" stroke-width="2" stroke-linecap="round"/></svg>' },
    question: { n: 1, svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="#2a25c4"/><path d="M9.2 9.3a2.9 2.9 0 1 1 4.3 2.5c-.9.5-1.5 1.1-1.5 2.2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.3" fill="#fff"/></svg>' },
    exclaim: { n: 1, svg: '<svg viewBox="0 0 24 24"><rect x="9.6" y="2.5" width="4.8" height="13" rx="2.4" fill="#ffcf4a"/><circle cx="12" cy="19.6" r="2.6" fill="#ffcf4a"/></svg>' },
    rocket: { n: 1, svg: '<svg viewBox="0 0 24 24"><path d="M14.6 3.2c3-1 5.4-.9 6.2-.1.8.8.9 3.2-.1 6.2-1 3-3.4 6-6.3 7.8l-.7 3.4-3-2.1-4-4-2.1-3 3.4-.7c1.8-2.9 4.8-5.3 7.8-6.3Z" fill="#5ff3ff"/><circle cx="15.6" cy="8.4" r="1.9" fill="#2a25c4"/><path d="M6.6 14.8c-1.6.5-2.9 2.3-3.3 5.4 3.1-.4 4.9-1.7 5.4-3.3" fill="#ff5a87"/></svg>' },
    trophy: { n: 1, svg: '<svg viewBox="0 0 24 24"><path d="M7 3h10v4.5a5 5 0 0 1-10 0Z" fill="#ffcf4a"/><path d="M7 4.5H4a3 3 0 0 0 3 4.6M17 4.5h3a3 3 0 0 1-3 4.6" fill="none" stroke="#ffcf4a" stroke-width="1.8"/><path d="M10.6 12.2h2.8l.5 4.3h-3.8Z" fill="#ffcf4a"/><rect x="7.5" y="16.5" width="9" height="3.5" rx="1" fill="#7d78ff"/></svg>' },
    swirl: { n: 2, svg: '<svg viewBox="0 0 24 24"><path d="M12 12.2a1.6 1.6 0 1 1 1.7-1.6 3.6 3.6 0 1 1-3.7-3.5 5.6 5.6 0 1 1-5.6 5.6" fill="none" stroke="#7d78ff" stroke-width="2.2" stroke-linecap="round"/></svg>' },
    confetti: { n: 10, burst: true, svg: '' },
  };
  const CONFETTI = ['#5ff3ff', '#2a25c4', '#ff5a87', '#ffcf4a', '#a5ecf3'];
  /** The height of the body's middle, about which a somersault or a cartwheel turns. */
  const BODY_MID = 290;

  // Geometry measured from the reference (mm), split into animatable pivots.
  function buildRobot(THREE) {
    const X = px => px - 369.5, Y = py => 601 - py, NECK = 300;
    // The brand's colours: a pearl shell with a clear coat, Telecom Blue trim, an indigo glass visor and an aqua face.
    const shell = new THREE.MeshPhysicalMaterial({ name: 'shell_pearl', color: 0xf1f3f8, roughness: 0.3, metalness: 0.03, clearcoat: 0.6, clearcoatRoughness: 0.26 });
    const trim = new THREE.MeshPhysicalMaterial({ name: 'trim_telecom_blue', color: 0x1a168c, roughness: 0.34, metalness: 0.18, clearcoat: 0.5, clearcoatRoughness: 0.3 });
    const visor = new THREE.MeshPhysicalMaterial({ name: 'visor_glass', color: 0x0b0a2c, emissive: 0x100c5c, emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
    const glow = new THREE.MeshStandardMaterial({ name: 'face_aqua', color: 0xa5ecf3, emissive: 0x34cfe0, emissiveIntensity: 1.4, roughness: 0.4 });
    const node = (parent, name, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };
    const add = (parent, name, geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat); m.name = name; m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = mat === shell || mat === trim; parent.add(m); return m;
    };
    const lerpTable = (tbl, v) => { for (let i = 1; i < tbl.length; i++) if (v <= tbl[i][0]) { const [a, ra] = tbl[i - 1], [b, rb] = tbl[i]; return ra + ((rb - ra) * (v - a)) / (b - a); } return tbl[tbl.length - 1][1]; };
    const root = new THREE.Group(); root.name = 'robot';
    // `marks`: points on the body (the hand tips, the top of the head, the front of the belly) whose speed on the screen
    // sets how often it is drawn.
    const rig = { root, marks: [] };

    const bodyPx = [[316,0],[319,30],[322,52],[328,74],[334,88.5],[340,99.5],[346,108.5],[352,115.5],[358,121],[364,126],[370,130],[376,133],[382,136],[388,137.5],[394,138.75],[403,139.5],[412,139.5],[424,138.5],[436,137],[448,135.5],[460,134.5],[466,133.75],[478,130.5],[490,128.5],[502,124.5],[514,119.5],[526,113.5],[538,107],[550,99.5],[562,89.5],[574,76.5],[586,60.5],[592,48.5],[598,32],[600,18],[601,0]];
    const remap = py => (py < 400 ? py + (400 - py) * (400 - py) * 0.0031 : py);
    const raw = []; for (let py = 316; py <= 601; py += 2) raw.push([py, lerpTable(bodyPx, py)]);
    const smooth = raw.map(([py, r], i) => {
      if (i < 2 || i > raw.length - 3) return [py, r];
      let s = 0, w = 0;
      for (let k = -12; k <= 12; k++) { const wk = Math.exp((-k * k) / 40); s += raw[clamp(i + k, 0, raw.length - 1)][1] * wk; w += wk; }
      return [py, s / w];
    });
    const pts = smooth.reverse().map(([py, r]) => new THREE.Vector2(r, Y(remap(py))));
    pts[0].x = 0; pts[pts.length - 1].x = 0;
    add(root, 'body', new THREE.LatheGeometry(pts, 64), shell);
    rig.bodyR = y => { for (let i = 1; i < pts.length; i++) if (y <= pts[i].y) { const a = pts[i - 1], b = pts[i]; return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y || 1); } return 0; };
    add(root, 'neck', new THREE.CylinderGeometry(56, 58, 80, 48), trim, 0, Y(328), 0);

    const head = (rig.head = node(root, 'head_pivot', 0, NECK, 0));
    const HB = 40, HD = 120;
    const sq = (a, b, n, seg = 120) => {
      const s = new THREE.Shape();
      for (let i = 0; i <= seg; i++) {
        const t = (i / seg) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
        const x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), y = b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
        if (i) s.lineTo(x, y); else s.moveTo(x, y);
      }
      return s;
    };
    const headGeo = new THREE.ExtrudeGeometry(sq(164.5 - HB, 113.5 - HB, 4), { depth: HD, bevelEnabled: true, bevelThickness: HB, bevelSize: HB, bevelSegments: 10 });
    headGeo.translate(0, 0, -HD / 2);
    add(head, 'head', headGeo, shell, 0, Y(204.5) - NECK, 0);
    const front = HD / 2 + HB, faceZ = front + 6.3;

    const vTbl = [[0,0],[1.5,38],[5.5,73.5],[9.5,93.5],[13.5,107],[17.5,118],[21.5,126.3],[25.5,132.5],[29.5,136.5],[33.5,139.5],[37.5,142.5],[41.5,144.2],[45.5,145.5],[49.5,146.5]];
    const VH = 179.5, VB = 3, vs = new THREE.Shape(), half = [];
    for (let i = 0; i <= 72; i++) { const d = (VH * i) / 72; half.push([Math.max(0, lerpTable(vTbl, Math.min(d, VH - d)) - VB), ((VH / 2 - d) * (VH / 2 - VB)) / (VH / 2)]); }
    half.forEach(([x, y], i) => { if (i) vs.lineTo(x, y); else vs.moveTo(x, y); });
    for (let i = half.length - 2; i > 0; i--) vs.lineTo(-half[i][0], half[i][1]);
    const visorGeo = new THREE.ExtrudeGeometry(vs, { depth: 8, bevelEnabled: true, bevelThickness: 6, bevelSize: VB, bevelSegments: 5 });
    visorGeo.translate(0, 0, -8);
    add(head, 'visor', visorGeo, visor, 0, Y(216.25) - NECK, front);

    const eyeShape = () => {
      const s = new THREE.Shape(), r = 21.5;
      s.moveTo(r, 0); s.absarc(0, 0, r, 0, Math.PI, false); s.lineTo(-r, -5.5);
      s.quadraticCurveTo(-r, -8.2, -18.5, -8.3); s.quadraticCurveTo(0, -6.4, 18.5, -8.3); s.quadraticCurveTo(r, -8.2, r, -5.5); s.lineTo(r, 0);
      return s;
    };
    const flat = { depth: 1.6, bevelEnabled: false, curveSegments: 32 }, EYE_C = 6.6;
    [['L', 299.5, 'eye_left'], ['R', 439.5, 'eye_right']].forEach(([k, px, name]) => {
      const g = (rig['eye' + k] = node(head, name + '_pivot', X(px), Y(216.5) + EYE_C - NECK, faceZ));
      const geo = new THREE.ExtrudeGeometry(eyeShape(), flat); geo.translate(0, -EYE_C, 0);
      rig['eyeDome' + k] = add(g, name, geo, glow);
    });
    rig.eyeBase = { l: X(299.5), r: X(439.5), y: Y(216.5) + EYE_C - NECK };

    const ms = new THREE.Shape();
    ms.moveTo(-15, 4.5); ms.lineTo(15, 4.5); ms.quadraticCurveTo(18, 4.5, 18, 1.5); ms.lineTo(18, 0);
    ms.absellipse(0, 0, 18, 16.5, 0, Math.PI, true); ms.lineTo(-18, 1.5); ms.quadraticCurveTo(-18, 4.5, -15, 4.5);
    const mouthGeo = new THREE.ExtrudeGeometry(ms, flat); mouthGeo.translate(0, -4.5, 0);
    rig.mouth = node(head, 'mouth_pivot', 0, Y(256) + 4.5 - NECK, faceZ);
    rig.mouthSmile = add(rig.mouth, 'mouth', mouthGeo, glow);

    const earProfile = (inner, outer, R, f) => {
      const p = [new THREE.Vector2(0, inner), new THREE.Vector2(R, inner), new THREE.Vector2(R, outer - f)];
      for (let i = 1; i <= 12; i++) { const a = ((i / 12) * Math.PI) / 2; p.push(new THREE.Vector2(R - f + f * Math.cos(a), outer - f + f * Math.sin(a))); }
      p.push(new THREE.Vector2(0, outer));
      return p;
    };
    [[1, 'ear_left'], [-1, 'ear_right']].forEach(([s, name]) => {
      const geo = new THREE.LatheGeometry(earProfile(140, 195.5, 44, 20), 48); geo.rotateZ((s * Math.PI) / 2);
      add(head, name, geo, trim, 0, Y(207) - NECK, 0);
    });
    const capGeo = new THREE.CapsuleGeometry(26, 64, 8, 32); capGeo.rotateZ(Math.PI / 2); capGeo.scale(1, 1, 1.6);
    add(head, 'top_cap', capGeo, shell, 0, Y(93) - NECK, -8);
    rig.marks.push([head, new THREE.Vector3(0, Y(93) - NECK + 26, -8)], [root, new THREE.Vector3(0, Y(470), rig.bodyR(Y(470)))]);

    [[1, 'L', 'arm_left'], [-1, 'R', 'arm_right']].forEach(([side, k, name]) => {
      const T = [X(247) * side, Y(349)], Q = [X(179.5) * side, Y(463)], C = [X(182) * side, Y(517)];
      const bz = t => [(1 - t) * (1 - t) * T[0] + 2 * t * (1 - t) * Q[0] + t * t * C[0], (1 - t) * (1 - t) * T[1] + 2 * t * (1 - t) * Q[1] + t * t * C[1]];
      const bt = t => { const dx = 2 * (1 - t) * (Q[0] - T[0]) + 2 * t * (C[0] - Q[0]), dy = 2 * (1 - t) * (Q[1] - T[1]) + 2 * t * (C[1] - Q[1]), l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
      let Ls = 0;
      for (let i = 1, p = bz(0); i <= 200; i++) { const q = bz(i / 200); Ls += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
      const Rt = 27, Rb = 36, prof = [];
      for (let i = 0; i <= 14; i++) { const a = ((i / 14) * Math.PI) / 2; prof.push([Rt - Rt * Math.cos(a), Rt * Math.sin(a)]); }
      for (let i = 1; i < 30; i++) { const u = i / 30, s = u * u * (3 - 2 * u); prof.push([Rt + (Ls - Rt) * u, Rt + (Rb - Rt) * s]); }
      for (let i = 0; i <= 16; i++) { const a = ((i / 16) * Math.PI) / 2; prof.push([Ls + Rb * Math.sin(a), Rb * Math.cos(a)]); }
      prof[prof.length - 1][1] = 0;
      const geo = new THREE.LatheGeometry(prof.reverse().map(([u, r]) => new THREE.Vector2(r, -u)), 48);
      const pos = geo.attributes.position, nor = geo.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        const u = -pos.getY(i), x = pos.getX(i), z = pos.getZ(i);
        let S, tm;
        if (u <= Ls) { S = bz(u / Ls); tm = bt(u / Ls); } else { tm = bt(1); S = [C[0] + tm[0] * (u - Ls), C[1] + tm[1] * (u - Ls)]; }
        const nm = [-tm[1], tm[0]];
        pos.setXYZ(i, S[0] + x * nm[0], S[1] + x * nm[1], z);
        const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
        nor.setXYZ(i, nx * nm[0] - ny * tm[0], nx * nm[1] - ny * tm[1], nz);
      }
      const P = bz(30 / Ls);
      geo.translate(-P[0], -P[1], 0);
      const pivot = (rig['arm' + k] = node(root, name + '_pivot', P[0] + 8 * side, P[1] - 20, -14));
      add(pivot, name, geo, shell);
      const tip = bt(1);
      rig.marks.push([pivot, new THREE.Vector3(C[0] + tip[0] * Rb - P[0], C[1] + tip[1] * Rb - P[1], 0)]);
      rig.armBias = Math.atan2(Math.abs(C[0] - P[0]), P[1] - C[1]);
    });

    // Expressions: more eye and mouth shapes in the same aqua, swapped in with a blink.
    const arcShape = () => { const s = new THREE.Shape(), R = 21.5, r = 12.5; s.moveTo(R, 0); s.absarc(0, 0, R, 0, Math.PI, false); s.lineTo(-r, 0); s.absarc(0, 0, r, Math.PI, 0, true); s.lineTo(R, 0); return s; };
    const heartShape = () => { const s = new THREE.Shape(); s.moveTo(0, -17); s.bezierCurveTo(-25, -2, -24, 17, -11.5, 19); s.bezierCurveTo(-5, 20, 0, 14.5, 0, 10); s.bezierCurveTo(0, 14.5, 5, 20, 11.5, 19); s.bezierCurveTo(24, 17, 25, -2, 0, -17); return s; };
    const starShape = () => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 9.5 : 22; if (i) s.lineTo(r * Math.cos(a), r * Math.sin(a)); else s.moveTo(r * Math.cos(a), r * Math.sin(a)); } s.closePath(); return s; };
    const crossShape = () => { const s = new THREE.Shape(), L = 19, w = 4.6; [[w, L], [w, w], [L, w], [L, -w], [w, -w], [w, -L], [-w, -L], [-w, -w], [-L, -w], [-L, w], [-w, w], [-w, L]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
    const eyeShapes = { arc: [arcShape, 0, -9], heart: [heartShape, 0, -1.5], star: [starShape, 0, 0], x: [crossShape, Math.PI / 4, 0] };
    rig.faces = { L: { dome: rig.eyeDomeL }, R: { dome: rig.eyeDomeR }, mouth: { smile: rig.mouthSmile } };
    for (const k of ['L', 'R']) {
      for (const [name, [make, rot, dy]] of Object.entries(eyeShapes)) {
        const geo = new THREE.ExtrudeGeometry(make(), flat); if (rot) geo.rotateZ(rot); geo.translate(0, dy, 0);
        const m = add(rig['eye' + k], 'eye_' + k + '_' + name, geo, glow); m.visible = false; rig.faces[k][name] = m;
      }
    }
    const oShape = new THREE.Shape(); oShape.absellipse(0, -12, 10, 12, 0, Math.PI * 2, false);
    const flatMouth = new THREE.Shape(), fw = 13, fh = 3.2;
    flatMouth.moveTo(-fw + fh, fh); flatMouth.lineTo(fw - fh, fh); flatMouth.absarc(fw - fh, 0, fh, Math.PI / 2, -Math.PI / 2, true);
    flatMouth.lineTo(-fw + fh, -fh); flatMouth.absarc(-fw + fh, 0, fh, -Math.PI / 2, Math.PI / 2, true);
    for (const [name, shape, dy] of [['o', oShape, 0], ['flat', flatMouth, -5]]) {
      const geo = new THREE.ExtrudeGeometry(shape, flat); geo.translate(0, dy, 0);
      const m = add(rig.mouth, 'mouth_' + name, geo, glow); m.visible = false; rig.faces.mouth[name] = m;
    }

    let triangles = 0, meshes = 0;
    root.traverse(o => { if (o.isMesh) { meshes++; const g = o.geometry; triangles += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    rig.triangles = Math.round(triangles); rig.meshes = meshes;
    return rig;
  }

  // Logo printed on the belly: a patch that follows the body's curve.
  function addLogo(THREE, rig, img, aniso) {
    const aspect = img.naturalWidth / img.naturalHeight, W = 99, H = W / aspect, yc = 142;
    const half = W / 2 / rig.bodyR(yc), nu = 32, nv = 8, pos = [], uv = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv, a = (u - 0.5) * 2 * half, y = yc - H / 2 + v * H, r = rig.bodyR(y) + 0.6;
      pos.push(r * Math.sin(a), y, r * Math.cos(a)); uv.push(u, v);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso; tex.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ name: 'logo_ink', map: tex, color: 0x0d0a73, transparent: true, roughness: 0.42, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const m = new THREE.Mesh(geo, mat); m.name = 'belly_logo'; m.receiveShadow = true; m.renderOrder = 1;
    rig.root.add(m);
  }

  // The shadow on the ground under the floating robot: a dark core with a wide, soft fall-off, tinted with the site's
  // indigo.
  function makeShadow(THREE) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(10,8,48,0.46)'); gr.addColorStop(0.22, 'rgba(10,8,48,0.32)'); gr.addColorStop(0.5, 'rgba(10,8,48,0.12)');
    gr.addColorStop(0.78, 'rgba(10,8,48,0.03)'); gr.addColorStop(1, 'rgba(10,8,48,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(430, 300), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.name = 'ground_shadow'; m.rotation.x = -Math.PI / 2; m.position.y = 0.5; m.renderOrder = -1;
    return m;
  }

  // Theme: every colour is a custom property with a light-theme fallback, so a page restyles the robot from its own
  // tokens (and per theme) without touching this file.
  const ACC = 'var(--robot-accent, #0d0a73)', ON = 'var(--robot-on-accent, #ffffff)', AINK = 'var(--robot-accent-ink, #0d0a73)';
  const ASURF = 'var(--robot-accent-surface, rgba(13, 10, 115, .055))', ALINE = 'var(--robot-accent-line, rgba(13, 10, 115, .2))';
  const INK = 'var(--robot-ink, #0a0a0b)', INK2 = 'var(--robot-ink-2, #3c3c43)', MUTED = 'var(--robot-muted, #6b6b74)';
  const LINE = 'var(--robot-line, rgba(10, 10, 11, .11))', LINE2 = 'var(--robot-line-strong, rgba(10, 10, 11, .26))';
  const SIGNAL = 'var(--robot-signal, #00b4c8)';
  const GLASS = 'var(--robot-glass, rgba(255, 255, 255, .7))', GLASS_LINE = 'var(--robot-glass-line, rgba(255, 255, 255, .7))';
  const GLASS_HOVER = 'var(--robot-glass-hover, rgba(255, 255, 255, .55))';
  const EASE = 'cubic-bezier(.16, 1, .3, 1)';
  const CSS = `
    :host { position: fixed; right: calc(16px + env(safe-area-inset-right, 0px)); bottom: calc(10px + env(safe-area-inset-bottom, 0px)); z-index: 2147483000; display: block; width: 240px; height: 216px; pointer-events: none;
      color: ${INK}; font-size: 14.5px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
    @media (max-width: 640px) { :host { width: 140px; height: 126px; right: calc(6px + env(safe-area-inset-right, 0px)); bottom: calc(6px + env(safe-area-inset-bottom, 0px)); } }
    :host([hidden]) { display: none; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    svg { display: block; flex: none; }
    /* The robot itself (its picture, what can be clicked and its emotes), animated on its own so that fading it out can
       never take the corner button with it. */
    .body { position: absolute; inset: 0; transform-origin: 50% 72%; }
    /* Only this stage moves: the dock remains fixed to the viewport during flights and dragging. */
    .stage { position: absolute; inset: 0; translate: 0 var(--robot-stage-lift, 0px); transition: translate .45s ease; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 0; transition: opacity .7s ease; }
    canvas.on { opacity: 1; }
    :host([data-state="hidden"]) .body { visibility: hidden; }
    /* On a private page (signing in, creating an account, the profile) nothing of Ixia shows, not even its button. */
    :host([data-state="away"]) { visibility: hidden; pointer-events: none; }
    :host([data-state="away"]) * { pointer-events: none !important; }
    .hit { position: absolute; left: 25%; top: 4%; width: 50%; height: 96%; pointer-events: auto; cursor: pointer; border-radius: 46% 46% 42% 42%; outline: none;
      touch-action: pan-y; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
    /* A finger running down the page over Ixia scrolls the page; a sideways drag picks Ixia up. */
    :host([data-dragging]) .hit { cursor: grabbing; touch-action: none; }
    .hit:focus-visible { outline: 2px solid ${ACC}; outline-offset: 2px; }
    /* Until Ixia has been drawn, its box takes no clicks: nothing invisible ever catches one meant for the page. */
    :host(:not([data-drawn])) .hit { pointer-events: none; }
    /* Peeking from the corner, only its head takes clicks: a link or a card just under it still gets them. (Above the
       inline size _frame sets.) */
    :host([data-peek]) .hit { height: 40% !important; }

    /* A remark (and a tour's step) is a card of frosted glass in the page's own surface and ink, nearly solid like the
       top bar over white, so a line reads over any page, light or dark. Its own properties, which the page does not
       set (--robot-bubble, --robot-bubble-line), so the chat's clearer glass below never thins it. */
    .bubble { position: absolute; right: 64%; bottom: 72%; width: max-content; max-width: min(268px, calc(100vw - 24px)); padding: 11px 15px 12px; pointer-events: auto;
      --bubble-bg: var(--robot-bubble, color-mix(in srgb, var(--surface, #ffffff) 93%, transparent));
      --bubble-line: var(--robot-bubble-line, color-mix(in srgb, var(--ink, #0a0a0b) 10%, transparent));
      color: ${INK}; background: linear-gradient(180deg, color-mix(in srgb, #ffffff 6%, transparent), transparent 60%), var(--bubble-bg);
      border: 1px solid var(--bubble-line); border-radius: 18px;
      -webkit-backdrop-filter: blur(20px) saturate(1.15); backdrop-filter: blur(20px) saturate(1.15);
      box-shadow: var(--robot-bubble-shadow, 0 14px 34px -10px rgba(13, 10, 60, .26), 0 2px 6px rgba(13, 10, 60, .07));
      letter-spacing: -.003em; text-wrap: balance;
      opacity: 0; visibility: hidden; transform: translateY(10px) scale(.94); transform-origin: 100% 100%;
      transition: opacity .2s ease, transform .4s ${EASE}, translate .25s ${EASE}, border-color .25s ease, visibility 0s linear .4s; }
    .bubble.show { opacity: 1; visibility: visible; transform: none; transition: opacity .22s ease, transform .45s ${EASE}, translate .25s ${EASE}, border-color .25s ease; }
    /* A plain remark never blocks the page under it: only the chat, a tour and the "click again" prompt take the
       pointer; and nothing does while it fades away. */
    .bubble:not(.chat):not(.touring):not(.hint), .bubble:not(.show) { pointer-events: none; }
    /* A line that opens the chat when clicked looks it: a pointer, the accent's hairline (round its tail too) and a
       faint halo, and a small lift under the pointer. */
    .bubble.hint:not(.chat) { --bubble-line: ${ALINE}; cursor: pointer;
      box-shadow: var(--robot-bubble-shadow, 0 14px 34px -10px rgba(13, 10, 60, .26), 0 2px 6px rgba(13, 10, 60, .07)), 0 0 0 3px ${ASURF}; }
    .bubble.hint.show:not(.chat):hover { translate: 0 -1px; }
    /* Left alone, the chat dissolves away. */
    .bubble.covered:not(.chat) { opacity: 0; visibility: hidden; transition: opacity .15s ease, visibility 0s linear .15s; }
    .bubble.show.fading { opacity: 0; transform: translateY(6px) scale(.97); filter: blur(5px); transition: opacity .6s ease, transform .6s ease, filter .6s ease; }
    /* The chat: glass the page shows through, blurred and its contrast eased, so the text reads on light and dark alike. */
    .bubble.chat { width: min(352px, calc(100vw - 20px)); max-width: none; padding: 18px 16px 16px; color: ${INK2};
      background: linear-gradient(160deg, var(--robot-glass-sheen, rgba(255, 255, 255, .34)), transparent 58%), ${GLASS};
      border-color: ${GLASS_LINE}; border-radius: var(--robot-radius, 22px);
      -webkit-backdrop-filter: var(--robot-backdrop, blur(24px) saturate(170%) contrast(.82) brightness(1.28));
      backdrop-filter: var(--robot-backdrop, blur(24px) saturate(170%) contrast(.82) brightness(1.28));
      box-shadow: var(--robot-shadow, 0 18px 50px rgba(10, 10, 40, .18)), inset 0 1px 0 rgba(255, 255, 255, .45); letter-spacing: normal; text-wrap: pretty; }
    .bubble.touring { text-wrap: pretty; }
    /* The tail: an outline triangle in the rim's colour with the fill's own triangle over it, both hung from the edge of
       the bubble's inside (top: 100% is the lower border's inner edge). The fill runs on through the border, so there is
       no seam, nothing overlaps the body and no second blur is drawn. */
    .bubble::before, .bubble::after { content: ''; position: absolute; top: 100%; right: 26px; width: 18px; height: 10px; pointer-events: none;
      clip-path: polygon(0 0, 100% 0, 88% 100%); }
    .bubble::before { right: 25px; width: 20px; height: 11.5px; background: var(--bubble-line); }
    .bubble::after { background: var(--bubble-bg); }
    .bubble.chat::before, .bubble.chat::after { display: none; }
    .bubble[data-side="right"] { transform-origin: 0 100%; }
    .bubble[data-side="right"]::before, .bubble[data-side="right"]::after { right: auto; left: 26px; clip-path: polygon(0 0, 100% 0, 12% 100%); }
    .bubble[data-side="right"]::before { left: 25px; }
    .bubble[data-side="top"] { transform: translate(-50%, 10px) scale(.94); transform-origin: 50% 100%; }
    .bubble[data-side="top"].show { transform: translate(-50%, 0); }
    .bubble[data-side="bottom"] { transform: translate(-50%, -10px) scale(.94); transform-origin: 50% 0; }
    .bubble[data-side="bottom"].show { transform: translate(-50%, 0); }
    .bubble[data-side="top"]::before, .bubble[data-side="top"]::after { right: auto; left: calc(50% - 9px + var(--tail, 0px)); clip-path: polygon(0 0, 100% 0, 50% 100%); }
    .bubble[data-side="top"]::before { left: calc(50% - 10px + var(--tail, 0px)); }
    .bubble[data-side="bottom"]::before, .bubble[data-side="bottom"]::after { top: auto; bottom: 100%; right: auto; left: calc(50% - 9px + var(--tail, 0px));
      clip-path: polygon(50% 0, 100% 100%, 0 100%); }
    .bubble[data-side="bottom"]::before { left: calc(50% - 10px + var(--tail, 0px)); }

    .x { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; display: grid; place-items: center; border: 0; border-radius: 50%;
      background: transparent; color: ${MUTED}; cursor: pointer; transition: background-color .2s ease, color .2s ease; z-index: 1; }
    .x:hover { color: ${INK}; background: ${GLASS_HOVER}; }

    .msg { max-height: 38vh; overflow-y: auto; overscroll-behavior: contain; white-space: pre-line; }
    .chat .msg { padding-right: 26px; font-size: 15px; line-height: 1.5; color: ${INK}; }
    .chat.answer .msg { padding-right: 0; font-size: 14.5px; color: ${INK2}; }
    .asked { margin: 2px 26px 6px 0; font-size: 15.5px; font-weight: 600; line-height: 1.35; letter-spacing: -.01em; color: ${INK}; }
    .rest { color: transparent; }
    .dots { display: inline-flex; gap: 4px; padding: 8px 0; }
    .dots i { width: 6px; height: 6px; border-radius: 50%; background: ${ACC}; opacity: .3; animation: rc-dot 1s infinite ease-in-out; }
    .dots i:nth-child(2) { animation-delay: .15s; }
    .dots i:nth-child(3) { animation-delay: .3s; }
    @keyframes rc-dot { 0%, 80%, 100% { opacity: .25; transform: none; } 40% { opacity: 1; transform: translateY(-3px); } }

    /* The one action under the intro, in the site's filled pill. */
    .cta { margin-top: 12px; }
    .cta button, .links button, .ask button, .tour .next { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; border-radius: 999px;
      padding: 0 16px; height: 38px; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; color: ${ON}; background: ${ACC};
      transition: filter .2s ease, transform .2s ${EASE}; }
    .cta button:hover, .links button:hover, .ask button:hover, .tour .next:hover { filter: brightness(1.12); }
    .cta button:active, .links button:active, .ask button:active, .tour .next:active { transform: scale(.97); }
    .links, .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .cta { display: flex; flex-wrap: wrap; gap: 8px; }
    .cta button.alt { color: ${AINK}; background: ${ASURF}; box-shadow: inset 0 0 0 1px ${ALINE}; }
    /* Revision answers: the right one in the site's aqua, a wrong pick in the alert red. */
    .list button:disabled { cursor: default; transform: none; }
    .list button.right { border-color: ${SIGNAL}; background: color-mix(in srgb, ${SIGNAL} 14%, transparent); color: ${INK}; }
    /* The tick replaces the chevron where it stands, with no turn from one to the other. */
    .list button.right::after { width: 9px; height: 5px; border-top: 0; border-right: 0; border-left: 2px solid ${SIGNAL}; border-bottom: 2px solid ${SIGNAL}; transform: rotate(-45deg); opacity: 1; transition: none; }
    .list button.wrong { border-color: #e5484d; background: color-mix(in srgb, #e5484d 10%, transparent); }
    .list button.wrong::after { opacity: 0; }
    .list button.go { justify-content: center; margin-top: 4px; border: 0; border-radius: 999px; height: 40px; font-weight: 600; color: ${ON}; background: ${ACC}; }
    .list button.go::after { display: none; }
    .list button.go:not(:disabled):hover { filter: brightness(1.12); border-color: transparent; background: ${ACC}; transform: none; }
    .asked .qcount { display: block; margin-bottom: 6px; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: ${MUTED}; }
    .asked .qtopic { font-size: 12.5px; letter-spacing: 0; text-transform: none; color: ${AINK}; }

    /* Questions: a short list of the most useful ones, five at first and ten with View more. */
    .list { display: flex; flex-direction: column; gap: 6px; margin: 14px -4px 0; padding: 0 4px 2px; overflow-y: auto; overscroll-behavior: contain;
      scrollbar-width: thin; scrollbar-color: ${LINE2} transparent;
      max-height: min(50vh, 440px, max(150px, calc(var(--room, 100vh) - var(--robot-safe-top, 16px) - 220px))); }
    @media (max-height: 599.98px) {
      .bubble.chat { padding: 12px 14px; }
      .list { max-height: max(84px, calc(var(--room, 100vh) - var(--robot-safe-top, 16px) - 170px)); margin-top: 8px; }
    }
    .list h4 { margin: 2px 2px 2px; font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: ${MUTED}; }
    .list button { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: 1px solid ${LINE}; border-radius: 14px; padding: 10px 12px;
      font: inherit; font-size: 14px; line-height: 1.35; color: ${INK}; background: ${GLASS_HOVER}; cursor: pointer;
      transition: background-color .2s ease, border-color .2s ease, transform .25s ${EASE}; animation: rc-in .4s ${EASE} both; animation-delay: calc(var(--i, 0) * 40ms); }
    .list button::after { content: ''; flex: none; width: 7px; height: 7px; margin-left: auto; border-top: 1.8px solid ${MUTED}; border-right: 1.8px solid ${MUTED};
      transform: rotate(45deg); opacity: .6; transition: transform .25s ${EASE}, opacity .2s ease; }
    /* Hover moves only a live option: an answered one (its tick or cross) holds still. */
    .list button:not(:disabled):hover { border-color: ${ALINE}; background: ${ASURF}; transform: translateX(2px); }
    .list button:not(:disabled):hover::after { opacity: 1; transform: translateX(2px) rotate(45deg); }
    @keyframes rc-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .list .none { padding: 6px 2px; font-size: 14px; color: ${MUTED}; }
    .more { display: inline-flex; align-items: center; gap: 7px; margin-top: 10px; padding: 4px 2px; border: 0; background: transparent; font: inherit; font-size: 14px;
      font-weight: 500; color: ${AINK}; cursor: pointer; }
    .more::after { content: ''; width: 6px; height: 6px; margin-top: -3px; border-right: 1.6px solid currentColor; border-bottom: 1.6px solid currentColor; transform: rotate(45deg);
      transition: transform .25s ${EASE}; }
    .more[aria-expanded="true"]::after { margin-top: 3px; transform: rotate(-135deg); }
    /* The site's link highlight: a hairline in the text's colour that draws in from the left. */
    .more span, .back span { position: relative; }
    .more span::after, .back span::after { content: ''; position: absolute; left: 0; bottom: -2px; width: 100%; height: 1px; background: currentColor;
      transform: scaleX(0); transform-origin: left; transition: transform .4s ${EASE}; }
    .more:hover span::after, .more:focus-visible span::after, .back:hover span::after, .back:focus-visible span::after { transform: scaleX(1); }
    .chips button { border: 1px solid ${LINE}; border-radius: 14px; padding: 8px 12px; font: inherit; font-size: 13.5px; line-height: 1.4; cursor: pointer; color: ${INK2};
      background: ${GLASS_HOVER}; text-align: left; transition: border-color .2s ease, color .2s ease, background-color .2s ease; }
    .chips button:hover { border-color: ${ALINE}; color: ${AINK}; background: ${ASURF}; }
    .chips .rel { flex-basis: 100%; margin: 4px 0 -2px; font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: ${MUTED}; }
    .back { display: inline-flex; align-items: center; gap: 4px; margin: -4px 0 8px; padding: 4px 0; border: 0; background: transparent; font: inherit; font-size: 13.5px;
      font-weight: 500; color: ${AINK}; cursor: pointer; }

    /* The question field, in the site's pill shape. */
    .ask { display: flex; gap: 8px; margin-top: 14px; }
    .ask input { flex: 1; min-width: 0; height: 42px; padding: 0 16px; border: 1px solid ${LINE}; border-radius: 999px;
      font: inherit; font-size: 14px; color: ${INK}; background: var(--robot-field, rgba(255, 255, 255, .8)); outline: none; transition: border-color .2s ease, box-shadow .2s ease; }
    .ask input::placeholder { color: ${MUTED}; }
    .ask input:focus { border-color: ${ACC}; box-shadow: 0 0 0 3px ${ASURF}; }
    .ask button { width: 42px; height: 42px; padding: 0; }
    button:focus-visible { outline: 2px solid ${ACC}; outline-offset: 2px; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

    /* Guided steps. */
    .bubble.touring { width: min(320px, calc(100vw - 24px)); max-width: none; padding-top: 14px; }
    .touring .msg { padding-right: 26px; }
    .tour { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
    .tour .count { margin-right: auto; font-size: 12px; font-weight: 600; letter-spacing: .04em; color: ${MUTED}; font-variant-numeric: tabular-nums; }
    .tour button { height: 36px; border: 0; border-radius: 999px; padding: 0 15px; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .tour .prev { color: ${INK}; background: ${GLASS_HOVER}; border: 1px solid ${LINE}; }
    .tour .prev:hover { border-color: ${LINE2}; }

    /* Emotes rise from the head and fade. */
    .emotes { position: absolute; left: 50%; top: 6%; width: 0; height: 0; pointer-events: none; }
    .emote { position: absolute; left: 0; top: 0; width: 22px; height: 22px; margin: -11px 0 0 -11px; opacity: 0;
      animation: rc-emote var(--dur, 1.7s) cubic-bezier(.2, .7, .3, 1) var(--delay, 0s) forwards; }
    .emote svg { width: 100%; height: 100%; filter: drop-shadow(0 2px 4px rgba(10, 10, 40, .25)); }
    @keyframes rc-emote {
      0% { opacity: 0; transform: translate(0, 6px) scale(.4) rotate(0deg); }
      18% { opacity: 1; transform: translate(calc(var(--dx) * .3), -18px) scale(var(--s, 1)) rotate(calc(var(--r) * .3)); }
      75% { opacity: 1; }
      100% { opacity: 0; transform: translate(var(--dx), var(--dy, -72px)) scale(calc(var(--s, 1) * .9)) rotate(var(--r)); }
    }
    .emote.bit { width: 7px; height: 11px; margin: -5px 0 0 -3px; border-radius: 2px; animation-name: rc-burst; animation-timing-function: cubic-bezier(.15, .7, .4, 1); }
    @keyframes rc-burst {
      0% { opacity: 0; transform: translate(0, 0) rotate(0deg) scale(.5); }
      12% { opacity: 1; }
      100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--r)) scale(1); }
    }

    /* Motes of light: Ixia dissolves into them when sent away, and gathers out of them when it comes back. */
    .dust { position: absolute; inset: 0; pointer-events: none; }
    .mote { position: absolute; left: 0; top: 0; width: var(--s, 5px); height: var(--s, 5px); border-radius: 2px; opacity: 0; background: var(--c, #5ff3ff);
      box-shadow: 0 0 6px var(--c, #5ff3ff); animation: rc-mote var(--dur, .9s) cubic-bezier(.2, .7, .3, 1) var(--delay, 0s) forwards; }
    @keyframes rc-mote {
      0% { opacity: 0; transform: translate(var(--x0), var(--y0)) scale(.6); }
      22% { opacity: 1; }
      100% { opacity: 0; transform: translate(var(--x1), var(--y1)) scale(1); }
    }

    /* Sent away, Ixia dissolves into a small button in the lower right corner: its face in miniature on a disc of
       glass, its name opening beside it under the pointer. */
    .dock { position: fixed; right: calc(var(--dock-x, 20px) + env(safe-area-inset-right, 0px)); bottom: calc(var(--dock-y, 20px) + var(--robot-dock-lift, 0px) + var(--dock-nudge, 0px));
      display: none; z-index: 2; align-items: center; height: 50px; min-width: 50px; padding: 0 11px; border-radius: 999px; border: 1px solid ${GLASS_LINE};
      background: linear-gradient(160deg, var(--robot-glass-sheen, rgba(255, 255, 255, .34)), transparent 60%), var(--robot-dock, rgba(255, 255, 255, .86));
      -webkit-backdrop-filter: var(--robot-backdrop, blur(20px) saturate(170%)); backdrop-filter: var(--robot-backdrop, blur(20px) saturate(170%));
      box-shadow: var(--robot-shadow, 0 10px 30px rgba(10, 10, 40, .16)); color: ${INK}; font: inherit; font-size: 13.5px; font-weight: 600;
      letter-spacing: .01em; line-height: 1; cursor: pointer; pointer-events: auto; -webkit-tap-highlight-color: transparent;
      transition: bottom .5s ${EASE}, transform .35s ${EASE}, box-shadow .35s ease, border-color .3s ease; }
    .dock-face { display: grid; place-items: center; width: 26px; height: 26px; flex: none; }
    .dock-face svg { width: 26px; height: 26px; filter: drop-shadow(0 1px 1.5px rgba(10, 10, 40, .22)); }
    .dock-name { display: inline-block; max-width: 0; overflow: hidden; white-space: nowrap; opacity: 0; margin-left: 0;
      transition: max-width .45s ${EASE}, opacity .3s ease, margin-left .45s ${EASE}; }
    .dock:hover, .dock:focus-visible { transform: translateY(-2px); border-color: ${ALINE};
      box-shadow: var(--robot-shadow, 0 10px 30px rgba(10, 10, 40, .16)), 0 0 0 5px color-mix(in srgb, ${SIGNAL} 16%, transparent); }
    .dock:hover .dock-name, .dock:focus-visible .dock-name, .dock.named .dock-name { max-width: 64px; opacity: 1; margin-left: 9px; }
    .dock:active { transform: scale(.96); }
    .dock:focus-visible { outline: 2px solid ${SIGNAL}; outline-offset: 3px; }
    .dock.drop-ready { border-color: ${SIGNAL}; box-shadow: 0 0 0 7px color-mix(in srgb, ${SIGNAL} 28%, transparent); }
    /* The robot or its button, never both: while Ixia is out the button shows only as the place to drag it to. */
    :host([data-dragging]) .dock { display: inline-flex; }
    /* Now and then the little face blinks. */
    .dock .eye { transform-box: fill-box; transform-origin: 50% 100%; animation: rc-dock-blink 7s ease-in-out infinite; }
    @keyframes rc-dock-blink { 0%, 94%, 100% { transform: none; } 97% { transform: scaleY(.12); } }
    :host([data-state="hidden"]) .dock { display: inline-flex; animation: rc-dock-in .8s ${EASE} backwards; }
    @keyframes rc-dock-in { 0% { opacity: 0; transform: scale(.3); filter: blur(5px); } 55% { opacity: 1; transform: scale(1.1); filter: blur(0); } 100% { opacity: 1; transform: none; } }
    /* As it takes Ixia in, a ring of light spreads from it once. */
    :host([data-state="hidden"]) .dock.arrive { animation: rc-dock-in .8s ${EASE} backwards, rc-dock-glow 1.5s cubic-bezier(.2, .7, .3, 1) .25s; }
    @keyframes rc-dock-glow { from { box-shadow: var(--robot-shadow, 0 10px 30px rgba(10, 10, 40, .16)), 0 0 0 0 rgba(95, 243, 255, .55); }
      to { box-shadow: var(--robot-shadow, 0 10px 30px rgba(10, 10, 40, .16)), 0 0 0 20px rgba(95, 243, 255, 0); } }
    /* Something happened while Ixia was away (a course finished, say): the button glows a few times, and Ixia tells of it
       when brought back. */
    :host([data-state="hidden"]) .dock.news { animation: rc-dock-glow 1.6s cubic-bezier(.2, .7, .3, 1) 4; }
    @media (max-width: 640px) { .dock { --dock-x: 12px; --dock-y: 12px; height: 46px; min-width: 46px; padding: 0 9px; } }
    /* A phone or a tablet: no blur behind the bubble, the chat or the corner button (redrawn under a moving page, it is
       what costs a phone most here) and no softening filters; their glass is made near opaque instead, so they read
       the same. */
    @media (max-width: 767px), (hover: none) and (pointer: coarse) {
      .bubble, .bubble.chat, .dock { -webkit-backdrop-filter: none; backdrop-filter: none; }
      .bubble.chat { background: linear-gradient(160deg, var(--robot-glass-sheen, rgba(255, 255, 255, .34)), transparent 58%), color-mix(in srgb, var(--surface, #ffffff) 97%, transparent); }
      .dock { background: color-mix(in srgb, var(--surface, #ffffff) 96%, transparent); }
      .emote svg, .dock-face svg { filter: none; }
      .bubble.show.fading { filter: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .stage { transition: none; }
      .dock, .dock .eye { animation: none !important; transition: none; }
      .dots i { animation: none; opacity: .6; }
      .bubble, .bubble.show { transition: opacity .2s ease, visibility 0s; }
      .list button { animation: none; }
      .bubble.show.fading { transition: opacity .3s ease; filter: none; transform: none; }
      .emote { animation-duration: .9s; }
    }
  `;
  const ICON_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const ICON_BACK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  const ICON_SEND = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  /** Ixia's face in miniature, for the corner button: the white helmet, the dark visor, two aqua eyes and a smile. */
  const ICON_FACE = '<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><rect x="13.2" y="2.6" width="5.6" height="3.4" rx="1.6" fill="#e9edf6"/>' +
    '<rect x="3.1" y="10" width="3" height="8.6" rx="1.5" fill="#2a25c4"/><rect x="25.9" y="10" width="3" height="8.6" rx="1.5" fill="#2a25c4"/>' +
    '<rect x="5.2" y="5.2" width="21.6" height="19.6" rx="8.4" fill="#f4f6fb" stroke="#d3d9e8" stroke-width=".8"/>' +
    '<rect x="8.1" y="8.6" width="15.8" height="12.4" rx="5.2" fill="#0d0a40"/>' +
    '<path class="eye" d="M10.6 15.6a2.25 2.25 0 0 1 4.5 0z" fill="#5ff3ff"/><path class="eye" d="M16.9 15.6a2.25 2.25 0 0 1 4.5 0z" fill="#5ff3ff"/>' +
    '<path d="M14.5 17.4a1.5 1.5 0 0 0 3 0z" fill="#5ff3ff"/><rect x="11" y="25" width="10" height="3.2" rx="1.6" fill="#0d0a40"/></svg>';
  const HTML = `<div class="stage"><div class="body"><canvas part="canvas"></canvas>
    <div class="emotes" aria-hidden="true"></div>
    <div class="hit" part="robot" role="button" tabindex="0" aria-label="Ask Ixia, the website guide" aria-haspopup="dialog" aria-expanded="false"></div></div>
    <div class="bubble" part="bubble">
      <button class="x" type="button" aria-label="Close" hidden>${ICON_X}</button>
      <button class="back" type="button" hidden>${ICON_BACK}<span></span></button>
      <p class="asked" hidden></p>
      <div class="msg"><span aria-hidden="true"><span class="typed"></span><span class="rest"></span></span><span class="dots" hidden><i></i><i></i><i></i></span></div>
      <div class="links" hidden></div>
      <div class="tour" hidden><span class="count"></span><button class="prev" type="button">Back</button><button class="next" type="button">Next</button></div>
      <div class="cta" hidden></div>
      <div class="list" hidden></div>
      <button class="more" type="button" aria-expanded="false" hidden><span></span></button>
      <div class="chips" hidden></div>
      <form class="ask" hidden><input type="text" maxlength="300" autocomplete="off" aria-label="Your question"><button type="submit" aria-label="Ask">${ICON_SEND}</button></form>
      <span class="sr" role="status" aria-live="polite"></span>
    </div>
    <div class="dust" aria-hidden="true"></div></div>
    <button class="dock" type="button" aria-label="Open Ixia, the website guide"><span class="dock-face">${ICON_FACE}</span><span class="dock-name">Ixia</span></button>`;


  // What Ixia does now and then while nobody is using it, per audience, [activity, weight]: a gesture or emote on the
  // spot, a spin (arms open, arms tucked in, or a skater's spin that opens out), a dance, or a flight: across to rest
  // on the other side of the window, a visit there and back (when nowhere there is clear to rest), up or down its own
  // side, a loop the loop, a figure of eight, a swoop out and back, a dive out of sight that comes up somewhere else,
  // or a little drift.
  const ACTIVITIES = {
    visitor: [['gesture', 3.6], ['spin', 2], ['trick', 1.7], ['dance', 1.5], ['sparkle', 0.7], ['cross', 1.3], ['visit', 0.9], ['climb', 1], ['loop', 0.8], ['figure8', 0.9], ['swoop', 0.8], ['peekaboo', 0.5], ['drift', 1.4]],
    learner: [['gesture', 3.2], ['spin', 2.2], ['trick', 1.8], ['dance', 2], ['sparkle', 0.8], ['cross', 1.3], ['visit', 0.9], ['climb', 1], ['loop', 1], ['figure8', 1], ['swoop', 0.8], ['peekaboo', 0.5], ['drift', 1.2]],
    admin: [['gesture', 5], ['spin', 0.9], ['trick', 0.4], ['cross', 1.2], ['visit', 0.6], ['climb', 1], ['drift', 1.8], ['swoop', 0.4], ['loop', 0.3]],
  };
  /** Its tricks: a somersault, a cartwheel, juggling, a clap. */
  const TRICKS = [['flip', 1.4], ['wheel', 1.2], ['juggle', 1], ['clap', 0.8], ['peer', 0.8]];
  /** The activities that move Ixia from where it rests. */
  const FLIGHTS = new Set(['cross', 'visit', 'climb', 'loop', 'figure8', 'swoop', 'peekaboo', 'drift']);
  /** Seconds between activities, per audience: often enough to feel alive, with room to breathe between them. */
  const ACT_EVERY = { visitor: [5.5, 10], learner: [5.5, 10], admin: [14, 24] };
  /** How many showier activities open each visit (and one each new page), and the gap between them. */
  const WARM_UP = 2, WARM_PAGE = 1, WARM_EVERY = [3.4, 5];
  /** Least seconds between two of its own flights (in the opening few, and after), and between two pops from the corner. */
  const FLY_GAP = { warm: 9, after: 16 }, POP_GAP = 24;
  /** Least seconds of stillness after any movement (an activity, a flight, a reaction) before the next, in the opening few and after. */
  const REST = { warm: 2.4, after: 3.2 };
  /**
   * On a phone or a tablet (owner, 30 Oct 2026: it took a lot of the phone's processing): its own activities this many
   * times further apart, its flights at least this far apart, its spot checked again this often, and it dozes sooner.
   * The showiest activities (sparks, loops, figures of eight, dives out of sight) are left out there, and spins,
   * dances and tricks come half as often (see _activity).
   */
  const HAND = { acts: 1.7, fly: { warm: 15, after: 30 }, recheck: 12, doze: 60 };
  const HAND_SKIP = new Set(['sparkle', 'loop', 'figure8', 'peekaboo']), HAND_HALF = new Set(['spin', 'dance', 'trick']);
  /** Seconds without any movement on the page before it dozes off, per audience. */
  const DOZE_AFTER = { visitor: 90, learner: 90, admin: 60 };
  /** The gestures and emotes on the spot, per audience. */
  const IDLE = {
    visitor: [['look', 3], ['wave', 2], ['hop', 2], ['wiggle', 2], ['think', 1], ['shrug', 1], ['peek', 1], ['bounce', 1.2], ['stretch', 1], ['curious', 1.2], ['clap', 0.8]],
    learner: [['star', 2], ['love', 2], ['flex', 2], ['rocket', 2], ['celebrate', 1], ['bounce', 1.2], ['hop', 1.2], ['look', 1], ['proud', 1], ['clap', 1]],
    admin: [['nod', 3], ['look', 3], ['think', 2], ['wave', 1], ['shrug', 1], ['hop', 1]],
  };
  /** What reads when only its head shows from the corner: looks, faces and emotes. */
  const PEEK_IDLE = {
    visitor: [['look', 2], ['peek', 2], ['wink', 1.5], ['curious', 1.5], ['giggle', 1.2], ['surprised', 1], ['think', 1], ['love', 1], ['hop', 1]],
    learner: [['star', 2], ['love', 2], ['wink', 1.5], ['look', 1.5], ['curious', 1.2], ['giggle', 1.2], ['hop', 1]],
    admin: [['nod', 3], ['look', 3], ['think', 2], ['wink', 1]],
  };
  /**
   * Its spins: arms out wide (twirl), arms tucked in close (pirouette), a skater's spin that starts tight and slows as
   * the arms open (whirl), a single turn (spin), and a spiral up and down (corkscrew).
   */
  const SPINS = {
    visitor: [['twirl', 2], ['pirouette', 2], ['whirl', 1.6], ['spin', 1.4], ['corkscrew', 1]],
    learner: [['twirl', 2], ['whirl', 2], ['pirouette', 1.6], ['corkscrew', 1.6], ['spin', 1]],
    admin: [['spin', 1], ['pirouette', 1]],
  };
  const DANCES = [['dance', 1], ['boogie', 1], ['sway', 1], ['robot', 0.8]];
  /** How Ixia reacts when clicked, per audience: [reaction, weight]. */
  const POKE = {
    visitor: [['giggle', 3], ['startle', 2], ['wink', 2], ['spin', 2], ['pirouette', 1.5], ['wiggle', 2], ['bounce', 2], ['boogie', 1.5], ['twirl', 1], ['shy', 1], ['peek', 1], ['shrug', 1], ['flip', 1.4], ['wheel', 1.2], ['cheer', 1]],
    learner: [['star', 2], ['love', 2], ['laugh', 2], ['boogie', 2], ['twirl', 2], ['whirl', 1.5], ['flex', 2], ['rocket', 2], ['celebrate', 1], ['bounce', 1], ['wiggle', 1], ['corkscrew', 1], ['flip', 1.4], ['wheel', 1.2], ['cheer', 1.2]],
    admin: [['wink', 2], ['surprised', 2], ['hop', 2], ['bounce', 1], ['shrug', 1], ['peek', 1]],
  };
  /** How a line lands in the bubble after a click: one of these, never the same twice running. */
  const LANDINGS = [['pop', 1], ['jolt', 1], ['tilt', 1], ['drop', 1], ['swing', 1]];
  /** Each action or reaction: a gesture, a face for a while, and an emote (every reaction to a selection has one). */
  const ACTS = {
    look: { gesture: 'look' },
    wave: { gesture: 'wave', face: ['happy', 1.8] },
    nod: { gesture: 'nod', face: ['happy', 1.2] },
    hop: { gesture: 'hop', face: ['happy', 1.1], emote: ['sparkle', 2] },
    think: { gesture: 'think', face: ['think', 2.6], emote: ['bulb', 1, 1.9] },
    stretch: { gesture: 'stretch', face: ['happy', 2.2] },
    spin: { gesture: 'spin', face: ['happy', 1.4], emote: ['sparkle', 3] },
    pirouette: { gesture: 'pirouette', face: ['wink', 1.4], emote: ['sparkle', 2] },
    whirl: { gesture: 'whirl', face: ['star', 2.4], emote: ['sparkle', 4, 0.6] },
    corkscrew: { gesture: 'corkscrew', face: ['laugh', 2], emote: ['swirl', 2, 0.5] },
    dance: { gesture: 'dance', face: ['laugh', 2.6], emote: ['note', 3] },
    sway: { gesture: 'sway', face: ['happy', 3], emote: ['note', 3, 0.4] },
    robot: { gesture: 'robot', face: ['wink', 2.8], emote: ['note', 2, 0.3] },
    celebrate: { gesture: 'celebrate', face: ['star', 2.2], emote: ['confetti', 12] },
    star: { gesture: 'hop', face: ['star', 1.9], emote: ['star', 3] },
    love: { gesture: 'nod', face: ['love', 1.9], emote: ['heart', 3] },
    giggle: { gesture: 'hop', face: ['laugh', 1.4], emote: ['heart', 2] },
    surprised: { gesture: 'hop', face: ['surprised', 1.2], emote: ['sparkle', 3] },
    wink: { gesture: 'nod', face: ['wink', 1.5], emote: ['sparkle', 1] },
    laugh: { gesture: 'shake', face: ['laugh', 1.6], emote: ['note', 2] },
    dizzy: { gesture: 'shake', face: ['dizzy', 1.8], emote: ['swirl', 2] },
    wiggle: { gesture: 'wiggle', face: ['laugh', 1.3], emote: ['note', 2] },
    bounce: { gesture: 'bounce', face: ['happy', 1.4], emote: ['sparkle', 2] },
    boogie: { gesture: 'boogie', face: ['laugh', 2.8], emote: ['note', 4] },
    twirl: { gesture: 'twirl', face: ['star', 1.6], emote: ['sparkle', 4] },
    shy: { gesture: 'shy', face: ['happy', 1.8], emote: ['heart', 1] },
    flex: { gesture: 'flex', face: ['star', 1.8], emote: ['trophy', 1] },
    rocket: { gesture: 'hop', face: ['star', 1.6], emote: ['rocket', 1] },
    startle: { gesture: 'jolt', face: ['surprised', 1.1], emote: ['exclaim', 1] },
    shrug: { gesture: 'shrug', face: ['think', 1.6], emote: ['question', 1] },
    peek: { gesture: 'peek', face: ['wink', 1.4], emote: ['sparkle', 2] },
    flip: { gesture: 'flip', face: ['excited', 1.6], emote: ['sparkle', 3, 0.7] },
    wheel: { gesture: 'wheel', face: ['laugh', 1.9], emote: ['star', 2, 0.8] },
    juggle: { gesture: 'juggle', face: ['curious', 3.1], emote: ['star', 4] },
    clap: { gesture: 'clap', face: ['happy', 1.9], emote: ['sparkle', 3] },
    cheer: { gesture: 'cheer', face: ['excited', 1.9], emote: ['confetti', 10] },
    peer: { gesture: 'peer', face: ['curious', 2.4] },
    yawn: { gesture: 'yawn', face: ['yawn', 2.4] },
    sigh: { gesture: 'sigh', face: ['sad', 2] },
    scratch: { gesture: 'scratch', face: ['confused', 2.3], emote: ['question', 1, 0.5] },
    boost: { gesture: 'boost', face: ['excited', 2.2], emote: ['rocket', 1, 0.5] },
    proud: { gesture: 'flex', face: ['proud', 2], emote: ['trophy', 1] },
    curious: { gesture: 'peer', face: ['curious', 2.4], emote: ['question', 1, 0.6] },
    confused: { gesture: 'scratch', face: ['confused', 2.3], emote: ['question', 1, 0.5] },
    sad: { gesture: 'sigh', face: ['sad', 2.2] },
    tired: { gesture: 'yawn', face: ['tired', 2.6] },
    excited: { gesture: 'cheer', face: ['excited', 2], emote: ['star', 3] },
  };
  /**
   * Little moments, once per visit each: as one of these comes into view, Ixia reacts (on the home page, and at the
   * foot of any page).
   */
  const MOMENTS = [['#levels', 'star', true], ["[data-robot='home-testimonials']", 'love', true], ["[data-robot='home-workshops']", 'bounce', true],
    ["[data-robot='site-footer']", 'dance', false]];

  // ---------- flight ----------
  /** How a flight's pace runs from 0 to 1: an even glide, a brisk one, a lazy float, or a dash that eases in to land. */
  const PACES = {
    smooth: s => s * s * s * (s * (s * 6 - 15) + 10),
    brisk: s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2),
    lazy: s => 0.5 - 0.5 * Math.cos(Math.PI * s),
    dash: s => 1 - Math.pow(1 - s, 3),
  };
  /**
   * How it holds itself in flight, at full stretch mid-flight: arms a little out (glide), barely moving (drift), out
   * wide like wings, tucked in for a dive, or the leading arm out ahead to show the way (lead).
   */
  const FLIGHT_POSES = {
    glide: { lz: 0.32, rz: 0.32, lx: 0.3, rx: 0.3, hx: -0.06, lift: 10 },
    drift: { lz: 0.13, rz: 0.13, lx: 0.12, rx: 0.12, hx: -0.02, lift: 4 },
    wings: { lz: 1.15, rz: 1.15, lx: -0.08, rx: -0.08, hx: -0.08, lift: 12 },
    dive: { lz: -0.12, rz: -0.12, lx: 0.65, rx: 0.65, hx: 0.12, lift: 0 },
    loop: { lz: 0.55, rz: 0.55, lx: 0.25, rx: 0.25, hx: -0.05, lift: 8 },
    lead: { lead: 1.5, trail: 0.25, lx: 0.1, rx: 0.1, hx: -0.06, lift: 10 },
  };
  /** A flight, worked out in full before it starts. */
  function planFlight(from, v0, to, o = {}) {
    const H = 1 / 240, KEEP = 2, D = Math.max(0.2, o.dur || 1), shape = o.shape || 'glide';
    const dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy), dir = dx < 0 ? -1 : 1;
    // A unit normal to the way, pointing up the screen (or down, flipped).
    let nx = dist > 1 ? -dy / dist : 0, ny = dist > 1 ? dx / dist : -1;
    if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
    if (o.flip) { nx = -nx; ny = -ny; }
    const b = (o.bulge != null ? o.bulge : 0.12) * dist;
    const P1 = { x: from.x + dx / 3 + nx * b, y: from.y + dy / 3 + ny * b };
    const P2 = shape === 'swoop' ? { x: from.x + (2 * dx) / 3 - nx * b, y: from.y + (2 * dy) / 3 - ny * b } : { x: from.x + (2 * dx) / 3 + nx * b, y: from.y + (2 * dy) / 3 + ny * b };
    const bez = (a, p, q, z, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * p + 3 * v * u * u * q + u * u * u * z; };
    const pace = PACES[o.pace] || PACES.smooth, r = o.r || 52, amp = o.amp || 26, waves = o.waves || 2;
    const pts0 = o.points || [from, to];
    const carrot = u => {
      let x, y;
      if (shape === 'path') {
        const P = pts0, w = u * (P.length - 1), i = Math.min(P.length - 2, Math.floor(w)), lt = w - i;
        const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
        const cr = (a, b2, c, d) => 0.5 * (2 * b2 + (-a + c) * lt + (2 * a - 5 * b2 + 4 * c - d) * lt * lt + (-a + 3 * b2 - 3 * c + d) * lt * lt * lt);
        x = cr(p0.x, p1.x, p2.x, p3.x); y = cr(p0.y, p1.y, p2.y, p3.y);
      } else { x = bez(from.x, P1.x, P2.x, to.x, u); y = bez(from.y, P1.y, P2.y, to.y, u); }
      if (shape === 'wave' || shape === 'zigzag') {
        const ph = Math.PI * 2 * waves * u, w = (shape === 'zigzag' ? (2 / Math.PI) * Math.asin(Math.sin(ph) * 0.98) : Math.sin(ph)) * amp * Math.sin(Math.PI * u);
        x += nx * w; y += ny * w;
      } else if (shape === 'loop') {
        const v = PACES.smooth(clamp((u - 0.3) / 0.45, 0, 1));
        x += dir * r * Math.sin(Math.PI * 2 * v); y -= r * (1 - Math.cos(Math.PI * 2 * v));
      } else if (shape === 'figure8') {
        // Out to one side and back, crossing itself half way: it never swings past where it began.
        x += (o.side || dir) * (o.ax || 36) * (1 - Math.cos(Math.PI * 2 * u)); y -= (o.ay || 28) * Math.sin(Math.PI * 4 * u);
      }
      return [x, y];
    };
    const w = o.stiff || 12, z = o.damp != null ? o.damp : 0.9;
    let x = from.x, y = from.y, vx = (v0 && v0.x) || 0, vy = (v0 && v0.y) || 0, t = 0, n = 0;
    const pts = [x, y];
    while (t < D + 1.8) {
      const [cx, cy] = carrot(pace(Math.min(1, t / D)));
      vx += (w * w * (cx - x) - 2 * z * w * vx) * H; vy += (w * w * (cy - y) - 2 * z * w * vy) * H;
      x += vx * H; y += vy * H; t += H;
      if (++n % KEEP === 0) pts.push(x, y);
      if (t >= D && Math.hypot(to.x - x, to.y - y) < 0.3 && Math.hypot(vx, vy) < 4) break;
    }
    pts.push(to.x, to.y);
    return { pts, step: H * KEEP, dur: (pts.length / 2 - 1) * H * KEEP };
  }

  class RobotCompanion extends HTMLElement {
    static get observedAttributes() { return ['bubble']; }
    static get gestures() { return Object.keys(GESTURES); }
    static get faces() { return Object.keys(FACES); }

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${CSS}</style>${HTML}`;
      const $ = s => root.querySelector(s);
      Object.assign(this, { _canvas: $('canvas'), _hit: $('.hit'), _bubble: $('.bubble'), _typed: $('.typed'), _rest: $('.rest'), _dots: $('.dots'),
        _links: $('.links'), _chips: $('.chips'), _form: $('.ask'), _input: $('.ask input'), _x: $('.x'), _sr: $('.sr'), _list: $('.list'),
        _more: $('.more'), _moreLabel: $('.more span'), _cta: $('.cta'), _back: $('.back'), _backLabel: $('.back span'), _asked: $('.asked'), _emotes: $('.emotes'),
        _dust: $('.dust'), _msg: $('.msg'), _dock: $('.dock'), _body: $('.body'), _stage: $('.stage'),
        _tourEl: $('.tour'), _count: $('.tour .count'), _prev: $('.tour .prev'), _next: $('.tour .next') });
      Object.assign(this, { _gestures: [], _token: 0, _talking: false, _talkAmt: 0, _hover: false, _hoverAmt: 0, _lk: { x: 0, y: 0 }, _lkT: { x: 0, y: 0 },
        _lastMove: -1e9, _blinkAt: -1, _blinkNext: now() + 1.5, _visible: true, _busy: true, _raf: 0, _off: { x: 0, y: 0 }, _cfg: {}, _chat: false,
        _guideToken: 0, _guiding: null, _mode: 'off', _faceName: 'neutral', _faceShown: 'neutral', _faceUntil: Infinity, _faceSwap: -1,
        _moreOpen: false, _hintUntil: 0, _sleeping: false, _actAt: 0, _chatPokes: 0,
        // Where it rests (an offset from its corner), and what it has done lately, so it does not repeat itself.
        _home: { id: 'R', x: 0, y: 0, side: 'right' }, _recentPoke: [], _recentLine: [], _recentLanding: [], _recentIdle: [],
        _recentOpener: [], _recentInvite: [], _recentIntro: [], _recentMoment: [], _recentAct: [], _recentShape: [], _recentPace: [], _recentPose: [], _vel: { x: 0, y: 0 },
        _tilt: 0, _tiltT: 0, _readMs: 0 });
      this.ready = new Promise(r => (this._ready = r));
      // Settled once the page has said who is looking (configure() with an audience), which the entrance waits for.
      this._configured = new Promise(r => (this._configuredNow = r));
      // Timers for something meant for this page only (a hint a moment after a moment): a new page clears them.
      this._timers = new Set();
      this._engaged = new Promise(r => (this._engageNow = r));
      this._engage = () => { if (!this._isEngaged) { this._isEngaged = true; this._engageNow(); } };
      this._loop = this._loop.bind(this);
      // The browser may take a 3D context away (too many in use, a graphics restart).
      this._onLost = e => { e.preventDefault(); this._lost = true; this._lostAt = now(); this._shown = false; this._canvas.classList.remove('on'); this.removeAttribute('data-drawn'); };
      this._onRestored = () => {
        this._lost = false; this._shown = false; this._frame(); this._kick();
        if (this._down && this._mode === 'hidden') this._down = false;
      };
      this._onMove = e => {
        this._act();
        // With a mouse, moving it counts as taking part in the page (a reader often only moves the pointer).
        if (!this._isEngaged && e.pointerType === 'mouse') this._engage();
        this._ptr = { x: e.clientX, y: e.clientY, t: now() };
        if (this.look === 'none' || !this._head) return;
        const c = this._canvas.getBoundingClientRect();
        this._lkT.x = clamp((e.clientX - c.left - this._head.x) / 520, -1, 1);
        this._lkT.y = clamp((e.clientY - c.top - this._head.y) / 420, -1, 1);
        this._lastMove = now(); this._kick();
      };
      this._onOut = e => { if (!e.relatedTarget) this._lastMove = -1e9; };
      // A scroll, click, tap or key press: the reader is taking part in the page (its tips and remarks wait for that;
      // its greeting does not).
      this._onAct = () => { this._act(); this._engage(); };
      this._onScroll = () => {
        this._act(); this._engage();
        this._syncRing();
        if (this._guiding && !this._followRaf) this._followRaf = requestAnimationFrame(() => { this._followRaf = 0; this._followTarget(); });
        const y = scrollY, dy = this._sy == null ? 0 : y - this._sy;
        this._sy = y;
        // It looks the way the page moves (eased in by _pose, so a fast scroll never jerks its head); not on a phone or a
        // tablet, where it keeps still while the page scrolls (see _loop).
        if (dy && !this._hand.matches) { this._tiltT = clamp(this._tiltT + dy / 240, -1, 1); this._kick(); }
        // Once the page stops, it checks whether it now covers anything (sent away, whether its corner button does).
        if (!this._guiding) this._scrollAt = now();
        clearTimeout(this._settleT); this._settleT = setTimeout(() => (this._mode === 'hidden' ? this._placeDock() : this._settle()), SCROLL_SETTLE_MS);
      };
      this._onResize = () => {
        if (this._guiding) this._followTarget();
        this._placeBubble();
        // Its own timer, so a scroll at the same moment can never turn the forced re-placing into an ordinary check.
        clearTimeout(this._resizeT); this._resizeT = setTimeout(() => (this._mode === 'hidden' ? this._placeDock() : this._settle(true)), 420);
      };
      // What happens on the page (a message, a form that will not go, a course finished) and clicks that get nowhere.
      // (Heard here, it is taken off the page's list of moments kept for a robot not yet loaded; see robot-moments.ts.)
      this._onMoment = e => {
        const d = e.detail || {}, kept = window.__robotMoments;
        if (Array.isArray(kept) && kept.includes(d)) kept.splice(kept.indexOf(d), 1);
        this._react(Object.assign({ at: Date.now(), path: location.pathname }, d));
      };
      this._onRage = e => {
        if ((typeof e.composedPath === 'function' ? e.composedPath() : []).includes(this)) return;
        const t = now();
        this._clicks = (this._clicks || []).filter(c => t - c.t < 1.1 && Math.hypot(c.x - e.clientX, c.y - e.clientY) < 36).concat({ t, x: e.clientX, y: e.clientY });
        if (this._clicks.length >= 4) { this._clicks = []; this._struggle('rage'); }
      };
      // Selecting anywhere outside Ixia closes the chat.
      this._onDocDown = e => {
        if (!this._chat) return;
        const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
        if (!path.includes(this)) this.closeChat();
      };

      // One click reacts (or opens the chat); two within a third of a second (a double click, or two quick taps) send
      // Ixia away.
      this._hit.addEventListener('click', () => {
        if (performance.now() < (this._suppressClickUntil || 0)) return;
        clearTimeout(this._clickT);
        const t = performance.now(), twice = t - (this._clickAt || -1e9) < 320;
        this._clickAt = twice ? -1e9 : t;
        if (twice) { this._clickT = 0; return this._dismiss(); }
        this._clickT = setTimeout(() => { this._clickT = 0; this._poke(); }, 240);
      });
      this._hit.addEventListener('pointerdown', e => this._startDrag(e));
      this._hit.addEventListener('pointermove', e => this._moveDrag(e));
      this._hit.addEventListener('pointerup', e => this._finishDrag(e));
      this._hit.addEventListener('pointercancel', e => this._finishDrag(e, true));
      this._hit.addEventListener('lostpointercapture', e => this._finishDrag(e, true));
      this._hit.addEventListener('keydown', e => {
        // Escape sends Ixia away: the keyboard's way to do what a double click or a drag does.
        if (e.key === 'Escape' && !this._chat && !this._guiding) { e.stopPropagation(); return this._dismiss({ quick: true }); }
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (this._chat) this.closeChat(); else this.openChat({ keyboard: true });
      });
      this._hit.addEventListener('pointerenter', () => { this._hover = true; this._kick(); if (!this._chat && !this._sleeping && this._faceName === 'neutral') this.face('happy', 60); });
      this._hit.addEventListener('pointerleave', () => { this._hover = false; this._kick(); if (this._faceName === 'happy' && this._faceUntil - now() > 30) this.face('neutral'); });
      this._x.addEventListener('click', () => (this._guiding ? this._endGuide(true) : this.closeChat()));
      this._dock.addEventListener('click', () => this._bringBack());
      this._prev.addEventListener('click', () => this._tourAct('back'));
      this._next.addEventListener('click', () => this._tourAct('next'));
      this._bubble.addEventListener('pointerenter', () => { this._bubbleHover = true; });
      this._bubble.addEventListener('pointerleave', () => { this._bubbleHover = false; if (this._chat) this._armIdle(this._readMs); });
      this._bubble.addEventListener('click', () => { if (!this._chat && !this._guiding && this._hintUntil > now()) this.openChat({ quiz: this._hintQuiz }); });
      this._form.addEventListener('submit', e => { e.preventDefault(); this.ask(this._input.value); });
      this._input.addEventListener('input', () => { const q = this._input.value; if (q.trim()) this._showResults(q); else this._showHome(false); });
      this._back.addEventListener('click', () => this._goBack());
      this._more.addEventListener('click', () => { this._moreOpen = !this._moreOpen; this._renderQuestions(); this._placeBubble(); });
      // Anything done in the chat keeps it open (and brings it back if it had started to fade).
      const stir = () => { if (!this._chat) return; clearTimeout(this._fadeT); this._bubble.classList.remove('fading'); this._armIdle(this._readMs); };
      for (const ev of ['pointermove', 'pointerdown', 'keydown', 'focusin', 'input', 'wheel', 'touchstart']) this._bubble.addEventListener(ev, stir, { passive: true });
      this._bubble.addEventListener('keydown', e => {
        if (e.key === 'Escape') { if (this._guiding) this._endGuide(true); else this.closeChat(true); }
        else if (this._tourRes && e.key === 'ArrowRight') this._tourAct('next');
        else if (this._tourRes && e.key === 'ArrowLeft' && !this._prev.hidden) this._tourAct('back');
      });
    }

    get bubble() { return this.getAttribute('bubble') || 'left'; }
    set bubble(v) { if (v == null || v === '') this.removeAttribute('bubble'); else this.setAttribute('bubble', v); }
    get look() { return this.getAttribute('look') || 'cursor'; }
    set look(v) { if (v == null || v === '') this.removeAttribute('look'); else this.setAttribute('look', v); }
    attributeChangedCallback() { this._placeBubble(); }

    connectedCallback() {
      for (const p of ['bubble', 'look']) if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
      addEventListener('pointermove', this._onMove, { passive: true });
      addEventListener('scroll', this._onScroll, { passive: true });
      addEventListener('resize', this._onResize);
      for (const ev of ['keydown', 'pointerdown', 'wheel', 'touchstart']) addEventListener(ev, this._onAct, { passive: true });
      document.addEventListener('mouseout', this._onOut);
      document.addEventListener('pointerdown', this._onDocDown, true);
      document.addEventListener('pointerdown', this._onRage, true);
      addEventListener('robot:moment', this._onMoment);
      Object.assign(this, { _lastAct: now(), _pageStart: now(), _path: location.pathname, _tipsHere: 0 });
      clearInterval(this._tickTimer); this._tickTimer = setInterval(() => this._tick(), 1000);
      // A menu of the site's bar opening or closing over Ixia (see _menuCheck), heard at once.
      this._menuObs = this._menuObs || new MutationObserver(() => this._menuCheck());
      this._menuObs.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });
      if (this._started) return this._kick();
      this._started = true;
      // Out of sight, past the window's edge, until its entrance places it: it is never seen in its corner first.
      this._setOff((this.clientWidth || 240) + 60, -50);
      // When the opening intro lifts (the dark opens on the page): Ixia comes in a moment after.
      addEventListener('mlh:intro-lift', () => { this._liftAt = now(); });
      this._visibleAt = document.hidden ? 0 : now();
      // What the page told of before this script ran (a search that opened with no results, say), kept for its arrival.
      const kept = window.__robotMoments;
      if (Array.isArray(kept)) { this._queue = kept.filter(m => m && typeof m === 'object').slice(-6); kept.length = 0; }
      // Reduced motion, followed as the reader changes it: switched on, whatever moves now stops where it is going.
      const calm = matchMedia('(prefers-reduced-motion: reduce)');
      this._calm = calm.matches;
      const onCalm = e => {
        this._calm = e.matches;
        if (!e.matches) return;
        this.stopGesture();
        if (this._fly) this._stopFly(this._fly.to);
        this._settledAt = 0;
      };
      if (calm.addEventListener) calm.addEventListener('change', onCalm); else if (calm.addListener) calm.addListener(onCalm);
      this._narrow = matchMedia('(max-width: 640px)');
      this._fine = matchMedia('(hover: hover) and (pointer: fine)');
      // A phone or a tablet: drawn lighter and kept calmer (see HAND, _makeRenderer and _loop).
      this._hand = matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)');
      // Out from the first visit until the reader hides it (for the rest of that visit); only then does the icon show.
      // Its entrance waits for the intro, configuration and 3D to be ready (see _init).
      if (this._isPrivate()) this._setMode('away');
      else if (this._sess().hidden) this._setMode('hidden');
      this._init();
    }
    disconnectedCallback() {
      this._finishDrag(null, true);
      removeEventListener('pointermove', this._onMove); removeEventListener('scroll', this._onScroll); removeEventListener('resize', this._onResize);
      for (const ev of ['keydown', 'pointerdown', 'wheel', 'touchstart']) removeEventListener(ev, this._onAct);
      document.removeEventListener('mouseout', this._onOut);
      document.removeEventListener('pointerdown', this._onDocDown, true);
      document.removeEventListener('pointerdown', this._onRage, true);
      removeEventListener('robot:moment', this._onMoment);
      if (this._menuObs) this._menuObs.disconnect();
      clearInterval(this._tickTimer); cancelAnimationFrame(this._raf); this._raf = 0; this._ring(null); cancelAnimationFrame(this._ringRaf);
      for (const k of ['_settleT', '_idleT', '_fadeT', '_clickT', '_greetT', '_popT', '_showT', '_stillT', '_visitT', '_finalT', '_nameT']) clearTimeout(this[k]);
      for (const id of this._timers) clearTimeout(id);
      this._timers.clear();
      if (this._stillObs) { this._stillObs.forEach(o => o.disconnect()); this._stillObs = null; }
      this._popping = this._visiting = false;
    }

    // ---------- public API ----------
    configure(cfg) {
      const was = this._cfg || {};
      this._cfg = Object.assign({}, this._cfg, cfg || {});
      // Someone signed in or out: a line still being said was written for the reader before (their name, their
      // courses), so it stops at once rather than finishing over the next page.
      if (!this._chat && (was.audience !== this._cfg.audience || was.firstName !== this._cfg.firstName) && this._bubble.classList.contains('show')) this.hush();
      const name = this._cfg.name || 'Ixia';
      this._hit.setAttribute('aria-label', 'Ask ' + name + ', the website guide');
      this._labelDock();
      this._dock.lastElementChild.textContent = name;
      if (this._chat) { if (this._view === 'home') this._showHome(false); else if (this._view === 'results') this._showResults(this._input.value); }
      // A new page in the app (the page tells Ixia here first; _tick checks too): what was said for the last one goes.
      if (this._started) this._pageChanged();
      this._checkAway();
      if (this._cfg.audience) this._configuredNow();
      // Signed in or out without leaving the page for the sign-in page: a wave, or a welcome by name.
      if (this._started && was.audience && this._cfg.audience && was.audience !== this._cfg.audience) this._audienceChanged();
      // A greeting that was waiting for its lines (and for who is looking) goes ahead now.
      if (this._greetPending && this._hasGreetings()) this._greetSoon(0.25);
      return this;
    }

    say(text, opts = {}) {
      text = this._fill(String(text == null ? '' : text));
      this._endSay(false);
      const token = ++this._token;
      this._dots.hidden = true;
      if (!this._chat) {
        this._links.hidden = this._chips.hidden = this._list.hidden = this._more.hidden = this._cta.hidden = true;
        // `hint`: a click on the line (or on Ixia) opens the chat, for as long as the line shows.
        if (opts.hint) { this._bubble.classList.add('hint'); this._hintUntil = Infinity; } else if (this._bubble.classList.contains('hint')) this._unhint();
      }
      this._typed.textContent = ''; this._rest.textContent = text; this._sr.textContent = text;
      this._bubble.classList.toggle('covered', !!this._menuOver && !this._chat);
      this._fitBubble();
      this._chooseSide();
      this._bubble.classList.add('show');
      this._placeBubble();
      if (opts.style && !this._calm) this._landIn(opts.style);
      if (opts.gesture) this.gesture(opts.gesture, opts);
      if (opts.face) this.face(opts.face, opts.faceFor || 2);
      const cps = opts.speed || 40;
      return new Promise(resolve => {
        this._sayDone = resolve;
        const finish = () => {
          this._talking = false; this._saidAt = now();
          let hold = opts.hold != null ? opts.hold : Math.max(2800, text.length * 50 + 1800);
          // Peeking from the corner, the bubble sits over the page: a passing remark stays only briefly.
          if (opts.hold == null && !this._chat && this._home && this._home.peek) hold = Math.min(hold, 3200);
          // (Under an open menu the line waits: its time starts when the menu closes, see _menuCheck.)
          this._heldFor = hold;
          if (isFinite(hold) && !this._bubble.classList.contains('covered')) this._hideT = setTimeout(() => { if (token === this._token) this.hush(); }, hold);
          const d = this._sayDone; this._sayDone = null; if (d) d(true);
        };
        if (this._calm || !text) { this._typed.textContent = text; this._rest.textContent = ''; return finish(); }
        let i = 0;
        const step = () => {
          if (token !== this._token) return;
          i++;
          this._typed.textContent = text.slice(0, i); this._rest.textContent = text.slice(i);
          if (i >= text.length) return finish();
          const ch = text[i - 1], pause = /[.!?…]/.test(ch) ? 280 : /[,;:—]/.test(ch) ? 150 : 0;
          this._talking = !pause; this._kick();
          this._typeT = setTimeout(step, 1000 / cps + pause);
        };
        step();
      });
    }
    hush() {
      if (this._bubble.classList.contains('hint')) this._unhint();
      this._token++; this._endSay(false); this._talking = false; this._lineSide = null; if (!this._chat) this._bubble.classList.remove('show', 'hint', 'covered');
    }
    /**
     * A menu of the site's bar opened or closed. The bar sits above Ixia, so nothing is said under an open menu: a line
     * already showing is hidden until the menu closes, then shows again for its reading time; nothing new starts
     * meanwhile (see _tick, _tryGreet and _offerHint). The chat sits above the bar and is left as it is.
     */
    _menuCheck() {
      const open = !!document.querySelector(MENU_OPEN), b = this._bubble;
      if (open === !!this._menuOver) return;
      this._menuOver = open;
      if (open) {
        this._holdActs(1.5, 2.5);
        if (!this._chat && b.classList.contains('show')) { clearTimeout(this._hideT); b.classList.add('covered'); }
        return;
      }
      if (!b.classList.contains('covered')) return;
      b.classList.remove('covered');
      const token = this._token;
      // Still being typed, it sets its own time when it ends.
      if (!this._sayDone && isFinite(this._heldFor)) this._hideT = setTimeout(() => { if (token === this._token) this.hush(); }, Math.max(2600, this._heldFor || 0));
    }
    /** A line that opened the chat when clicked goes: a click already on its way still counts for a moment. */
    _unhint() {
      this._bubble.classList.remove('hint');
      if (this._hintUntil > now() + 1.5) this._hintUntil = now() + 1.5;
    }
    /** Sizes a remark's bubble to its text as wrapped, so a short last line leaves no empty band beside it. */
    _fitBubble() {
      const b = this._bubble;
      b.style.removeProperty('width');
      if (b.classList.contains('chat') || b.classList.contains('touring')) return;
      const r = document.createRange();
      r.selectNodeContents(this._msg.firstElementChild);
      let max = 0;
      for (const rect of r.getClientRects()) max = Math.max(max, rect.width);
      if (max <= 0) return;
      const cs = getComputedStyle(b), pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      b.style.width = Math.ceil(max + pad + 2) + 'px';
    }
    /**
     * The side a remark is said from: of those that fit in the window, the one whose bubble covers least of the page
     * (anything to click or read under it), the usual side first when two are equal.
     */
    _chooseSide() {
      this._lineSide = null;
      if (!this._px || this._chat || this._guiding || this._fly) return;
      const b = this._bubble, host = this._stage.getBoundingClientRect(), vw = document.documentElement.clientWidth || innerWidth;
      const bw = b.offsetWidth, bh = b.offsetHeight, L = this._px(-250, 450), R = this._px(250, 450), T = this._px(0, 600);
      const boxes = {
        left: { x: host.left + L.x - 8 - bw, y: host.top + L.y - bh },
        right: { x: host.left + R.x + 8, y: host.top + R.y - bh },
        top: { x: clamp(host.left + T.x - bw / 2, 8, vw - bw - 8), y: host.top + T.y - bh - 10 },
      };
      const order = [this.bubble, this.bubble === 'left' ? 'right' : 'left', 'top'];
      // What Ixia keeps clear of (the hub animation's brand) its bubble keeps clear of too.
      const avoid = [...document.querySelectorAll(AVOID)].map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
      let best = null, least = Infinity;
      for (const side of order) {
        const o = boxes[side];
        if (!o || o.x < 8 || o.x + bw > vw - 8 || o.y < 8) continue;
        let score = 0;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
          const x = o.x + bw * (0.12 + 0.25 * i), y = o.y + bh * (0.18 + 0.32 * j);
          score += avoid.some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) ? 1 : this._weigh(x, y);
        }
        if (score < least) { least = score; best = side; }
        if (!score) break;
      }
      this._lineSide = best;
    }
    /** How a line lands in the bubble: popped in, jolted, tilted, dropped or swung. */
    _landIn(style) {
      const K = {
        pop: [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
        jolt: [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px) rotate(-2deg)' }, { transform: 'translateX(5px) rotate(2deg)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
        tilt: [{ transform: 'rotate(-6deg) scale(.9)', opacity: 0 }, { transform: 'rotate(3deg) scale(1.03)', opacity: 1, offset: 0.55 }, { transform: 'rotate(0) scale(1)', opacity: 1 }],
        drop: [{ transform: 'translateY(-14px)', opacity: 0 }, { transform: 'translateY(3px)', opacity: 1, offset: 0.6 }, { transform: 'translateY(0)', opacity: 1 }],
        swing: [{ transform: 'rotate(4deg)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(2deg)' }, { transform: 'rotate(0)' }],
      }[style];
      if (K) this._msg.animate(K, { duration: style === 'jolt' ? 420 : 540, easing: 'cubic-bezier(.2, .8, .3, 1)' });
    }

    gesture(name, opts = {}) {
      const def = GESTURES[name];
      if (!def) return Promise.resolve(false);
      return this.ready.then(() => new Promise(res => {
        if (!this._rig || this._calm) return res(false);
        const t = now();
        this._gestures.forEach(g => { if (!g.kill) g.kill = t; });
        this._gestures.push({ name, def, D: opts.dur || def.dur, o: this._opts(name, opts), start: t, res });
        this._kick();
      }));
    }
    stopGesture(name) { const t = now(); this._gestures.forEach(g => { if ((!name || g.name === name) && !g.kill) g.kill = t; }); }

    /** Shows a face for a while (seconds), swapping it in with a blink, then goes back to the usual one. */
    face(name, seconds) {
      if (!FACES[name]) return this;
      this._faceName = name;
      this._faceUntil = name === 'neutral' ? Infinity : now() + (seconds == null ? 2 : seconds);
      if (name !== this._faceShown && this._faceSwap < 0) { this._faceSwap = now(); this._kick(); }
      return this;
    }

    /** Small drawings that rise from Ixia's head: hearts, sparkles, stars, notes, a bulb, z's or a burst of confetti. */
    emote(kind, count, delay = 0) {
      const def = EMOTES[kind];
      if (!def || this._mode === 'hidden' || this._calm) return;
      const n = Math.max(1, Math.min(14, count || def.n));
      setTimeout(() => {
        for (let i = 0; i < n; i++) {
          const el = document.createElement('span');
          el.className = 'emote' + (def.burst ? ' bit' : '');
          if (def.burst) {
            const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), d = rand(50, 110);
            el.style.background = choice(CONFETTI);
            for (const [k, v] of Object.entries({ '--dx': (Math.cos(a) * d).toFixed(0) + 'px', '--dy': (Math.sin(a) * d).toFixed(0) + 'px',
              '--r': rand(-260, 260).toFixed(0) + 'deg', '--dur': rand(0.9, 1.4).toFixed(2) + 's', '--delay': (i * 0.03).toFixed(2) + 's' })) {
              el.style.setProperty(k, v);
            }
          } else {
            el.innerHTML = def.svg;
            const spread = kind === 'zzz' ? 10 : 34;
            for (const [k, v] of Object.entries({ '--dx': rand(-spread, spread).toFixed(0) + 'px', '--dy': rand(-90, -60).toFixed(0) + 'px', '--r': rand(-25, 25).toFixed(0) + 'deg',
              '--s': (kind === 'zzz' ? 0.75 + i * 0.25 : rand(0.75, 1.15)).toFixed(2), '--dur': rand(1.5, 2).toFixed(2) + 's', '--delay': (i * (kind === 'zzz' ? 0.45 : 0.16)).toFixed(2) + 's' })) {
              el.style.setProperty(k, v);
            }
          }
          el.addEventListener('animationend', () => el.remove(), { once: true });
          this._emotes.appendChild(el);
          setTimeout(() => el.remove(), 4000);
        }
      }, delay * 1000);
    }

    async guide(target, text, opts = {}) {
      await this.ready;
      const el = typeof target === 'string' ? pick(target) : target;
      if (!el || !this._rig) return this.say(String(text || ''), opts);
      return this.tour([{ target: el, say: text }], opts);
    }

    // One stop per step: reveal, fly over (talking on the way), spotlight and point, then wait for Back / Next / Done.
    async tour(steps, opts = {}) {
      steps = [].concat(steps || []).map(x => (typeof x === 'string' ? { say: x } : x)).filter(x => x && (x.target || x.say));
      if (!steps.length) return false;
      await this.ready;
      if (this._away || this._isPrivate()) return false;
      if (this._mode === 'hidden' && !this._down) this._restore('quiet');
      if (this._chat) this.closeChat();
      if (this._guiding) this._endGuide(false);
      clearTimeout(this._guideWait); this._ring(null); this.stopGesture('point');
      const token = ++this._guideToken, L = this._labels();
      // A tour belongs to its page: leaving the page ends it (see _pageChanged).
      this._guidePath = location.pathname;
      this.style.zIndex = '2147483000';
      this._sessSet({ lastTip: Date.now() });
      this._wake();
      let i = 0;
      for (;;) {
        const act = await this._showStep(steps[i], i, steps.length, token, opts);
        if (token !== this._guideToken) return false;
        if (act === 'back') { i = Math.max(0, i - 1); continue; }
        if (act === 'next' && i < steps.length - 1) { i++; continue; }
        break;
      }
      if (steps.length > 1) {
        this._tourEl.hidden = true; this._ring(null); this.stopGesture('point');
        if (!this._calm) { this.gesture('celebrate'); this.face('star', 2); this.emote('confetti', 12); }
        await this.say(L.done, { hold: Infinity });
        await sleep(1300);
        if (token !== this._guideToken) return false;
      }
      this._endGuide(true);
      return true;
    }

    // A tip never scrolls the page or holds it up with a tour: it points at what it is about, which is in view, and an
    // important one marks it for a moment.
    tip(tip) {
      if (typeof tip === 'string') tip = { text: tip };
      this.dispatchEvent(new CustomEvent('robot-tip', { bubbles: true, composed: true, detail: tip }));
      const el = tip.target && pick(tip.target);
      if (el && inView(el)) {
        if (tip.important && !this._calm) this._ring(el);
        return this.say(tip.text, { gesture: 'point', at: el });
      }
      return this.say(tip.text, { gesture: tip.gesture || 'nod', face: 'happy' });
    }

    openChat(opts = {}) {
      if (this._away || this._isPrivate()) return;
      // Sent away, Ixia comes out of its corner button first; when it cannot be drawn, the chat opens from the button.
      if (this._mode === 'hidden' && !this._down) return this._restore('dock', true);
      if (this._chat) return this._input.focus();
      if (this._opening) return;
      if (this._guiding) this._endGuide(true);
      // The chat opens from the bottom corner of the side Ixia rests on, where it has the whole height of the window.
      const c = this._chatSpot();
      const dist = Math.hypot(this._off.x - c.x, this._off.y - c.y);
      if (this._mode === 'idle' && this._rig && !this._calm && (this._fly || dist > 2)) {
        this._opening = true;
        this._hintUntil = 0; this.hush();
        this._home = c; this._arrivedAt = now();
        this._flyTo(c.x, c.y, false, { dur: clamp(0.45 + dist / 900, 0.5, 0.95) }).then(() => {
          this._opening = false;
          if (this._mode === 'idle' && !this._chat) this._openChatNow(opts);
        });
        return;
      }
      if (this._mode === 'idle' || this._mode === 'hidden') this._home = c;
      this._openChatNow(opts);
    }
    /** The chat itself, opened where Ixia is. */
    _openChatNow(opts = {}) {
      this._bubble.classList.remove('covered');
      clearTimeout(this._unchatT);
      if (this._bubble.classList.contains('show') && !this._bubble.classList.contains('chat')) this._snapBubbleOut();
      this._chat = true; this._chatPokes = 0; this._engage(); this._wake();
      this._hintUntil = 0; this._bubble.classList.remove('hint');
      this.style.zIndex = '2147483000'; // an open chat sits above the page's own bars
      this._sessSet({ lastTip: Date.now() }); // using Ixia counts as a tip: the next one waits minGap
      this._token++; this._endSay(false);
      this._bubble.style.removeProperty('width'); this._lineSide = null;
      this._bubble.classList.add('chat', 'show');
      this._bubble.setAttribute('role', 'dialog');
      this._bubble.setAttribute('aria-label', (this._cfg.name || 'Ixia') + ', the website guide');
      this._hit.setAttribute('aria-expanded', 'true');
      this._x.hidden = false; this._form.hidden = false;
      this._input.value = '';
      this._input.placeholder = this._cfg.placeholder || 'Type your question';
      this._moreOpen = false;
      this._bubble.classList.remove('fading');
      // A different opening each time the chat opens (the same one after Back). Opened before Ixia has said hello in
      // this visit (clicked as it arrived), the chat says it first, and that counts as the greeting.
      this._intro = pickLine(this._cfg.chatIntros, this._recentIntro, 2) || this._cfg.chatIntro;
      if (this._greetPending || (this._greetDue() && this._hasGreetings())) {
        const hello = this._met() ? 'Welcome back, {name}.' : `Hello, I am ${this._cfg.name || 'Ixia'}, your guide.`;
        this._intro = hello + ' ' + (this._intro || 'How may I help you today?');
        this._markGreeted(null);
      }
      if (opts.quiz && this._hasQuiz()) this._startQuiz();
      else if (!opts.offer) this._showHome(true);
      this._placeBubble();
      // On a touch screen the keyboard would cover the questions, so the field waits to be selected.
      if (opts.keyboard || (this._fine && this._fine.matches)) setTimeout(() => this._input.focus({ preventScroll: true }), 80);
      this.face('happy', 1.6); this.gesture('nod');
    }
    closeChat(refocus) {
      if (!this._chat) return;
      this._chat = false;
      clearTimeout(this._idleT); clearTimeout(this._fadeT);
      if (!this._guiding) this.style.removeProperty('z-index');
      this._token++; this._endSay(false); this._talking = false; this.stopGesture('think');
      this._bubble.classList.remove('show');
      this._bubble.removeAttribute('role'); this._bubble.removeAttribute('aria-label');
      this._hit.setAttribute('aria-expanded', 'false');
      this._view = null;
      // The chat fades out whole: its parts are put away only once it has gone, so it never shrinks as it fades.
      clearTimeout(this._unchatT);
      this._unchatT = setTimeout(() => {
        if (this._chat) return;
        this._x.hidden = this._form.hidden = this._chips.hidden = this._links.hidden = this._dots.hidden = this._cta.hidden = true;
        this._list.hidden = this._more.hidden = this._back.hidden = this._asked.hidden = true;
        this._bubble.classList.remove('chat', 'answer', 'fading');
      }, 460);
      if (refocus) this._hit.focus({ preventScroll: true });
      this._holdActs(5, 9);
      // It stays in the corner the chat opened from, and checks a little later whether that covers the page.
      this._settledAt = now();
    }
    /** Takes a line off at once, with no fade (so a chat opening in its place never grows out of it). */
    _snapBubbleOut() {
      const b = this._bubble;
      b.style.transition = 'none';
      b.classList.remove('show', 'hint');
      void b.offsetWidth;
      b.style.removeProperty('transition');
    }

    async ask(q) {
      q = String(q || '').trim().slice(0, 300);
      if (!q) return;
      if (!this._chat) {
        this.openChat();
        // Away from its corner, the chat opens once Ixia has glided there: the answer waits for it.
        for (let i = 0; i < 40 && !this._chat && this._opening; i++) await sleep(60);
      }
      // Only a question it is sure of is answered outright; otherwise the closest questions, or an honest no.
      const v = this._judge(q);
      if (v.kind === 'answer') return this._answerFaq(v.item);
      if (v.kind === 'local') return this._answerLocal(q, v.res);
      this._showUnsure(q, v.kind === 'closest' ? v.items : [], v.kind === 'short');
    }

    // ---------- conversation internals ----------
    /** Fills {name} with the person's first name, dropping the comma before it when there is none. */
    _fill(text) {
      const first = String(this._cfg.firstName || '').trim();
      text = first ? text.replace(/\{name\}/g, first) : text.replace(/,?\s*\{name\}/g, '');
      // On a touch screen it is a tap, not a click.
      if (this._touch()) text = text.replace(/\b([Cc])lick(ing|ed|s)?\b/g, (m, c, end) => (c === 'C' ? 'T' : 't') + 'ap' + (end === 'ing' ? 'ping' : end === 'ed' ? 'ped' : end || ''));
      // The site's name never breaks across two lines.
      return text.replace(/myt learning hub/g, 'myt\u00a0learning\u00a0hub');
    }
    _touch() { return !(this._fine && this._fine.matches) && matchMedia('(pointer: coarse)').matches; }
    /** The chat fades away after a spell with nothing done in it; `extra` gives an answer time to be read. */
    _armIdle(extra = 0) {
      clearTimeout(this._idleT);
      if (this._chat) this._idleT = setTimeout(() => this._idleClose(), CHAT_IDLE_MS + extra);
    }
    _idleClose() {
      if (!this._chat) return;
      const typing = this._input.value.trim() && this.shadowRoot.activeElement === this._input;
      if (this._bubbleHover || this._hover || typing || this._talking) return this._armIdle(1500);
      this._bubble.classList.add('fading');
      clearTimeout(this._fadeT);
      this._fadeT = setTimeout(() => { if (this._chat) this.closeChat(!!this.shadowRoot.activeElement); this._bubble.classList.remove('fading'); }, this._calm ? 300 : 600);
    }
    _endSay(ok) {
      clearTimeout(this._typeT); clearTimeout(this._hideT);
      const d = this._sayDone; this._sayDone = null; if (d) d(ok);
    }
    _typer(token) {
      let full = '', shown = 0, ended = false, timer = 0, resolve;
      const done = new Promise(r => (resolve = r));
      const tick = () => {
        timer = 0;
        if (token !== this._token) { this._talking = false; return resolve(false); }
        if (this._calm && shown < full.length) { shown = full.length; this._typed.textContent = full; }
        if (shown < full.length) {
          const lag = full.length - shown;
          shown = Math.min(full.length, shown + (lag > 120 ? 3 : lag > 40 ? 2 : 1));
          this._typed.textContent = full.slice(0, shown);
          const ch = full[shown - 1], pause = /[.!?…]/.test(ch) ? 220 : /[,;:]/.test(ch) ? 110 : 0;
          this._talking = !pause; this._kick();
          timer = setTimeout(tick, 1000 / 42 + pause);
        } else if (ended) { this._talking = false; resolve(true); }
        else { this._talking = false; timer = setTimeout(tick, 60); }
      };
      return { push: s => { full += s; if (!timer) tick(); }, end: () => { ended = true; if (!timer) tick(); }, done, get text() { return full; } };
    }
    _typeIn(text) {
      const ty = this._typer(this._token);
      this._typed.textContent = ''; this._rest.textContent = ''; this._sr.textContent = text;
      ty.push(text); ty.end(); return ty.done;
    }
    _setText(t) { this._token++; this._endSay(false); this._talking = false; this._typed.textContent = t; this._rest.textContent = ''; this._sr.textContent = t; }

    // Free text that matches no question: the page notes say where a thing is ("That is on the Courses page").
    /**
     * A page or a part of one that what was typed is about ("Where is the search box?"): only when most of the typed
     * words are its own and one names it, so a question about something else that shares a word ("course") is not
     * answered with a page.
     */
    _matchLocal(q) {
      const cfg = this._cfg, qw = askWords(q);
      if (!qw.length) return null;
      let best = null, bestScore = 0;
      for (const p of cfg.pages || []) {
        const entries = [{ p, label: p.title, text: [p.title, p.about].join(' ') }]
          .concat((p.elements || []).map(e => ({ p, e, label: e.label, text: [e.label, e.about, p.title].join(' ') })));
        for (const en of entries) {
          const all = new Set(words(en.text)), lab = new Set(words(en.label));
          let s = 0, named = false;
          for (const w of qw) {
            if (nearest(w, lab) >= 0.75) { s += 1; named = true; } else if (nearest(w, all) >= 0.75) s += 0.6;
          }
          // A part of a page wins a tie with the page itself: it is the more exact answer.
          const score = named ? s / qw.length + (en.e ? 0.01 : 0) : 0;
          if (score > bestScore) { bestScore = score; best = en; }
        }
      }
      if (!best || bestScore < 0.7) return null;
      const { p, e } = best, here = !p.path || (matchPath(p.path, location.pathname) && !p.path.endsWith('*'));
      if (p.path && p.path.includes('*') && !here) return null;
      if (e) return {
        text: e.answer || (here ? `The ${e.label} is on this page.` : `The ${e.label} is on the ${p.title} page.`),
        links: [{ label: here ? 'Show me' : 'Take me there', href: p.path, target: e.selector, say: e.say || `This is the ${e.label}.` }],
      };
      return { text: p.about ? `${p.title}: ${p.about}` : `That is on the ${p.title} page.`, links: here ? [] : [{ label: 'Take me there', href: p.path }] };
    }
    async _answerLocal(q, res) {
      this._view = 'answer';
      this._bubble.classList.add('answer');
      this._list.hidden = this._more.hidden = this._cta.hidden = this._links.hidden = this._chips.hidden = true;
      this._links.innerHTML = ''; this._input.value = '';
      this._asked.textContent = q.endsWith('?') ? q : q + '?'; this._asked.hidden = false;
      this._backLabel.textContent = this._labels().questions; this._back.hidden = false;
      const token = ++this._token;
      this._typed.textContent = ''; this._rest.textContent = ''; this._sr.textContent = res.text;
      this._placeBubble();
      clearTimeout(this._idleT);
      const ty = this._typer(token); ty.push(res.text); ty.end();
      this.gesture('nod');
      await ty.done;
      if (token !== this._token) return;
      this._renderLinks(res.links);
      this._placeBubble();
      this._readMs = clamp(res.text.length * 35, 0, 12000); this._armIdle(this._readMs);
    }
    /** A link as it suits the page now: the first of its `variants` whose `when` / `unless` hold, laid over it. */
    _resolve(l) {
      const v = (l.variants || []).find(meets);
      if (!v) return l;
      const out = Object.assign({}, l, v);
      delete out.variants; delete out.when; delete out.unless;
      if (!v.label) delete out.label;
      if (v.target && !v.steps) delete out.steps;
      return out;
    }
    _renderLinks(links) {
      this._links.innerHTML = '';
      (links || []).map(l => this._resolve(l)).slice(0, 3).forEach(l => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = l.label || (!l.href || samePath(l.href) ? 'Show me' : 'Take me there');
        b.addEventListener('click', () => this._follow(l));
        this._links.appendChild(b);
      });
      this._links.hidden = !this._links.children.length;
    }
    _go(href) {
      if (typeof this.navigate === 'function') { this.closeChat(); this.navigate(href); }
      else location.assign(href);
    }
    _follow(l) {
      const here = !l.href || samePath(l.href), title = this._asked.hidden ? '' : this._asked.textContent;
      const steps = Array.isArray(l.steps) && l.steps.length ? l.steps : l.target ? [{ target: l.target, say: l.say || 'Here it is.' }] : null;
      if (here && steps) { this.closeChat(); this.tour(steps, { title }); return; }
      if (!l.href) return;
      // To a private page Ixia only takes the reader there: it does not stay to show anything on it.
      const dest = new URL(l.href, location.href).pathname;
      if (steps && !this._isPrivate(dest)) { try { sessionStorage.setItem(K_PENDING, JSON.stringify({ path: dest, steps, title })); } catch (e) {} }
      this._go(l.href);
      if (typeof this.navigate === 'function') this._awaitPending();
    }
    async _awaitPending() {
      try { await this._pendingLoop(); } finally { try { sessionStorage.removeItem(K_PENDING); } catch (e) { /* storage unavailable */ } }
    }
    async _pendingLoop() {
      for (let i = 0; i < 50; i++) {
        await sleep(150);
        let p = null;
        try { p = JSON.parse(sessionStorage.getItem(K_PENDING) || 'null'); } catch (e) { return; }
        if (!p) return;
        const first = p.steps ? p.steps[0].target : p.target;
        if (p.path === location.pathname && (!first || pick(first))) {
          try { sessionStorage.removeItem(K_PENDING); } catch (e) {}
          await sleep(350);
          return this.tour(p.steps || [{ target: p.target, say: p.text }], { title: p.title });
        }
      }
    }

    // ---------- the chat: a short list of the most useful questions, and search over all of them ----------
    _labels() {
      return Object.assign({ next: 'Next', back: 'Back', finish: 'Done', gotIt: 'Done', step: '{n} of {total}',
        done: 'That concludes the tour.', travel: ['This way.', 'Allow me.', 'Right this way.', 'Over here.', 'Follow me.'], related: 'Related questions',
        viewMore: 'View more', viewLess: 'View less', questions: 'All questions', results: 'Matching questions',
        closest: 'I do not have an exact answer to that. These questions come closest.',
        noAnswer: 'I do not have an answer to that yet. The team can help through the contact page.',
        tooShort: 'Please add a few words about what you are looking for. These questions may help.', contact: 'Contact us' }, this._cfg.labels);
    }
    /** Whether a question is about this page; every-page questions ("*", "/*") do not count. */
    _isHere(item) { return [].concat(item.paths || []).some(p => p !== '*' && p !== '/*' && matchPath(p, location.pathname)); }
    /** Up to ten questions: two about this page first, then the most useful ones for this person, then any others. */
    _featured() {
      const faq = this._cfg.faq || [], byId = new Map(faq.map(f => [f.id, f])), out = [];
      const add = it => { if (it && !out.includes(it) && out.length < 10) out.push(it); };
      faq.filter(it => this._isHere(it) && meets(it)).slice(0, 2).forEach(add);
      (this._cfg.featured || []).forEach(id => { const it = byId.get(id); if (meets(it)) add(it); });
      faq.filter(meets).forEach(add);
      return out;
    }
    /** Each question's words (its own, its keywords, its answer) and how many questions use each word, kept per config. */
    _faqIndex() {
      const faq = this._cfg.faq || [];
      if (this._index && this._index.faq === faq) return this._index;
      // A question's own words and keywords keep the common ones (weighed as such), for questions typed in them.
      const items = faq.map((item, i) => ({ item, i, q: new Set(allWords(item.q)), k: new Set(allWords(item.keywords)), a: new Set(words(item.a)) }));
      const uses = new Map();
      for (const it of items) for (const w of new Set([...it.q, ...it.k])) uses.set(w, (uses.get(w) || 0) + 1);
      return (this._index = { faq, items, uses });
    }
    /**
     * The questions shown here ranked against the typed words: each word weighs by how few questions use it, so
     * "certificate" decides more than "course". `cover` is the share of the typed weight a question answers (its answer
     * counting for less than its own words), `own` the share of the question's own words that were typed, common ones
     * included (`plain`; weighed the same way, so "How do I enrol?" is most of "How do I enrol on a course?"), `keyed`
     * the same share of its keywords, `strong` how many typed words its question or keywords hold, and `rarest` the
     * weight of the rarest of those.
     */
    _rank(terms, plain = terms) {
      const { items, uses } = this._faqIndex(), n = items.length || 1;
      const rare = v => Math.log(1 + n / (1 + (uses.get(v) || 0)));
      const weight = w => { let c = 0; for (const [v, k] of uses) if (k > c && near(w, v) >= 0.75) c = k; return c ? Math.log(1 + n / (1 + c)) : UNKNOWN_WEIGHT; };
      const ws = terms.map(weight), total = ws.reduce((a, b) => a + b, 0);
      return items.filter(it => meets(it.item)).map(it => {
        let got = 0, strong = 0, rarest = 0;
        terms.forEach((w, j) => {
          const own = Math.max(nearest(w, it.q), nearest(w, it.k));
          got += ws[j] * Math.max(own, 0.45 * nearest(w, it.a));
          if (own >= 0.75) { strong++; rarest = Math.max(rarest, ws[j]); }
        });
        // The same share of its keywords, which tells apart questions that hold a typed word only there: the one with
        // fewer, closer keywords is the more likely ("sign up" is how to create an account, not one of many mentions).
        const share = (set, typed) => { let mine = 0, all = 0; for (const v of set) { const r = rare(v); all += r; if (typed.some(w => near(w, v) >= 0.75)) mine += r; } return all ? mine / all : 0; };
        const own = share(it.q, plain), keyed = share(it.k, terms);
        return { item: it.item, i: it.i, got, cover: got / total, own, keyed, strong, rarest, here: this._isHere(it.item) ? 1 : 0 };
      }).filter(x => x.strong > 0).sort((a, b) => b.cover - a.cover || b.own - a.own || b.keyed - a.keyed || b.here - a.here || a.i - b.i);
    }
    /**
     * What to do with a typed question: `answer` a premade one asked as written, or one it is sure of (most of the typed
     * weight answered, with every typed word, or two, held by it, and clearly ahead of the next: by what it answers, or
     * by how much of it was asked); `local` a page or a part of one, first for a question about where something is,
     * last when no question comes near; `closest` the questions that come near; `none` when nothing does; `short` when
     * nothing was asked but greetings or filler.
     */
    _judge(q) {
      const asked = flat(q), same = (this._cfg.faq || []).find(it => meets(it) && flat(it.q) === asked);
      if (same) return { kind: 'answer', item: same };
      const plain = plainWords(q);
      const terms = askWords(q).length ? askWords(q) : plain;
      if (!terms.length) return { kind: 'short' };
      // Where something is: a page or a part of one says it best.
      const spot = WHERE.test(q) && this._matchLocal(q);
      if (spot) return { kind: 'local', res: spot };
      const ranked = this._rank(terms, plain), [top, next] = ranked;
      const ahead = top && (!next || top.cover - next.cover >= 0.12 || top.own >= 0.6 || (top.own >= 0.4 && top.own - next.own >= 0.15));
      if (top && top.cover >= SURE && top.strong >= Math.min(2, terms.length) && ahead) return { kind: 'answer', item: top.item };
      const close = this._close(ranked);
      if (close.length) return { kind: 'closest', items: close.slice(0, 5) };
      const page = this._matchLocal(q);
      return page ? { kind: 'local', res: page } : { kind: 'none' };
    }
    /** The ranked questions near enough to offer: half of the typed weight answered, or a third with a rare word in it. */
    _close(ranked) { return ranked.filter(x => x.cover >= 0.5 || (x.cover >= 0.3 && x.rarest >= 2.5)).map(x => x.item); }
    /**
     * No answer it is sure of: the question asked, then the closest questions to choose from, or, when none comes near,
     * a plain no and the contact page.
     */
    _showUnsure(q, items, short) {
      const L = this._labels();
      this._view = 'unsure';
      this._bubble.classList.add('answer');
      this._list.hidden = this._more.hidden = this._cta.hidden = this._links.hidden = this._dots.hidden = this._chips.hidden = true;
      this._links.innerHTML = ''; this._input.value = '';
      this._asked.textContent = q.endsWith('?') ? q : q + '?'; this._asked.hidden = false;
      this._backLabel.textContent = L.questions; this._back.hidden = false;
      const offered = short ? this._featured().slice(0, 5) : items;
      this._setText(short ? L.tooShort : offered.length ? L.closest : L.noAnswer);
      this._list.innerHTML = '';
      offered.forEach((it, i) => this._list.appendChild(this._questionButton(it, i)));
      this._list.hidden = !offered.length;
      if (!offered.length) this._renderLinks([{ label: L.contact, href: '/contact' }]);
      this.face(offered.length ? 'think' : 'confused', 1.2);
      this._placeBubble();
      this._readMs = 0; this._armIdle();
    }
    _questionButton(it, i) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = it.q; b.style.setProperty('--i', i);
      b.addEventListener('click', () => this._answerFaq(it));
      return b;
    }
    _showHome(type) {
      this._view = 'home';
      this._bubble.classList.remove('answer');
      this._back.hidden = this._asked.hidden = this._links.hidden = this._chips.hidden = this._dots.hidden = this._tourEl.hidden = true;
      this._links.innerHTML = ''; this._chips.innerHTML = '';
      const intro = this._fill(this._intro || this._cfg.chatIntro || 'How may I help you today?');
      if (type) { this._token++; this._endSay(false); this._typeIn(intro); } else this._setText(intro);
      this._renderCta();
      this._renderQuestions();
      this._placeBubble();
      this._readMs = 0; this._armIdle();
    }
    _renderCta() {
      const a = this._cfg.action;
      this._cta.innerHTML = '';
      if (a && a.label && a.href && !samePath(a.href)) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = a.label;
        b.addEventListener('click', () => this._go(a.href));
        this._cta.appendChild(b);
      }
      // Revision questions, for a learner on their courses, or sample questions on a course page for a visitor.
      if (this._hasQuiz()) {
        const q = document.createElement('button');
        q.type = 'button'; q.className = 'alt'; q.textContent = this._cfg.revision.label || 'Quiz me';
        q.addEventListener('click', () => this._startQuiz());
        this._cta.appendChild(q);
      }
      this._cta.hidden = !this._cta.children.length;
    }
    _renderQuestions() {
      const items = this._featured(), L = this._labels(), shown = items.slice(0, this._moreOpen ? 10 : 5);
      this._list.innerHTML = '';
      shown.forEach((it, i) => this._list.appendChild(this._questionButton(it, this._moreOpen && i >= 5 ? i - 5 : i)));
      this._list.hidden = false;
      this._more.hidden = items.length <= 5;
      this._moreLabel.textContent = this._moreOpen ? L.viewLess : L.viewMore;
      this._more.setAttribute('aria-expanded', String(this._moreOpen));
      this._list.scrollTop = 0;
    }
    _showResults(q) {
      this._view = 'results';
      this._bubble.classList.remove('answer');
      this._back.hidden = this._asked.hidden = this._links.hidden = this._chips.hidden = this._cta.hidden = this._more.hidden = true;
      // As it is typed: a premade question written out first, then those near enough to offer (as _judge does).
      const asked = flat(q), plain = plainWords(q), terms = askWords(q).length ? askWords(q) : plain, L = this._labels();
      const same = (this._cfg.faq || []).filter(it => meets(it) && flat(it.q) === asked);
      const items = [...new Set(same.concat(terms.length ? this._close(this._rank(terms, plain)) : []))].slice(0, 8);
      this._setText(items.length ? L.results : this._cfg.noMatch || 'I could not find a match for that. Try other words, or clear the box to see the questions again.');
      this._list.innerHTML = '';
      items.forEach((it, i) => this._list.appendChild(this._questionButton(it, i)));
      this._list.hidden = !items.length;
      this._placeBubble();
      this._readMs = 0; this._armIdle();
    }
    _goBack() {
      this._input.value = '';
      this._showHome(false);
      this._input.focus({ preventScroll: true });
    }
    async _answerFaq(item) {
      this._view = 'answer';
      this._bubble.classList.add('answer');
      this._list.hidden = this._more.hidden = this._cta.hidden = this._links.hidden = this._dots.hidden = this._chips.hidden = true;
      this._links.innerHTML = ''; this._input.value = '';
      this._asked.textContent = item.q; this._asked.hidden = false;
      this._backLabel.textContent = this._labels().questions; this._back.hidden = false;
      this.dispatchEvent(new CustomEvent('robot-ask', { bubbles: true, composed: true, detail: { question: item.q, id: item.id } }));
      this._endSay(false);
      const token = ++this._token, links = item.links || [], answer = this._fill(String(item.a || ''));
      this._typed.textContent = ''; this._rest.textContent = ''; this._sr.textContent = answer;
      this._placeBubble();
      if (!this._calm && this._rig) {
        this._dots.hidden = false; this.gesture('think', { dur: 1.2 }); this.face('think', 0.9);
        await sleep(600);
        if (token !== this._token) return;
        this._dots.hidden = true; this.stopGesture('think');
      }
      clearTimeout(this._idleT);
      const ty = this._typer(token); ty.push(answer); ty.end();
      const here = links.find(l => l.target && (!l.href || samePath(l.href))), el = here && pick(here.target);
      this.gesture(el && inView(el) ? 'point' : 'nod', el ? { at: el } : {});
      this.face('happy', 1.4);
      await ty.done;
      if (token !== this._token) return;
      this._renderLinks(links);
      this._renderRelated(item);
      this._placeBubble();
      // Time to read the answer before the chat fades: about a second for every thirty characters, up to twelve more.
      this._readMs = clamp(answer.length * 35, 0, 12000); this._armIdle(this._readMs);
    }
    // Up to three more questions on the same subject, so the conversation can carry on without searching.
    _renderRelated(item) {
      const faq = this._cfg.faq || [], pool = faq.filter(it => it !== item && it.topic === item.topic && meets(it));
      const at = faq.indexOf(item), next = pool.sort((a, b) => Math.abs(faq.indexOf(a) - at) - Math.abs(faq.indexOf(b) - at)).slice(0, 3);
      this._chips.innerHTML = '';
      if (!next.length) { this._chips.hidden = true; return; }
      const head = document.createElement('span'); head.className = 'rel'; head.textContent = this._labels().related;
      this._chips.appendChild(head);
      for (const it of next) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = it.q;
        b.addEventListener('click', () => this._answerFaq(it));
        this._chips.appendChild(b);
      }
      this._chips.hidden = false;
    }

    // ---------- page effects ----------
    /** The page effects (robot-fx.js), loaded the first time they are needed. */
    _fx() {
      if (this._calm) return Promise.resolve(null);
      if (!this._fxP) {
        this._fxP = import(FX_URL).then(m => { const fx = new m.PageFx(); fx.setPage(location.pathname); return fx; })
          .catch(e => { console.warn('[robot-companion] effects', e); return null; });
      }
      return this._fxP;
    }
    /** Ixia's head in the window, where an effect starts from. */
    _headAt() {
      const c = this._canvas.getBoundingClientRect();
      return this._head ? { x: c.left + this._head.x, y: c.top + this._head.y } : { x: innerWidth - 130, y: innerHeight - 160 };
    }
    _effect(kind, opts = {}) {
      if (this._calm || this._mode === 'hidden' || this._away) return;
      this._fx().then(fx => fx && fx.play(kind, opts.at || this._headAt(), opts));
    }
    /**
     * A click answered with a show: an effect across the page with a move to go with it; then, by chance, the questions
     * open, it invites a second click, or it simply enjoys the moment.
     */
    _showOff() {
      const theme = location.pathname.startsWith('/stories') ? 'stories' : '';
      const kind = pickFresh([['sparks', 3], ['stardust', 2.2], ['comet', 1.6], ['fireworks', 1.2], ['shower', 1.6], ['hearts', theme ? 3 : 0.9], ['bubbles', 1]], this._recentFx || (this._recentFx = []), 2);
      const move = { sparks: 'cheer', stardust: 'whirl', comet: 'look', fireworks: 'celebrate', shower: 'juggle', hearts: 'love', bubbles: 'giggle' }[kind];
      this._play(move);
      // A show is a lot at once: a longer breath before anything of its own.
      this._holdActs(kind === 'fireworks' ? 5.5 : 4.5, 7);
      this._effect(kind, kind === 'stardust' ? { centre: { x: innerWidth / 2, y: innerHeight * 0.42 } } : {});
      const then = pickFresh([['chat', 4], ['invite', 3], ['enjoy', 3]], this._recentMoment, 1);
      clearTimeout(this._showT);
      this._showT = setTimeout(() => {
        if (this._mode !== 'idle' || this._chat || this._guiding) return;
        if (then === 'chat') return this.openChat();
        if (then === 'invite') {
          const invitations = this._cfg.invitations && this._cfg.invitations.length ? this._cfg.invitations : [POKE_CORE];
          this.say(pickFresh(invitations.map(l => [l, l === POKE_CORE ? 2 : 1]), this._recentInvite, Math.min(4, invitations.length - 1)), { hold: 5200, style: pickFresh(LANDINGS, this._recentLanding, 1), hint: true });
        }
      }, kind === 'fireworks' ? 2200 : 1500);
    }

    // ---------- moods ----------
    /**
     * Its energy runs down over a long visit: tired, it yawns now and then, and at last takes a short nap; waking from
     * it by itself, it is charged up again and shows it.
     */
    _mood(t) {
      if (this._calm || this._mode !== 'idle' || this._chat || this._guiding) return;
      const dt = Math.min(2, t - (this._moodAt || t)); this._moodAt = t;
      this._energy = clamp((this._energy == null ? 1 : this._energy) - dt / 540, 0, 1);
      if (this._napUntil) {
        if (!this._sleeping) { this._napUntil = 0; this._energy = Math.max(this._energy, 0.6); return; }
        if (t < this._napUntil) return;
        this._napUntil = 0; this._sleeping = false; this._energy = 1;
        this.face('excited', 2); this._play('boost'); this._effect('sparks', { amount: 0.5 });
        const lines = this._cfg.recharged || [];
        if (lines.length && Math.random() < 0.6) this._soon(() => this._mode === 'idle' && !this._chat && this.say(pickLine(lines, this._recentLine, 1), { hold: 3200 }), 900);
        this._holdActs(5, 9);
        return;
      }
      if (this._sleeping || this._bubble.classList.contains('show') || this._fly || this._gestures.length) return;
      if (this._energy < 0.18 && t - this._lastAct > 10) {
        this._sleeping = true; this.face('sleepy', Infinity); this._zAt = t; this._napUntil = t + rand(9, 15);
        return;
      }
      if (this._energy < 0.38 && t > (this._yawnAt || 0)) { this._yawnAt = t + rand(40, 70); this._play(Math.random() < 0.6 ? 'yawn' : 'tired'); }
    }
    /**
     * Once on each page, a little while after arriving, a reaction of its own to the page; on the page it says hello on,
     * a breath after the greeting has gone, never over it.
     */
    _pageGreet(t) {
      if (this._pageGreeted || this._calm || this._greetPending || this._greeting || t < (this._pageGreetAfter || 0) || this._bubble.classList.contains('show')) return;
      if (t - Math.max(this._pageStart, this._landedAt || 0) < 2.2 || t - (this._scrollAt || -1e9) < 1.2 || this._fly || this._gestures.length) return;
      this._pageGreeted = true;
      if (Math.random() < 0.12) return;
      const p = location.pathname;
      const [act, fx, amount] = p === '/' ? ['love', 'stardust', 0.35]
        : /^\/subjects\/[^/]+/.test(p) ? ['curious', 'shower', 0.35]
        : /^\/courses\/[^/]+/.test(p) ? [Math.random() < 0.5 ? 'curious' : 'think']
        : p.startsWith('/about') ? ['proud', 'sparks', 0.3]
        : p.startsWith('/stories') ? ['love', 'hearts', 0.5]
        : p.startsWith('/workshops') ? ['excited', 'sparks', 0.3]
        : p === '/terms' || p === '/code-of-conduct' ? ['peer']
        : p.endsWith('/calendar') ? ['star']
        : p === '/my-courses' ? ['proud', 'shower', 0.25] : [];
      if (!act) return;
      this._play(act);
      if (fx) this._effect(fx, fx === 'stardust' ? { amount, centre: this._headAt() } : { amount });
      // A breath after it before anything of its own (only when there was something to see).
      this._holdActs(2, 3);
    }
    /**
     * What happens on the page: a message, a form that will not go, a search with nothing in it, a quiz, a course
     * finished.
     */
    _react(m) {
      // The results came back (the empty list went): its "nothing found" line goes, whether said or still to come.
      if (m.kind === 'results') {
        this._queue = (this._queue || []).filter(x => x.kind !== 'no-results');
        // Not yet said (the list filled again within a moment, or React mounted the page twice in development): the
        // next empty list may still have its line.
        if (this._noneT) { clearTimeout(this._noneT); this._timers.delete(this._noneT); this._noneT = 0; if (this._reactAt) this._reactAt.none = -1e9; }
        if (this._noneLine === this._token && !this._chat) this.hush();
        return;
      }
      if (this._away) return;
      // Not before it has arrived (nothing of it shows until its entrance, or until it is back from a private page):
      // kept, and played once it has landed.
      if (this._mode === 'off' || this._mode === 'entering' || this._mode === 'away') { this._queue = (this._queue || []).concat(m).slice(-6); return; }
      // Sent away (or no 3D here, the corner button standing in): a course finished, an enrolment or a final quiz passed
      // is kept for when Ixia is brought back, and the button glows meanwhile.
      if (this._mode === 'hidden') {
        if (m.kind === 'course-completed' || m.kind === 'enrolled' || m.kind === 'registered' || (m.kind === 'quiz-result' && m.passed && m.final)) {
          if (!(this._missed && this._missed.kind === 'course-completed' && m.kind === 'quiz-result')) this._missed = m;
          this._dock.classList.add('news');
        }
        return;
      }
      // (Under reduced motion it still helps and offers: only the gestures and the page effects are left out.)
      const t = now(), last = this._reactAt || (this._reactAt = {});
      const quiet = (k, gap) => { if (t - (last[k] || -1e9) < gap) return true; last[k] = t; return false; };
      const free = this._mode === 'idle' && !this._chat && !this._guiding;
      // Reacting to the page: a breath before anything of its own.
      this._holdActs(3.5, 6);
      if (m.kind === 'course-completed') { clearTimeout(this._finalT); this._finalT = 0; return this._celebrate(m); }
      if (m.kind === 'quiz-result') {
        if (m.passed && m.final) {
          // A final quiz passed comes with the course completed, which has the bigger show: a moment's wait for it, so the
          // two never go off together.
          clearTimeout(this._finalT);
          this._finalT = setTimeout(() => { this._finalT = 0; if (this._mode === 'idle') { this._play('cheer'); this._effect('fireworks', { amount: 1 }); } }, 320);
          return;
        }
        if (m.passed) { this._play(pickFresh([['clap', 1], ['star', 1], ['flip', 0.6]], this._recentIdle, 1)); this._effect('sparks', { amount: 0.5 }); return; }
        this._play('sad');
        if (free && !quiet('quiz', 30)) this._soon(() => this._offerHint(this._line('quizFailed', 'Not passed this time. Review the recordings, then try again.'), true), 1600);
        return;
      }
      if (m.kind === 'enrolled' || m.kind === 'registered') { this._play('cheer'); this._effect('confetti', { amount: 0.6 }); return; }
      if (m.kind === 'success') { if (!quiet('success', 8) && Math.random() < 0.7) { this._play(pickFresh([['clap', 1], ['nod', 1], ['star', 1]], this._recentIdle, 1)); if (Math.random() < 0.4) this._effect('sparks', { amount: 0.25 }); } return; }
      if (m.kind === 'error') {
        if (quiet('error', 6)) return;
        this._play('sad');
        this._errors = (this._errors || []).filter(x => t - x < 60).concat(t);
        if (this._errors.length >= 2) this._struggle('errors');
        return;
      }
      if (m.kind === 'form-invalid') {
        this._invalid = (this._invalid || []).filter(x => t - x < 90).concat(t);
        if (this._invalid.length >= 2) this._struggle('form'); else if (!quiet('invalid', 10)) this._play('curious');
        return;
      }
      if (m.kind === 'no-results') {
        if (quiet('none', 25)) return;
        this._play('confused');
        if (free) this._noneT = this._soon(() => { this._noneT = 0; if (this._offerHint(this._line('noResults', 'No matches. Try a broader word or fewer filters.'))) this._noneLine = this._token; }, 900);
      }
    }
    /**
     * Moments kept while Ixia was on its way: once it has landed and said hello, the latest one still fresh and on this
     * page is played (an older or another page's is dropped).
     */
    _drainMoments() {
      const q = this._queue || [];
      this._queue = [];
      const fresh = q.filter(m => (!m.path || m.path === location.pathname) && (!m.at || Date.now() - m.at < MOMENT_FRESH_MS));
      const m = fresh.find(x => x.kind === 'course-completed') || fresh[fresh.length - 1];
      if (m) this._react(m);
    }
    /** A form left open in a dialog for a long while with nothing done: a gentle offer of help, once per dialog. */
    _watchDialog(t) {
      // Only a dialog that is open and shown (a closed menu panel stays in the page, inert and hidden).
      const open = !!pick('[role="dialog"][aria-modal="true"]');
      if (!open) { this._dialogSince = 0; this._dialogHelped = false; return; }
      if (!this._dialogSince) this._dialogSince = t;
      if (!this._dialogHelped && t - this._dialogSince > 75 && t - this._lastAct > 20) { this._dialogHelped = true; this._struggle('dialog'); }
    }
    /** Once in a visit, on a course page or My courses, a learner is offered a few revision questions. */
    _maybeQuizOffer(t) {
      if (this._audience() !== 'learner' || !this._hasQuiz() || this._sess().quizOffered || t - this._pageStart < 40 || t - this._lastAct < 6) return;
      if (!/^\/(courses\/[^/]+|my-courses)/.test(location.pathname) || this._bubble.classList.contains('show') || this._fly || this._home.peek) return;
      this._sessSet({ quizOffered: true });
      const focus = this._cfg.revision.focus;
      this._play('curious');
      this._offerHint(focus ? `Fancy a quick revision question on ${focus}? Click me.` : 'Fancy a few quick revision questions? Click me.', true);
    }
    /** A configured line by key, or the default. */
    _line(key, fallback) { const list = (this._cfg.moments || {})[key]; return list && list.length ? pickLine(list, this._recentLine, 1) : fallback; }
    /** Someone seems stuck: Ixia comes out, looks concerned and offers help; clicking the bubble opens the questions. */
    _struggle(kind) {
      const t = now();
      if (t - (this._struggleAt || -1e9) < 75 || this._mode !== 'idle' || this._chat || this._guiding) return;
      this._struggleAt = t;
      if (this._sleeping) this._wake();
      // Out of the corner first, and the offer once it is up (never said in flight).
      const up = this._home.peek ? this._rise() : Promise.resolve();
      this._play(kind === 'rage' ? 'confused' : 'curious');
      const text = kind === 'rage' ? this._line('rage', 'That does not respond. Click me for help.')
        : kind === 'form' ? this._line('form', 'Some fields still need attention. Each one marked in red says what is missing.')
        : kind === 'dialog' ? this._line('dialog', 'Take your time. Click me if anything here is unclear.')
        : this._line('errors', 'Something did not work. Click me for help.');
      const path = location.pathname;
      up.then(() => { if (location.pathname === path) this._soon(() => this._offerHint(text), 500); });
    }
    /** Says a line that a click (on Ixia or on the bubble) answers by opening the chat, or the revision questions. */
    _offerHint(text, quiz) {
      if (this._mode !== 'idle' || this._chat || this._guiding || this._menuOver) return false;
      this._hintQuiz = !!quiz && this._hasQuiz();
      this.say(text, { hold: 7600, hint: true });
      return true;
    }
    /**
     * A course finished: fireworks, confetti that settles along the bottom of the page, a cheer and a somersault; then
     * the next course to take and a few revision questions on the one just finished.
     */
    async _celebrate(m) {
      this._effect('fireworks', { bursts: 4 });
      setTimeout(() => this._effect('confetti'), 900);
      if (this._sleeping) this._wake();
      if (this._home.peek) this._rise();
      this._play('cheer');
      setTimeout(() => this._play('flip'), 2000);
      await sleep(3600);
      if (this._away || this._mode === 'hidden') return;
      this._courseOffer(m);
    }
    /** The next course to take and a few revision questions on the one just finished. */
    _courseOffer(m) {
      const name = this._cfg.firstName ? ', ' + this._cfg.firstName : '';
      const actions = [];
      if (m.next && m.next.href) actions.push({ label: 'Start ' + m.next.title, run: () => this._go(m.next.href) });
      if (this._hasQuiz()) actions.push({ label: 'Revision questions', run: () => this._startQuiz(m.course) });
      this._offer(`Congratulations${name}. You have completed ${m.course || 'the course'}.${m.next ? ` ${m.next.title} is the next step.` : ''}`, actions);
    }
    /** The chat with a message and buttons of its own, in place of the questions. */
    _offer(text, actions) {
      if (!this._chat) this._openChatNow({ offer: true });
      this._view = 'offer';
      this._bubble.classList.add('answer');
      this._list.hidden = this._more.hidden = this._cta.hidden = this._chips.hidden = this._asked.hidden = this._back.hidden = true;
      this._links.innerHTML = '';
      for (const a of actions) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = a.label;
        b.addEventListener('click', a.run);
        this._links.appendChild(b);
      }
      this._links.hidden = !actions.length;
      this._token++; this._endSay(false);
      this._typeIn(this._fill(text));
      this._placeBubble();
      this._readMs = 9000; this._armIdle(this._readMs);
    }

    // ---------- revision questions ----------
    _hasQuiz() { const r = this._cfg.revision; return !!(r && r.questions && r.questions.length); }
    /**
     * A short round of revision questions, from the courses the learner holds (the one on this page, or `course`,
     * first), or sample questions on this course for a visitor.
     */
    _startQuiz(course, from) {
      // `from`: the questions of the last round, for another round on a page that has none of its own (a visitor's
      // sample questions come only with a course page).
      const all = this._hasQuiz() ? this._cfg.revision.questions : from;
      if (!all || !all.length) return;
      const focus = course || (this._cfg.revision && this._cfg.revision.focus);
      const mine = focus ? all.filter(q => q.course === focus) : [];
      const pool = (mine.length >= 3 ? mine : all).slice();
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      this._quiz = { list: pool.slice(0, Math.min(5, pool.length)), i: 0, score: 0, all };
      if (!this._chat) this._openChatNow({ offer: true });
      this._renderQuiz();
    }
    _renderQuiz() {
      const Q = this._quiz, q = Q.list[Q.i];
      this._view = 'quiz';
      this._bubble.classList.add('answer');
      this._more.hidden = this._cta.hidden = this._chips.hidden = this._links.hidden = true;
      this._backLabel.textContent = this._labels().questions; this._back.hidden = false;
      const count = document.createElement('span');
      count.className = 'qcount'; count.textContent = `Question ${Q.i + 1} of ${Q.list.length}`;
      // The topic keeps its own capitals (VPCs, IAM), after the count in capitals.
      const topic = document.createElement('span');
      topic.className = 'qtopic'; topic.textContent = ` · ${q.topic || q.course}`; count.appendChild(topic);
      this._asked.replaceChildren(count, document.createTextNode(q.q)); this._asked.hidden = false;
      // Moving on from Next question with the keyboard: the focus goes to the first option, not back to the page.
      const active = this.shadowRoot.activeElement, hadFocus = Boolean(active && this._bubble.contains(active));
      this._setText('');
      this._list.innerHTML = '';
      q.options.forEach((option, k) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = option; b.style.setProperty('--i', k);
        b.addEventListener('click', () => this._answerQuiz(k));
        this._list.appendChild(b);
      });
      this._list.hidden = false; this._list.scrollTop = 0;
      this._sr.textContent = `Question ${Q.i + 1} of ${Q.list.length}, ${q.topic || q.course}. ${q.q}`;
      if (hadFocus) this._list.querySelector('button').focus({ preventScroll: true });
      this.face('curious', 2); this.gesture('think', { dur: 1.4 });
      this._placeBubble();
      this._readMs = 20000; this._armIdle(this._readMs);
    }
    _answerQuiz(k) {
      const Q = this._quiz, q = Q.list[Q.i], right = k === q.answer, buttons = [...this._list.querySelectorAll('button')];
      buttons.forEach((b, i) => { b.disabled = true; if (i === q.answer) b.classList.add('right'); else if (i === k) b.classList.add('wrong'); });
      if (right) { Q.score++; this._play(pickFresh([['star', 1], ['clap', 1], ['hop', 1]], this._recentIdle, 1)); }
      else this._play('sad');
      const last = Q.i === Q.list.length - 1;
      this._setText(right ? pickLine(['Correct.', 'Exactly right.', 'Well done.', 'Spot on.'], this._recentLine, 1) : `Not quite. The answer is "${q.options[q.answer]}".`);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'go'; b.textContent = last ? 'See my score' : 'Next question';
      b.addEventListener('click', () => { if (last) this._endQuiz(); else { Q.i++; this._renderQuiz(); } });
      this._list.appendChild(b);
      this._placeBubble();
      b.focus({ preventScroll: true });
    }
    _endQuiz() {
      const Q = this._quiz, n = Q.list.length, all = Q.score === n;
      this._list.hidden = true; this._asked.hidden = true;
      this._typeIn(all ? `${Q.score} out of ${n}. Perfect.` : Q.score >= n / 2 ? `${Q.score} out of ${n}. Good work. A little more practice will do it.` : `${Q.score} out of ${n}. Review the recordings, then try again.`);
      if (all) { this._play('cheer'); this._effect('fireworks', { bursts: 2 }); } else if (Q.score >= n / 2) this._play('clap'); else this._play('sigh');
      this._links.innerHTML = '';
      const again = document.createElement('button');
      again.type = 'button'; again.textContent = 'Another round';
      again.addEventListener('click', () => this._startQuiz(Q.list[0].course, Q.all));
      this._links.appendChild(again); this._links.hidden = false;
      this._placeBubble();
    }

    // ---------- clicking Ixia ----------
    _audience() { return IDLE[this._cfg.audience] ? this._cfg.audience : 'visitor'; }
    _play(name) {
      const a = ACTS[name];
      if (!a) return;
      if (a.gesture) this.gesture(a.gesture);
      if (a.face) this.face(a.face[0], a.face[1]);
      if (a.emote) this.emote(a.emote[0], a.emote[1], a.emote[2] || 0);
    }
    // A click is never answered the same way twice running.
    _poke() {
      const ev = new CustomEvent('robot-click', { bubbles: true, composed: true, cancelable: true });
      if (!this.dispatchEvent(ev) || this._mode !== 'idle' || this._opening) return;
      this._engage();
      if (this._guiding) return this._endGuide(true);
      if (this._sleeping) this._wake();
      if (this._home.peek && !this._chat) this._rise();
      // With the chat open, it just reacts; clicked several times in quick succession, it may get dizzy.
      if (this._chat) {
        const t = now(); this._chatPokeAt = (this._chatPokeAt || []).filter(x => t - x < 2.5).concat(t);
        return this._play(this._chatPokeAt.length >= 3 && Math.random() < 0.6 ? 'dizzy' : pickFresh(POKE[this._audience()], this._recentPoke));
      }
      // Answering a click: a breath before anything of its own.
      this._holdActs(3.5, 6);
      if (!this._sess().flown) return this._firstFlight();
      if (this._hintUntil > now()) return this.openChat({ quiz: this._hintQuiz });
      this._hintQuiz = false;
      const moment = pickFresh([['quiet', 2], ['remark', 3], ['invite', 4], ['dance', this._calm ? 0 : 1.5], ['show', this._calm ? 0 : 2.6]], this._recentMoment, 1);
      if (moment === 'show') return this._showOff();
      this._play(moment === 'dance' ? pickFresh([['dance', 1], ['boogie', 1], ['twirl', 1]], this._recentIdle, 1) : pickFresh(POKE[this._audience()], this._recentPoke));
      // A second click soon after opens the chat (for as long as an invitation shows, if one is said).
      this._hintUntil = now() + 6;
      if (moment === 'quiet' || moment === 'dance' && Math.random() < 0.6) return;
      // The owner's line weighs double among the invitations: about one click in ten, never twice within five clicks.
      const invitations = this._cfg.invitations && this._cfg.invitations.length ? this._cfg.invitations : [POKE_CORE];
      const opener = moment === 'remark' || Math.random() < 0.45 ? pickLine(this._cfg.pokes, this._recentOpener, 3) : '';
      const invite = moment === 'invite' || !opener
        ? pickFresh(invitations.map(l => [l, l === POKE_CORE ? 2 : 1]), this._recentInvite, Math.min(4, invitations.length - 1)) : '';
      const text = [opener, invite].filter(Boolean).join(' ');
      if (!text) return;
      this.say(text, { hold: invite ? 5200 : 3600, speed: Math.round(rand(36, 58)), style: pickFresh(LANDINGS, this._recentLanding, 1), hint: !!invite });
      if (!invite) this._hintUntil = now() + 6;
    }
    // The first click in a session: a loop of delight on its own side of the window, up and round and back down into
    // the corner the chat opens from, then the chat.
    async _firstFlight() {
      this._sessSet({ flown: true });
      if (this._calm || !this._rig) return this.openChat();
      this._mode = 'flight';
      this.hush();
      const c = this._chatSpot(), vw = document.documentElement.clientWidth || innerWidth, h = this.clientHeight;
      const dir = c.side === 'left' ? 1 : -1, k = rand(0.85, 1.08);
      const L = clamp(vw * 0.13, 90, 200) * k, U = clamp((innerHeight - h) * 0.32, 70, 210) * k;
      const at = (kx, ky) => ({ x: c.x + dir * L * kx, y: c.y - U * ky });
      const loops = [[[0.35, 0.55], [0.9, 0.95], [1.05, 0.45], [0.6, 0.12]], [[0.15, 0.7], [0.6, 1], [1, 0.62], [0.7, 0.18]]];
      const pts = [{ x: this._off.x, y: this._off.y }, ...choice(loops).map(([a, b]) => at(a, b)), { x: c.x, y: c.y }];
      this.face('star', 3);
      this.emote('sparkle', 3);
      await this._flyPath(pts, 2.6);
      if (this._away || this._mode !== 'flight') return;
      this._home = c; this._arrivedAt = now();
      this.gesture('land');
      this.emote('sparkle', 3);
      await sleep(220);
      this._mode = 'idle';
      this.openChat();
    }
    // A double click: Ixia says goodbye, twirls away into the lower right corner, shrinking into a stream of light, and
    // the light gathers into a small button there with its face on it.
    async _dismiss({ quick = false } = {}) {
      if (this._mode !== 'idle' || this._leaving) return;
      this._leaving = true;
      if (this._guiding) this._endGuide(false);
      if (this._chat) this.closeChat();
      this.hush();
      // Sent away before it said hello: no greeting after all (the next visit has one).
      this._greetPending = false; clearTimeout(this._greetT);
      if (quick) {
        this._sessSet({ hidden: true });
        this._setMode('hidden');
        this._dockArrive(); this._nameDock();
        this._leaving = false;
        this._dock.focus({ preventScroll: true });
        return;
      }
      // Leaving: clicks no longer reach it, and nothing else starts while it says goodbye.
      this._mode = 'leaving';
      this.face('wink', 2); this.gesture('wave', { dur: 1.4 });
      const lines = [].concat(this._cfg.dismiss || 'I will step aside. Click my icon in the lower right corner whenever you need me again.');
      await this.say(pickFresh(lines.map(l => [l, 1]), this._recentLine, Math.min(2, lines.length - 1)), { hold: Infinity, speed: 55 });
      // Time to read where it will be (it says where its button is), longer when the line comes all at once.
      await sleep(this._calm ? 2500 : 1800);
      this.hush();
      if (!this._calm && this._rig) {
        this._motes(false);
        const to = this._dockOffset();
        this.gesture('twirl', { dur: 0.9 });
        this._flyTo(to.x, to.y, false, { dur: 0.9 });
        // The robot shrinks as it goes (its body only, never the button), held at the end until hidden.
        const fade = this._body.animate([{ opacity: 1, filter: 'blur(0px)', scale: '1' }, { opacity: 0.92, filter: 'blur(0px)', scale: '0.5', offset: 0.6 },
          { opacity: 0, filter: 'blur(3px)', scale: '0.1' }], { duration: 900, easing: 'cubic-bezier(.45, 0, .7, .35)', fill: 'forwards' });
        await fade.finished.catch(() => {});
        this._setMode('hidden');
        fade.cancel();
        this._dockArrive();
      } else this._setMode('hidden');
      // Its name shows beside the button for a moment, so the reader sees where it went.
      this._nameDock();
      // Remembered for the visit only once it is done, so an interrupted goodbye never leaves it gone.
      this._sessSet({ hidden: true });
      this._leaving = false;
    }
    _labelDock() {
      const name = this._cfg.name || 'Ixia';
      this._dock.setAttribute('aria-label', 'Open ' + name + ', the website guide');
      this._dock.title = 'Open ' + name;
    }
    _startDrag(e) {
      if (e.button !== 0 || e.isPrimary === false || this._mode !== 'idle' || this._leaving || !this.hasAttribute('data-drawn')) return;
      this._drag = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false, home: this._home };
      this._hit.setPointerCapture(e.pointerId);
    }
    _moveDrag(e) {
      const d = this._drag;
      if (!d || d.id !== e.pointerId) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return;
        d.active = true;
        clearTimeout(this._clickT); this._clickAt = -1e9;
        if (this._guiding) this._endGuide(false);
        if (this._chat) this.closeChat();
        this.hush(); this.stopGesture();
        if (this._fly) this._stopFly(this._flyState());
        d.off = { ...this._off };
        d.box = this._hit.getBoundingClientRect();
        this._mode = 'dragging';
        this._home = { ...this._home, peek: false };
        this.setAttribute('data-dragging', '');
        this._labelDock();
      }
      const dx = clamp(e.clientX - d.x, -d.box.left, innerWidth - d.box.right);
      const dy = clamp(e.clientY - d.y, -d.box.top, innerHeight - d.box.bottom);
      this._setOff(d.off.x + dx, d.off.y + dy);
      this._dock.classList.toggle('drop-ready', this._overDock());
      this._kick();
    }
    _overDock() {
      const a = this._hit.getBoundingClientRect(), b = this._dock.getBoundingClientRect();
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }
    _finishDrag(e, cancelled = false) {
      const d = this._drag;
      if (!d || (e && d.id !== e.pointerId)) return;
      this._drag = null;
      if (this._hit.hasPointerCapture(d.id)) this._hit.releasePointerCapture(d.id);
      // Read before the attribute goes: the button shows only for as long as the drag lasts.
      const dropped = d.active && !cancelled && this._overDock();
      this.removeAttribute('data-dragging'); this._dock.classList.remove('drop-ready');
      if (!d.active) return;
      this._suppressClickUntil = performance.now() + 500;
      this._clickAt = -1e9;
      this._mode = 'idle';
      if (dropped) return this._dismiss({ quick: true });
      this._home = d.home;
      this._flyTo(d.home.x, d.home.y, false, { dur: 0.4 });
      this._holdActs(4, 7);
    }
    _nameDock() {
      this._dock.classList.add('named');
      clearTimeout(this._nameT); this._nameT = setTimeout(() => this._dock.classList.remove('named'), 2600);
    }
    /** Where the corner button's middle is in the window, given how far it is lifted. */
    _dockCentre(nudge) {
      const vw = document.documentElement.clientWidth || innerWidth, narrow = this._narrow && this._narrow.matches;
      const size = narrow ? 46 : DOCK, m = narrow ? 12 : DOCK_M;
      const lift = parseFloat(getComputedStyle(this).getPropertyValue('--robot-dock-lift')) || 0;
      const n = nudge == null ? parseFloat(this.style.getPropertyValue('--dock-nudge')) || 0 : nudge;
      return { x: vw - m - size / 2, y: innerHeight - m - lift - n - size / 2, size, m, lift };
    }
    /** The offset from its corner that puts the robot's middle on the corner button. */
    _dockOffset() {
      this._placeDock();
      const d = this._dockCentre(), b = this._stage.getBoundingClientRect(), hs = this._hit.style;
      const cx = b.left - this._off.x + (parseFloat(hs.left) || 0) + (parseFloat(hs.width) || 0) / 2;
      const cy = b.top - this._off.y + (parseFloat(hs.top) || 0) + (parseFloat(hs.height) || 0) / 2;
      return { x: d.x - cx, y: d.y - cy };
    }
    /**
     * Keeps the corner button clear of the page: in its corner if nothing is there, otherwise lifted a step or two to
     * the nearest height where it covers nothing (or the least).
     */
    _placeDock() {
      if (this._drag && this._drag.active) return;
      const vw = document.documentElement.clientWidth || innerWidth;
      let best = 0, least = Infinity;
      for (let i = 0; i <= DOCK_LIFTS; i++) {
        const n = i * DOCK_STEP, d = this._dockCentre(n), score = this._coverAt(vw - d.m - d.size, d.y - d.size / 2, d.size, d.size);
        if (score < least) { least = score; best = n; }
        if (!score) break;
      }
      this.style.setProperty('--dock-nudge', best + 'px');
      return best;
    }
    /**
     * How much of the page a box in the window would cover: something to click or type in weighs most, then text and
     * pictures; empty background nothing.
     */
    _coverAt(x0, y0, w, h) {
      let score = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const x = x0 + w * (0.2 + 0.3 * i), y = y0 + h * (0.2 + 0.3 * j);
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        score += this._weigh(x, y);
      }
      return score;
    }
    /** The light gathers into the corner button and it glows for a moment as it takes Ixia in. */
    _dockArrive() {
      if (this._calm) return;
      const d = this._dockCentre(), b = this._stage.getBoundingClientRect(), r = d.size * 0.42;
      this._motes(true, { x: d.x - b.left - r, y: d.y - b.top - r, w: r * 2, h: r * 2 }, 18);
      this._dock.classList.remove('arrive'); void this._dock.offsetWidth; this._dock.classList.add('arrive');
      setTimeout(() => this._dock.classList.remove('arrive'), 1800);
    }
    /** The corner button brings Ixia out, and goes while it is out. */
    async _bringBack() {
      await this.ready;
      if (!this.isConnected || this._away || this._isPrivate()) return;
      if (this._mode !== 'hidden' || this._returning) return;
      // No 3D: the chat opens from the button (with what it kept to tell, a course finished, if anything).
      if (this._down && !this._revive3D()) {
        const m = this._missed; this._missed = null;
        return m && m.kind === 'course-completed' ? this._courseOffer(m) : this.openChat();
      }
      return this._restore(this._calm ? 'materialize' : 'dock');
    }
    _restore(how = 'materialize', thenChat) {
      if (this._mode !== 'hidden') return;
      clearTimeout(this._stillT);
      this._sessSet({ hidden: false });
      const focused = this.shadowRoot.activeElement === this._dock;
      this._setMode('off');
      // The button goes as Ixia comes out, so the keyboard carries on from Ixia.
      if (focused) this._hit.focus({ preventScroll: true });
      this._enter(how).then(() => {
        if (this._mode !== 'idle' || this._away) return;
        this._watchMoments();
        if (thenChat) this.openChat();
      });
    }
    // ---------- private pages ----------
    /**
     * Whether a page (this one by default) is private: signing in, creating an account and the profile (the config's
     * `private` paths).
     */
    _isPrivate(path = location.pathname) { return [].concat(this._cfg.private || []).some(p => matchPath(p, path)); }
    /** Steps away on a private page and comes back on the next page that is not. */
    _checkAway() {
      if (!this._started) return;
      const away = this._isPrivate();
      if (away && !this._away) this._goAway();
      else if (!away && this._away) this._comeBack();
    }
    /**
     * Leaves a private page: anything it was doing stops, it waves, and it rises away as light; nothing of it stays,
     * not even its corner button.
     */
    async _goAway() {
      this._finishDrag(null, true);
      this._away = true;
      clearTimeout(this._settleT); clearTimeout(this._stillT); clearTimeout(this._resizeT);
      if (this._guiding) this._endGuide(false);
      if (this._chat) this.closeChat();
      this.hush();
      try { sessionStorage.removeItem(K_PENDING); } catch (e) { /* storage unavailable */ }
      const was = this._mode;
      if (was !== 'idle' && was !== 'entering' && was !== 'flight') {
        if (was === 'hidden') this._setMode('away');
        return;
      }
      this._mode = 'leaving';
      if (this._fly) this._stopFly(this._flyState());
      let out = null;
      if (!this._calm && this._rig && this._shown) {
        this.face('wink', 1.2); this.gesture('wave', { dur: 1.1 });
        this._motes(false, null, 22);
        out = this._body.animate([{ opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0px)' },
          { opacity: 0, transform: 'translateY(-28px) scale(.8)', filter: 'blur(4px)' }], { duration: 640, delay: 360, easing: 'cubic-bezier(.4, 0, .7, .2)', fill: 'forwards' });
        await out.finished.catch(() => {});
      }
      if (this._away) this._setMode('away');
      // Back off the private page before it had gone (a quick trip there and back): gone from sight, it comes back as
      // it does from its button, rather than snapping back at once. (The new entrance holds it unseen as the fade ends.)
      else if (out) { this._mode = 'off'; this._enter('reappear'); }
      else { this._mode = 'idle'; this._kick(); }
      if (out) out.cancel();
    }
    /** Off a private page again: once any intro has lifted it comes back, or its icon if the reader has hidden it. */
    async _comeBack() {
      this._away = false;
      if (this._mode !== 'away') return;
      if (document.documentElement.hasAttribute('data-intro')) await this._afterLift();
      else await sleep(500);
      if (this._away || this._mode !== 'away') return;
      if (this._sess().hidden || this._down || !this._rig) return this._setMode('hidden');
      this._setMode('off');
      await this._enter(this._sess().greeted ? 'return' : 'first');
      this._watchMoments();
    }
    /**
     * Motes of light, from Ixia outwards (dissolving) or from around it inwards (gathering); `box` gathers or scatters
     * them about another spot (relative to the robot's own box), such as the corner button.
     */
    _motes(gather, box, count) {
      const hs = this._hit.style;
      const { x: x0, y: y0, w, h } = box || { x: parseFloat(hs.left) || 60, y: parseFloat(hs.top) || 10, w: parseFloat(hs.width) || 120, h: parseFloat(hs.height) || 190 };
      const colours = ['#5ff3ff', '#a5ecf3', '#2a25c4', '#ffffff', '#7d78ff'];
      const far = box ? [26, 70] : [40, 110];
      for (let i = 0, n = count || (gather ? 22 : 30); i < n; i++) {
        const el = document.createElement('i');
        el.className = 'mote';
        const bx = x0 + rand(0.18, 0.82) * w, by = y0 + rand(0.08, 0.9) * h, a = rand(0, Math.PI * 2), d = rand(far[0], far[1]);
        const ox = bx + Math.cos(a) * d, oy = by + Math.sin(a) * d - (gather ? 0 : rand(20, 60));
        const [sx, sy, ex, ey] = gather ? [ox, oy, bx, by] : [bx, by, ox, oy];
        for (const [k, v] of Object.entries({ '--x0': sx.toFixed(0) + 'px', '--y0': sy.toFixed(0) + 'px', '--x1': ex.toFixed(0) + 'px', '--y1': ey.toFixed(0) + 'px',
          '--s': rand(3, 7).toFixed(1) + 'px', '--c': choice(colours), '--dur': rand(0.7, 1.1).toFixed(2) + 's', '--delay': rand(0, gather ? 0.35 : 0.25).toFixed(2) + 's' })) {
          el.style.setProperty(k, v);
        }
        el.addEventListener('animationend', () => el.remove(), { once: true });
        this._dust.appendChild(el);
        setTimeout(() => el.remove(), 2600);
      }
    }
    _setMode(mode) {
      // Sent away on its way to a private page: nothing shows there, not even the corner button (it comes back after).
      if (mode === 'hidden' && this._away) mode = 'away';
      this._mode = mode;
      this._labelDock();
      if (mode === 'hidden' || mode === 'away') {
        this.setAttribute('data-state', mode);
        // End movement on the stage; the host and its viewport-fixed corner button never move.
        for (const a of this._stage.getAnimations()) a.cancel();
        for (const a of this._body.getAnimations()) a.cancel();
        this._visible = false; cancelAnimationFrame(this._raf); this._raf = 0;
        // A flight still under way (the one into the corner) ends here, so it never resumes on the way back.
        if (this._fly) { this._fly.res(); this._fly = null; }
        this._setOff(0, 0);
        if (mode === 'hidden') this._placeDock();
      } else {
        this.removeAttribute('data-state');
        this._dock.classList.remove('news');
        this._visible = true; this._kick();
      }
    }
    /**
     * When Ixia cannot be drawn (no 3D on this device, or the browser took its 3D context away and has not given it
     * back), the corner button stands in for it, so it is never lost from the page.
     */
    _fallBack() {
      this._finishDrag(null, true);
      this._down = true;
      if (this._mode === 'hidden') return;
      console.warn('[robot-companion] 3D drawing unavailable; the corner button stands in for Ixia.');
      this._down = true; this._shown = false; this.removeAttribute('data-drawn');
      if (this._guiding) this._endGuide(false);
      if (this._chat) this.closeChat();
      this.hush();
      this._setMode('hidden');
    }
    /** A fresh drawing surface and renderer, after the browser dropped the old context. */
    _revive3D() {
      if (!this.THREE || !this._scene || !this._rig) return false;
      try {
        const fresh = this._canvas.cloneNode(false);
        fresh.classList.remove('on');
        try { this._renderer.dispose(); } catch (e) { /* the old context is gone already */ }
        this._canvas.replaceWith(fresh); this._canvas = fresh;
        this._renderer = this._makeRenderer(fresh);
        Object.assign(this, { _down: false, _lost: false, _shown: false });
        this._frame();
        return true;
      } catch (err) {
        console.warn('[robot-companion] 3D could not be restarted.', err);
        return false;
      }
    }
    /**
     * The renderer: antialiased, drawn at one and a half times the screen's pixel density (up to three) so the edges
     * stay smooth when the browser scales it down, and watching for the browser dropping its context.
     */
    _makeRenderer(canvas) {
      const THREE = this.THREE;
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      // (On a phone or a tablet, at the screen's own density up to two: its screen is dense enough for smooth edges, and
      // under half the pixels are drawn.)
      r.setPixelRatio(this._hand.matches ? Math.min(window.devicePixelRatio || 1, 2) : Math.min((window.devicePixelRatio || 1) * 1.5, 3));
      r.setClearColor(0x000000, 0);
      r.shadowMap.enabled = true;
      // Redrawn when the loop asks (see _loop), the first time straight away.
      r.shadowMap.autoUpdate = false; this._shadowOdd = false;
      canvas.addEventListener('webglcontextlost', this._onLost);
      canvas.addEventListener('webglcontextrestored', this._onRestored);
      return r;
    }

    // ---------- arriving ---------- Flies in from just past the nearer edge to the best free spot, lands with a little
    // squash, says hello about a second later (once per session), then settles.
    async _enter(how) {
      if (this._mode === 'hidden' || this._mode === 'away' || this._away) return;
      this._mode = 'entering';
      this._labelDock();
      this._enteredAt = now();
      // Drawn from now on (until now only a first frame was, unseen).
      this._kick();
      // (`reappear`: back off a private page before it had quite gone; it comes back as from its button, with no line.)
      const back = how === 'materialize' || how === 'dock' || how === 'reappear';
      // The first page of a visit: a greeting is owed until it has been said (or the chat opened first); back from
      // signing in, a welcome by name is owed (see _greetDue).
      const greet = !back && this._greetDue();
      if (greet) this._greetPending = true;
      // Brought back, it comes out where it can be seen (not peeking), whatever the pointer is on; about to say hello,
      // it lands in full view where a spot is clear enough, rather than in its corner.
      const choose = () => (back ? this._pickHome(true, true) : greet && how !== 'quiet' ? this._greetHome() : this._pickHome());
      let H = (this._home = choose());
      this._arrivedAt = now();
      if (!this._calm && this._rig) {
        if (how === 'dock') {
          const from = this._dockOffset();
          this._setOff(from.x, from.y);
          const grow = this._body.animate([{ opacity: 0, scale: '0.12', filter: 'blur(3px)' }, { opacity: 1, scale: '0.55', filter: 'blur(0px)', offset: 0.4 },
            { opacity: 1, scale: '1', filter: 'blur(0px)' }], { duration: 1000, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' });
          this._motes(false, null, 16);
          this.gesture('twirl', { dur: 1 });
          await this._flyTo(H.x, H.y, false, { dur: 1 });
          await grow.finished.catch(() => {});
          this.gesture('land');
        } else if (how === 'materialize' || how === 'reappear') {
          this._setOff(H.x, H.y);
          this._motes(true);
          await this._body.animate([{ opacity: 0, filter: 'blur(9px)', scale: '0.9' }, { opacity: 1, filter: 'blur(0px)', scale: '1' }],
            { duration: 700, delay: 240, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' }).finished.catch(() => {});
        } else {
          // In from just past the nearer edge of the window (so it shows at once), the leading arm out, easing to a stop
          // on its spot, and a little bob as it lands.
          const from = this._edgeStart(H);
          this._setOff(from.x, from.y);
          this.face('happy', 1.8);
          await sleep(30);
          const fly = this._flyTo(H.x, H.y, false, { dur: 1.25, pace: 'dash', pose: 'lead', bulge: 0.08 });
          // A last look as it nears its spot: what the page fetched after it opened (a list of courses, say) may now be
          // there, and if so it curves on to a clearer spot without stopping.
          await Promise.race([fly, sleep(650)]);
          if (this._mode === 'entering' && !this._away && this._fly) {
            const again = choose();
            if (again.id !== H.id) { H = this._home = again; await this._flyTo(H.x, H.y, false, { dur: 0.8, pace: 'smooth', pose: 'glide', bulge: 0.06 }); }
            else await fly;
          } else await fly;
          this.gesture('land');
        }
      } else this._setOff(H.x, H.y);
      // Sent off to a private page on the way in: it never lands.
      if (this._away || this._mode !== 'entering') return;
      this._mode = 'idle';
      this._settledAt = this._landedAt = now();
      this._actAt = now() + rand(2.2, 3.4);
      this._warm = WARM_UP;
      if (greet) this._greetAt = now() + GREET_AFTER;
      // A tour waiting from the last page: it goes first (a greeting still owed comes after it).
      if (how === 'quiet') return;
      // Back from a private page with nothing owed: a wave, nothing said.
      if (how === 'return' && !greet) { this.face('happy', 1.4); if (!this._calm) this.gesture('wave', { dur: 1.4 }); return; }
      if (how === 'reappear') { this.face('happy', 1.2); return; }
      if (how === 'back' || back) {
        this.face('happy', 1.6); this.gesture('wave', { dur: 1.6 }); this.emote('heart', 2);
        // Something happened while it was away (a course finished): it tells of that now, in place of its usual line.
        const m = this._missed; this._missed = null;
        if (m) { this._soon(() => this._react(m), 1100); return; }
        const lines = this._cfg.returns || [];
        if (lines.length && this._isEngaged && Math.random() < 0.6) this.say(pickFresh(lines.map(l => [l, 1]), this._recentLine, 1), { hold: 3600 });
        return;
      }
      if (greet) {
        // About a second after landing it says hello, whatever the reader is doing; nothing of its own before that, and
        // it stays on this spot meanwhile (a scroll still moves it).
        this._holdActs(GREET_AFTER + 2, GREET_AFTER + 3);
        this._stayUntil = now() + GREET_AFTER + 3;
        // Its lines not here yet (they come with who is looking): a wave for now, and the greeting when they arrive.
        if (this._hasGreetings()) this._greetSoon(); else if (!this._calm) { this.face('happy', 1.2); this.gesture('wave', { dur: 1.6 }); }
        return;
      }
      if (!this._calm) { this.face('happy', 1.2); this.gesture('wave', { dur: 1.6 }); }
    }
    /** Just past the nearer edge of the window, a little above a spot: where an entrance starts, out of sight. */
    _edgeStart(H) {
      const b = this._stage.getBoundingClientRect(), hs = this._hit.style, vw = document.documentElement.clientWidth || innerWidth;
      const x0 = b.left - this._off.x + (parseFloat(hs.left) || 0), w = parseFloat(hs.width) || this.clientWidth;
      return { x: H.side === 'left' ? -(x0 + w) - 16 : vw - x0 + 16, y: H.y - 40 };
    }

    // ---------- the greeting ----------
    /**
     * Whether there is a greeting to say: its lines, and who is looking (configure() brings both once the session is
     * known), or, set up without an audience, a moment after landing.
     */
    _hasGreetings() {
      const c = this._cfg;
      return !!(c.greeting || (c.greetings || []).length) && (!!c.audience || now() - (this._landedAt || now()) > 2.5);
    }
    /** Whether this browser has met Ixia before (so it is welcomed back rather than introduced to it). */
    _met() { try { return localStorage.getItem(K_MET) === '1'; } catch (e) { return false; } }
    /** Tries the greeting in a moment (never before its time after landing). */
    _greetSoon(delay = 0) {
      clearTimeout(this._greetT);
      const wait = Math.max(delay, (this._greetAt || 0) - now());
      this._greetT = setTimeout(() => this._tryGreet(), Math.max(0, wait * 1000));
    }
    /** Says the greeting if nothing stands in its way; otherwise it stays owed and _tick tries again. */
    _tryGreet() {
      if (!this._greetPending || this._greeting) return;
      if (!this._greetDue()) { this._greetPending = false; return; }
      // No lines to say (none set up, or they never came): nothing is owed after all, and the page's reaction and
      // remarks no longer wait for it.
      const lines = !!(this._cfg.greeting || (this._cfg.greetings || []).length);
      if (!lines && this._landedAt && (this._cfg.audience || now() - this._landedAt > 8)) { this._greetPending = false; return; }
      // (A timer can fire a hair early by this clock.)
      if (!this._hasGreetings() || now() < (this._greetAt || 0) - 0.05 || this._mode !== 'idle' || this._away || this._isPrivate()) return;
      if (this._chat || this._guiding || this._fly || this._opening || this._leaving || this._popping || this._menuOver || this._bubble.classList.contains('show')) return;
      this._greetNow();
    }
    /**
     * The greeting: an introduction the first time this browser meets Ixia and a welcome back after that, in one of
     * several ways, never the same as last time (even on another visit); a wave or now and then a little dance with it,
     * said in full view (from the corner it rises first and tucks back once the line has been read), and nothing of its
     * own until then. The page's own reaction follows once the line has gone.
     */
    async _greetNow() {
      this._greeting = true;
      try {
        if (this._sleeping) this._wake();
        if (this._home.peek && !this._calm) {
          const up = this._greetHome();
          if (!up.peek) {
            this._stayUntil = Infinity;
            await this._moveHome(up);
            if (this._mode !== 'idle' || this._chat || this._guiding || !this._greetDue()) return;
          }
        }
        const met = this._met(), pool = [].concat(met && (this._cfg.welcomeBack || []).length ? this._cfg.welcomeBack : this._cfg.greetings || []);
        let last = ''; try { last = localStorage.getItem(K_LAST_GREETING) || ''; } catch (e) { /* storage unavailable */ }
        const line = pickLine(pool.length > 1 ? pool.filter(l => l !== last) : pool, this._recentLine, 1) || this._cfg.greeting;
        if (!line) { this._greetPending = false; return; }
        this._markGreeted(line);
        const aud = this._audience(), learner = aud === 'learner';
        const dance = !this._calm && !this._home.peek && aud !== 'admin' && Math.random() < (met ? 0.4 : 0.28);
        this.emote(learner ? 'star' : 'sparkle', 3);
        if (dance) this._play(pickFresh([['dance', 1], ['boogie', 1], ['twirl', 1]], this._recentIdle, 1));
        const text = this._fill(line), hold = clamp(text.length * 30 + 1600, 4200, 5600), typing = text.length / 40 + 0.8;
        this._stayUntil = Infinity;
        this._holdActs(typing + hold / 1000 + 1, typing + hold / 1000 + 1.6);
        const said = await this.say(line, { gesture: dance ? undefined : 'wave', face: learner ? 'star' : 'happy', faceFor: 2.4, hold, style: 'pop' });
        // The page's reaction comes a breath after the line has gone, still from here; then it may move again (tucking
        // back into its corner if it rose).
        this._pageGreetAfter = now() + (said ? hold / 1000 : 0) + 1.2;
        this._stayUntil = said ? this._pageGreetAfter + 1.2 : 0;
        this._greetedAt = this._pageGreetAfter;
      } finally {
        this._greeting = false;
        // Cut short before it spoke (a click, the chat, a new page): it is free to move again.
        if (this._stayUntil === Infinity) this._stayUntil = 0;
      }
    }
    /** For the greeting, a spot in full view: the clearest one, unless even that covers much of the page. */
    _greetHome() {
      const best = this._pickHome(true);
      return this._calm || this._busyAt(best) <= GREET_COVER ? best : this._pickHome();
    }
    /**
     * Whether a greeting is owed: none yet in this visit, or none yet for whoever has since signed in (a learner or an
     * administrator is welcomed by name once, never introduced to Ixia again).
     */
    _greetDue() {
      const s = this._sess(), a = this._cfg.audience;
      return !s.greeted || (!!a && a !== 'visitor' && !!s.greetedAs && s.greetedAs !== a);
    }
    /**
     * Signed in or out on a page Ixia is on (not by way of the sign-in page, where _comeBack sees to it): signed out, a
     * little wave and nothing said; signed in, the welcome by name if it is owed.
     */
    _audienceChanged() {
      if (this._away || this._mode !== 'idle') return;
      if (this._cfg.audience === 'visitor') {
        if (this._sess().greeted) this._sessSet({ greetedAs: 'visitor' });
        this.face('happy', 1.4); if (!this._calm) this.gesture('wave', { dur: 1.4 });
        return;
      }
      if (this._greetDue() && !this._greetPending) { this._greetPending = true; this._greetAt = now() + 0.8; this._greetSoon(); }
    }
    /** The greeting has been said (or the chat opened first): once per session, and remembered by this browser. */
    _markGreeted(line) {
      this._greetPending = false; clearTimeout(this._greetT);
      this._sessSet({ greeted: true, greetedAs: this._cfg.audience || 'visitor' });
      try { localStorage.setItem(K_MET, '1'); if (line) localStorage.setItem(K_LAST_GREETING, line); } catch (e) { /* storage unavailable */ }
    }

    // ---------- life while idle ----------
    _act() {
      this._lastAct = now();
      if (this._sleeping) this._wake(true);
    }
    _wake(startled) {
      if (!this._sleeping) return;
      this._sleeping = false;
      this.face(startled ? 'surprised' : 'neutral', startled ? 0.8 : 0);
      if (startled && !this._calm) this.gesture('hop');
      this._holdActs(2, 4);
      // Asleep through its arrival on a page: the page's own reaction would come long after it, so it is let go.
      if (now() - this._pageStart > 8) this._pageGreeted = true;
    }
    /**
     * A new page in the app (configure() hears of it first, _tick checks too): what was said or shown for the last page
     * goes (a remark, a hint and its click, a tour), it wakes if it dozed, and it finds its spot once the new page has
     * stopped changing.
     */
    _pageChanged() {
      if (location.pathname === this._path) return;
      this._finishDrag(null, true);
      Object.assign(this, { _path: location.pathname, _pageStart: now(), _tipsHere: 0, _moreOpen: false, _moment: null, _pageGreeted: false, _dialogSince: 0 });
      // (Never sooner than a breath into the new page: an activity due on the last one waits.)
      this._warm = Math.max(this._warm || 0, WARM_PAGE); this._actAt = Math.max(this._actAt || 0, now() + rand(2.8, 4.2));
      for (const id of this._timers) clearTimeout(id);
      this._timers.clear();
      clearTimeout(this._showT); clearTimeout(this._finalT);
      if (this._guiding && this._guidePath !== location.pathname) this._endGuide(true);
      this._hintUntil = 0; this._hintQuiz = false;
      if (!this._chat && !this._guiding && this._bubble.classList.contains('show')) this.hush();
      if (this._sleeping) this._wake();
      this._lastAct = now();
      // What the last page played dissolves by itself (robot-fx.js); new effects take this page's theme.
      if (this._fxP) this._fxP.then(fx => fx && fx.setPage(location.pathname));
      setTimeout(() => this._watchMoments(), 1200);
      // It checks for a free spot once the page has drawn (sent away, it stays the corner button until that is clicked,
      // and the button checks it covers nothing).
      this._settleWhenStill(true);
      this._checkAway();
    }
    _tick() {
      this._pageChanged();
      if (this._away || this._mode === 'away') return;
      // The corner button checks that it still covers nothing (the page can change unscrolled).
      if (this._mode === 'hidden' && !document.hidden && now() - (this._dockAt || 0) > 3.2) { this._dockAt = now(); this._placeDock(); }
      // Out and about but not drawn for a while (the browser dropped its 3D context and never gave it back): the corner
      // button takes over, so Ixia is never lost from the page.
      // (Counted from when the page was last shown: a tab opened behind others draws nothing until it is brought forward.)
      if (this._mode === 'idle' && this._rig && !document.hidden && (this._lost ? now() - this._lostAt > 3 : !this._shown && now() - Math.max(this._enteredAt || now(), this._visibleAt || 0) > 6)) this._fallBack();
      if (document.hidden || !this._rig || this._mode !== 'idle' || this._chat || this._guiding || this._leaving) return;
      // Under an open menu of the site's bar: nothing of its own until it closes (see _menuCheck).
      if (this._menuOver) return;
      const t = now(), H = this._home, atHome = this._off.x === H.x && this._off.y === H.y;
      this._mood(t);
      // Dozes off when nothing has happened for a while, and wakes on the next movement.
      const doze = this._hand.matches ? Math.min(HAND.doze, DOZE_AFTER[this._audience()]) : DOZE_AFTER[this._audience()];
      if (!this._sleeping && !this._calm && t - this._lastAct > doze && !this._bubble.classList.contains('show')) {
        this._sleeping = true; this.face('sleepy', Infinity); this._zAt = t;
        if (!atHome) this._flyTo(H.x, H.y, false, { dur: 1.8, gentle: true });
      }
      if (this._sleeping) { if (t - (this._zAt || 0) > 4.5) { this._zAt = t; this.emote('zzz', 2); } return; }
      // A greeting still owed (the lines came late, or something was in the way at its time).
      if (this._greetPending) this._tryGreet();
      // What happened on the page while it was on its way, once it has landed and any greeting has been said.
      if (this._queue && this._queue.length && !this._greetPending && !this._greeting && t - (this._landedAt || 0) > 1.2 &&
        !this._fly && !this._bubble.classList.contains('show')) this._drainMoments();
      this._maybeTip(t);
      this._pageGreet(t);
      this._watchDialog(t);
      this._maybeQuizOffer(t);
      if (this._fly || this._gestures.length) { this._movedAt = t; return; }
      // Every few seconds, once the page is still: is it still clear of the page (content can change without a scroll)?
      const still = t - (this._scrollAt || -1e9);
      // (Not while the greeting is said and read: it stays where it said hello until then; a scroll still moves it.)
      if (t - (this._settledAt || 0) > (this._hand.matches ? HAND.recheck : 5) && still > 2 && t >= (this._stayUntil || 0)) { this._settle(); if (this._fly) return; }
      // While it says something it keeps moving on the spot, but a hint holds it still until it is read.
      const talking = this._bubble.classList.contains('show');
      if (talking && this._bubble.classList.contains('hint')) return;
      // A moment that came into view, once the page has been still for a little while.
      if (this._moment && !talking && !this._calm && !H.peek && t - (this._scrollAt || -1e9) > 1.2 && t - (this._momentAt || -1e9) > 20) {
        const [sel, act] = this._moment; this._moment = null; this._momentAt = t;
        this._sessSet({ moments: (this._sess().moments || []).concat(sel) });
        this._play(act); return;
      }
      // Now and then, something of its own (see ACTIVITIES); peeking from the corner, only on the spot.
      if (!this._calm && !this.hasAttribute('quiet') && t > this._actAt && t - (this._movedAt || 0) > (this._warm > 0 ? REST.warm : REST.after)) this._activity(t, still, talking);
    }
    /** Holds its own activities off for a while (after the reader has used it, say). */
    _holdActs(a, b) { this._actAt = Math.max(this._actAt || 0, now() + rand(a, b)); }
    /** Runs `fn` after `ms` if the reader is still on this page (a new page clears it; see _pageChanged). */
    _soon(fn, ms) {
      const path = location.pathname, id = setTimeout(() => { this._timers.delete(id); if (location.pathname === path) fn(); }, ms);
      this._timers.add(id);
      return id;
    }
    /** Seconds until the gestures under way have finished (0 when none is). */
    _gestureLeft() {
      const t = now();
      return this._gestures.reduce((m, g) => Math.max(m, g.kill ? g.kill + 0.3 - t : g.start + g.D - t), 0);
    }
    /** Whether the pointer is near Ixia (or was a moment ago): it never flies off from under the reader's hand. */
    _pointerNear(r) {
      const P = this._ptr;
      if (!P || now() - P.t > 6) return false;
      const b = this._hit.getBoundingClientRect();
      return P.x > b.left - r && P.x < b.right + r && P.y > b.top - r && P.y < b.bottom + r;
    }
    /** Something of its own, chosen by chance and never the same as the last two (see ACTIVITIES). */
    _activity(t, still, talking) {
      const hand = this._hand.matches, calmer = hand ? HAND.acts : 1;
      const aud = this._audience(), H = this._home, [a, b] = ACT_EVERY[aud].map(v => v * calmer), warm = this._warm > 0 && aud !== 'admin';
      // Just arrived: nothing yet that takes it out of sight or across the window (see SETTLE_IN).
      const fresh = t - (this._landedAt || 0) < SETTLE_IN;
      this._actAt = t + (warm ? rand(WARM_EVERY[0], WARM_EVERY[1]) * calmer : rand(a, b));
      if (warm) this._warm--;
      const gap = hand ? HAND.fly : FLY_GAP;
      const canFly = !talking && !H.peek && !this._visiting && still > 2.5 && t - this._lastAct > 3 && !this._hover && !this._pointerNear(150) && t - (this._flewAt || 0) > (warm ? gap.warm : gap.after);
      const home = location.pathname === '/';
      // Tucked into the corner it now and then pops up for a moment; otherwise only its head shows, so a face or a look.
      if (H.peek) {
        if (!talking && !fresh && aud !== 'admin' && still > 2.5 && Math.random() < (warm ? 0.4 : 0.22) && this._popOut()) return;
        return this._play(pickFresh(PEEK_IDLE[aud], this._recentIdle, 3));
      }
      // A dive out of sight is never one of the opening few (on any page).
      const table = ACTIVITIES[aud].filter(([k]) => (canFly || !FLIGHTS.has(k)) && !(fresh && FAR.has(k)) && !(warm && k === 'peekaboo') && !(hand && HAND_SKIP.has(k)))
        .map(([k, w]) => [k, (k === 'cross' && H.side === 'left' && t - (this._arrivedAt || 0) > 24 ? w * 2.5 : k === 'dance' && home ? w * 1.4 : w) * (warm ? (k === 'gesture' ? 0.6 : 1.25) : 1) * (hand && HAND_HALF.has(k) ? 0.5 : 1)]);
      const act = pickFresh(table, this._recentAct, 3);
      if (act === 'sparkle') {
        this._play(pickFresh([['whirl', 1], ['cheer', 1], ['twirl', 1]], this._recentIdle, 2));
        this._effect('sparks', { amount: 0.18 });
        return;
      }
      if (FLIGHTS.has(act) && this._flight(act)) { this._flewAt = t; return; }
      this._play(act === 'spin' ? pickFresh(SPINS[aud], this._recentIdle, 3) : act === 'dance' ? pickFresh(DANCES, this._recentIdle, 2)
        : act === 'trick' ? pickFresh(TRICKS, this._recentIdle, 3) : pickFresh(IDLE[aud], this._recentIdle, 4));
    }
    /** Peeking from the corner: up into full view for a moment, a trick, a spin or a wave, then back down. */
    _popOut() {
      const H = this._home, up = this._homes().find(x => x.id === (H.side === 'left' ? 'L' : 'R'));
      // (Never up over a link or a button, even for a moment.)
      if (!up || this._fly || this._pointerNear(170) || now() - (this._poppedAt || -1e9) < POP_GAP || this._coverOf(up, true).ctl) return false;
      const aud = this._audience(), back = { x: H.x, y: H.y };
      this._popping = true; this._poppedAt = now();
      // (Its spot is told by name: a routine check may hand it a fresh copy of the same one.)
      const busy = () => this._mode !== 'idle' || this._chat || this._guiding || this._opening || this._sleeping || this._home.id !== H.id;
      // Down again once the trick is over, never from under the reader's pointer; a re-placing asked for meanwhile
      // (a resize, a new page) is done instead.
      const down = () => {
        if (busy()) { this._popping = false; return; }
        // (Nor while a line it has just begun is read.)
        if (this._hover || this._pointerNear(60) || (this._bubble.classList.contains('show') && !this._read(now()))) { this._popT = setTimeout(down, 800); return; }
        this._popping = false;
        if (this._settleAgain) { this._settleAgain = false; return this._settle(true); }
        this._flyTo(back.x, back.y, false, { dur: rand(0.9, 1.15), pace: 'smooth', pose: 'glide' });
      };
      this._flyTo(up.x, up.y, false, { dur: rand(0.85, 1.1), pace: 'smooth', pose: 'lead', bulge: 0.12 }).then(() => {
        // Cut short (a click, help, the chat or a doze took over): no trick.
        if (busy() || this._fly) { this._popping = false; return; }
        const trick = pickFresh(TRICKS.concat(SPINS[aud], [['wave', 1.2], ['cheer', 0.8]]), this._recentIdle, 3), g = GESTURES[(ACTS[trick] || {}).gesture];
        this._play(trick);
        // Down once the trick has finished, and a breath after it (a juggle runs longer than a spin).
        clearTimeout(this._popT); this._popT = setTimeout(down, ((g ? g.dur : 2.2) + rand(0.5, 1)) * 1000);
      });
      return true;
    }
    /** Plans a flight from where Ixia rests and starts it if it keeps Ixia on the screen (or if it is meant to leave it). */
    _tryFlight(to, opts) {
      if (this._calm || this._fly || this._mode !== 'idle') return null;
      const plan = planFlight({ x: this._off.x, y: this._off.y }, { x: 0, y: 0 }, to, Object.assign({}, opts, { dur: (opts.dur || 1.2) * 0.84 }));
      if (!opts.offscreen && !this._fits(plan)) return null;
      return this._launch(plan, to, opts);
    }
    /** Whether a planned flight keeps Ixia on the screen and below the page's top bar all the way. */
    _fits(plan) {
      const b = this._stage.getBoundingClientRect(), hs = this._hit.style, vw = document.documentElement.clientWidth || innerWidth;
      const hl = parseFloat(hs.left) || 0, ht = parseFloat(hs.top) || 0, hw = parseFloat(hs.width) || 0, hh = parseFloat(hs.height) || 0;
      const bx = b.left - this._off.x + hl, by = b.top - this._off.y + ht;
      const top = (parseFloat(getComputedStyle(this).getPropertyValue('--robot-safe-top')) || 72) + 4;
      for (let i = 0; i < plan.pts.length; i += 8) {
        const x = bx + plan.pts[i], y = by + plan.pts[i + 1];
        if (x < 4 || x + hw > vw - 4 || y < top || y + hh > innerHeight + 12) return false;
      }
      return true;
    }
    /**
     * One of Ixia's own flights (see ACTIVITIES), each with its shape, pace, speed and pose chosen by chance: across
     * the window or up and down its own side to another clear spot, a loop the loop, a figure of eight or a swoop out
     * and back on the spot, a dive out of sight that comes up in another corner, or a small drift.
     */
    _flight(kind) {
      const H = this._home, spots = this._homes(), cur = { x: this._off.x, y: this._off.y }, inward = H.side === 'right' ? -1 : 1;
      // Up into the room above it where there is some, otherwise down into the room below (near the top bar).
      const hb = this._hit.getBoundingClientRect(), safe = (parseFloat(getComputedStyle(this).getPropertyValue('--robot-safe-top')) || 72) + 8;
      const vdir = need => (hb.top - safe >= need ? -1 : innerHeight - hb.bottom >= need ? 1 : 0);
      const pose = () => pickFresh([['glide', 2], ['wings', 2], ['lead', 2]], this._recentPose, 1);
      // Mostly smooth or unhurried, now and then brisk; a dash is rare.
      const pace = () => pickFresh([['smooth', 4], ['lazy', 2], ['brisk', 1], ['dash', 0.4]], this._recentPace, 1);
      const spring = () => ({ stiff: rand(9.5, 14), damp: rand(0.8, 0.95) });
      const clear = list => list.filter(x => x.id !== H.id && this._busyAt(x) < MOVE_AT);
      const go = (to, opts, after) => {
        const run = this._tryFlight(to, opts);
        if (!run) return false;
        if (opts.home) { if (opts.home.side !== H.side) this._crossedAt = now(); this._home = opts.home; this._arrivedAt = now(); }
        this.face(choice(['happy', 'star', 'wink', 'laugh']), Math.min(3, (opts.dur || 1.5) + 0.4));
        run.then(() => { if (this._mode === 'idle' && !this._fly) (after || (() => this._landed(kind)))(); });
        return true;
      };
      if (kind === 'cross' || kind === 'climb') {
        const options = clear(spots.filter(x => (kind === 'cross') === (x.side !== H.side)));
        if (!options.length) return false;
        const to = choice(options), dist = Math.hypot(to.x - cur.x, to.y - cur.y);
        const shape = pickFresh([['glide', 3], ['swoop', 2], ['wave', 1.5], ['hop', 1.4], ['loop', 1.2], ['zigzag', 0.6]], this._recentShape, 1);
        // A different speed each time, never a rush across the window.
        const opts = Object.assign({ shape, pace: pace(), pose: shape === 'loop' ? 'loop' : pose(), home: to,
          dur: clamp((0.9 + dist / 560) * rand(0.95, 1.35) + (shape === 'loop' ? 0.5 : 0), 1.2, 3.8),
          bulge: shape === 'hop' ? rand(0.28, 0.42) : rand(0.05, 0.2), flip: shape !== 'hop' && Math.random() < 0.3,
          spin: shape !== 'loop' && Math.random() < 0.2 ? 1 : 0, r: rand(40, 62), amp: rand(16, 34), waves: rand(1.4, 2.6) }, spring());
        return go(to, opts) || go(to, Object.assign(opts, { shape: 'glide', bulge: 0.06, flip: false }));
      }
      if (kind === 'loop') {
        // A loop the loop on its open side: out along the bottom, up and over, and down home.
        const rr = rand(38, 60), up = vdir(rr * 2.2);
        if (!up) return false;
        const at = (kx, ky) => ({ x: cur.x + inward * kx * rr, y: cur.y + up * ky * rr });
        const points = [cur, at(1.5, 0.25), at(1.9, 1.5), at(0.9, 2.1), at(0.15, 1.2), cur];
        return go(cur, { shape: 'path', points, dur: rand(2.1, 2.9), pace: Math.random() < 0.75 ? 'smooth' : 'brisk',
          pose: Math.random() < 0.5 ? 'loop' : 'wings', spin: Math.random() < 0.3 ? 1 : 0, stiff: 15, damp: 0.86 });
      }
      if (kind === 'figure8') {
        const ay = rand(20, 32), up = vdir(ay + 6);
        return go(cur, Object.assign({ shape: 'figure8', side: inward, ax: rand(28, 46), ay: ay * (up || -1), dur: rand(2.2, 3.2), pace: 'smooth', pose: Math.random() < 0.5 ? 'wings' : 'glide' }, spring()));
      }
      if (kind === 'visit') {
        // Over to the other side for a moment (where nowhere is clear enough to stay), a gesture there, and back home.
        const far = spots.filter(x => x.side !== H.side), ys = far.map(x => x.y);
        if (!far.length) return false;
        const lo = Math.min(...ys), hi = Math.max(...ys), places = [];
        for (let i = 0; i <= 6; i++) places.push({ id: 'V', x: far[0].x, y: Math.round(hi + ((lo - hi) * i) / 6), side: far[0].side });
        // (Only somewhere it covers nothing of the page, as for a spot to rest on, although it stays only a moment.)
        const there = places.map(x => [x, this._busyAt(x)]).filter(([, b]) => b < MOVE_AT).sort((a, b) => a[1] - b[1])[0];
        if (!there) return false;
        const to = there[0], dist = Math.hypot(to.x - cur.x, to.y - cur.y), home = { x: H.x, y: H.y };
        const leg = () => Object.assign({ shape: pickFresh([['glide', 3], ['swoop', 2], ['wave', 1.4], ['hop', 1.2]], this._recentShape, 1), pace: pace(), pose: pose(),
          dur: clamp((0.9 + dist / 560) * rand(0.95, 1.3), 1.2, 3.6), bulge: rand(0.06, 0.22), flip: Math.random() < 0.3, amp: rand(16, 30), waves: rand(1.4, 2.4) }, spring());
        return go(to, leg(), () => {
          this._play(pickFresh([['wave', 2], ['look', 2], ['spin', 1], ['pirouette', 1], ['hop', 1]], this._recentIdle, 1));
          // Out on a visit: the routine spot checks wait for its return (a check asked for meanwhile is made then, in
          // place of the flight home), so nothing strands it on the far side.
          this._visiting = true;
          clearTimeout(this._visitT);
          const back = () => {
            // A line being said over there is read there first.
            if (this._mode === 'idle' && this._bubble.classList.contains('show') && !this._read(now())) { this._visitT = setTimeout(back, 800); return; }
            this._visiting = false;
            if (this._mode !== 'idle' || this._chat || this._guiding || this._fly || this._home.id !== H.id) return;
            // A check asked for while it was out: home is checked first (moved by a resize, or covered now by the page).
            const again = this._settleAgain, spot = this._homes().find(x => x.id === H.id);
            this._settleAgain = false;
            if (again && (!spot || spot.x !== home.x || spot.y !== home.y || this._busyAt(spot) >= MOVE_AT)) return this._settle(true);
            if (Math.hypot(this._off.x - home.x, this._off.y - home.y) < 2) return;
            const run = this._tryFlight(home, Object.assign(leg(), { offscreen: true }));
            if (run) run.then(() => this._landed('visit')); else this._settle(true);
          };
          this._visitT = setTimeout(back, rand(3000, 5200));
        });
      }
      if (kind === 'swoop') {
        const d = rand(80, 150), h = rand(40, 90), up = vdir(h + 10);
        if (!up) return false;
        const points = [cur, { x: cur.x + inward * d, y: cur.y + up * h * 0.45 }, { x: cur.x + inward * d * 0.45, y: cur.y + up * h }, cur];
        return go(cur, Object.assign({ shape: 'path', points, dur: rand(1.8, 2.6), pace: pace(), pose: 'wings' }, spring()));
      }
      if (kind === 'drift') {
        const away = Math.hypot(cur.x - H.x, cur.y - H.y) > 2;
        const to = away ? { x: H.x, y: H.y } : { x: H.x + inward * rand(18, 70), y: H.y - rand(0, 34) };
        if (!away && this._busyAt(to) >= MOVE_AT) return false;
        return go(to, { gentle: true, dur: rand(2.2, 3.4), pace: 'lazy', bulge: rand(0.04, 0.12), pose: 'drift', stiff: 8, damp: 1 }, () => {});
      }
      if (kind === 'peekaboo') {
        // Down out of sight, and up again in another clear corner, or its own (or where it was) when that is clear; with
        // nowhere clear to come up, it does not dive.
        const own = spots.find(x => x.id === (H.side === 'left' ? 'L' : 'R'));
        const to = choice(clear(spots.filter(x => x.side !== H.side && x.y === 0))) || (own && this._busyAt(own) < MOVE_AT ? own : null) || (this._busyAt(H) < MOVE_AT ? H : null);
        if (!to) return false;
        // Low enough that all of it is below the window (its box's top past the bottom edge), wherever it starts from.
        const deep = innerHeight + 12 - (this._stage.getBoundingClientRect().top - this._off.y);
        return go({ x: cur.x, y: deep }, { offscreen: true, shape: 'glide', bulge: 0.04, pace: 'brisk', dur: rand(0.75, 0.95), pose: 'dive', stiff: 16, damp: 0.95 }, () => {
          if (this._mode !== 'idle' || this._chat || this._guiding) return;
          this._setOff(to.x, deep);
          if (to.side !== H.side) this._crossedAt = now();
          this._home = to; this._arrivedAt = now();
          const up = this._tryFlight(to, { offscreen: true, shape: 'glide', bulge: 0.03, pace: 'smooth', dur: rand(1.05, 1.35), pose: 'wings', stiff: 11, damp: 0.76 });
          if (up) up.then(() => this._landed('peekaboo')); else this._setOff(to.x, to.y);
        });
      }
      return false;
    }
    /** Touching down after one of its flights, now and then with a little flourish. */
    _landed(kind) {
      if (this._mode !== 'idle' || this._chat || this._guiding) return;
      this.gesture('land');
      const r = Math.random();
      if (kind === 'peekaboo' || r < 0.18) setTimeout(() => this._mode === 'idle' && !this._fly && this._play('wave'), 420);
      else if (r < 0.32 && this._audience() !== 'admin') setTimeout(() => this._mode === 'idle' && !this._fly && this._play(pickFresh(SPINS[this._audience()], this._recentIdle, 2)), 380);
    }

    /** Watches this page's moments (see MOMENTS) that have not happened yet in this visit. */
    _watchMoments() {
      if (this._calm || !('IntersectionObserver' in window)) return;
      if (this._momentsIO) this._momentsIO.disconnect();
      const done = this._sess().moments || [], home = location.pathname === '/';
      const io = (this._momentsIO = new IntersectionObserver(entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const m = MOMENTS.find(([sel]) => e.target.matches(sel));
          io.unobserve(e.target);
          if (m && !(this._sess().moments || []).includes(m[0]) && !this._moment) this._moment = m;
        }
      }, { threshold: 0.35 }));
      for (const [sel, , homeOnly] of MOMENTS) {
        if (done.includes(sel) || (homeOnly && !home)) continue;
        const el = document.querySelector(sel);
        if (el) io.observe(el);
      }
    }

    // ---------- where it rests ----------
    /**
     * Its resting spots, as offsets from its corner (bottom right), most preferred first: three up the right, three up
     * the left.
     */
    _homes() {
      const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight, w = this.clientWidth, h = this.clientHeight;
      const edge = parseFloat(getComputedStyle(this).right) || 16, room = Math.max(0, vh - h - 110), left = -(vw - w - 2 * edge);
      const up = -Math.round(Math.min(vh * 0.24, room)), up2 = -Math.round(Math.min(vh * 0.48, room));
      const spots = [{ id: 'R', x: 0, y: 0 }, { id: 'R2', x: 0, y: up }, { id: 'R3', x: 0, y: up2 }];
      if (left < -w) spots.push({ id: 'L', x: left, y: 0 }, { id: 'L2', x: left, y: up }, { id: 'L3', x: left, y: up2 });
      // Leave the persistent drop target clear, including when a phone bar or footer lifts it.
      const d = this._dock.getBoundingClientRect(), b = this._stage.getBoundingClientRect(), hs = this._hit.style;
      const hx = parseFloat(hs.left) || 0, hy = parseFloat(hs.top) || 0;
      const hw = parseFloat(hs.width) || 0, hh = parseFloat(hs.height) || 0;
      return spots.map(spot => {
        const x = b.left - this._off.x + spot.x + hx, y = b.top - this._off.y + spot.y + hy;
        if (hw && hh && x < d.right + 12 && x + hw > d.left - 12 && y < d.bottom + 12 && y + hh > d.top - 12) {
          spot.y -= y + hh - d.top + 12;
        }
        return Object.assign(spot, { side: spot.x < 0 ? 'left' : 'right' });
      });
    }
    /**
     * Places along the bottom of the window between its two corners, from the side given inwards: where it may rest
     * when nowhere up either side is clear (a gap between cards, say), rather than peek from its corner.
     */
    _slots(side = 'right') {
      const L = this._homes().find(x => x.id === 'L');
      if (!L) return [];
      const n = Math.min(SLOTS_MAX + 1, Math.max(2, Math.round(-L.x / SLOT_STEP))), out = [];
      for (let i = 1; i < n; i++) { const x = Math.round((L.x * i) / n); out.push({ id: 'S' + i, x, y: 0, side: x < L.x / 2 ? 'left' : 'right', slot: true }); }
      return side === 'left' ? out.reverse() : out;
    }
    /** The spot it rests on as the spots are now (a resize moves them); a place along the bottom stands as it is. */
    _curSpot(spots) {
      const H = this._home, same = spots.find(x => x.id === H.id), L = spots.find(x => x.id === 'L');
      return same || (H.slot && L && H.x > L.x && H.x < 0 ? H : spots[0]);
    }
    _busyAt(spot, ignorePointer) { return this._coverOf(spot, ignorePointer).score; }
    /**
     * What Ixia would cover at a spot: `score`, how much of the page (something to click or type in weighs most, then
     * text and pictures; empty background nothing), and `ctl`, whether (or on how many points) that is something to
     * click. `visibleOnly` leaves out what would lie past the window's edge (for a corner it peeks from).
     */
    _coverOf(spot, ignorePointer, visibleOnly) {
      const hs = this._hit.style, hx = parseFloat(hs.left), hy = parseFloat(hs.top), hw = parseFloat(hs.width), hh = parseFloat(hs.height);
      if (!(hw > 0 && hh > 0)) return { score: 0, ctl: 0 };
      const b = this._stage.getBoundingClientRect(), x0 = b.left - this._off.x + spot.x + hx, y0 = b.top - this._off.y + spot.y + hy;
      const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight, cache = this._cache();
      let score = 0, ctl = 0;
      // Corner and bottom-slot rests must also leave the icon available as a drop target.
      const dock = this._dock.getBoundingClientRect();
      if (x0 < dock.right + 8 && x0 + hw > dock.left - 8 && y0 < dock.bottom + 8 && y0 + hh > dock.top - 8) {
        score += 12; ctl++;
      }
      // Never where the pointer is (or was a moment ago): that is where the person is looking and working.
      const P = this._ptr;
      if (!ignorePointer && P && now() - P.t < 8 && P.x > x0 - 40 && P.x < x0 + hw + 40 && P.y > y0 - 40 && P.y < y0 + hh + 40) score += 6;
      // Places it keeps clear of that the pointer passes through (the hub animation's brand), found by their boxes; a
      // brush with the edge of one weighs less than text, so it never rules out a spot on its own.
      const avoid = cache.avoid || (cache.avoid = [...document.querySelectorAll(AVOID)].map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0));
      // Twenty-eight points over its body, in seven rows about a line of text apart.
      for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) {
        const x = x0 + hw * (0.14 + 0.24 * i), y = y0 + hh * (0.06 + 0.147 * j);
        if (x < 0 || y < 0 || x >= vw || y >= vh) { if (!visibleOnly) score += 2; continue; }
        if (avoid.some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) { score += 0.5; continue; }
        const w = this._weigh(x, y);
        score += w; if (w === 3) ctl++;
      }
      // A link or a button small enough to fall between the points still counts, out to its ears and its hands (they
      // reach the edges of its box, and a little past them as it sways).
      if (!ctl) {
        const l = x0 - 4, r = x0 + hw + 4, t = Math.max(0, y0 + hh * 0.02), bt = Math.min(vh, y0 + hh * 0.97);
        if (bt > t && this._controls().some(q => q.left < r && q.right > l && q.top < bt && q.bottom > t)) { score += 3; ctl = 1; }
      }
      return { score, ctl };
    }
    /** What has been measured for one round of checks, kept until the page scrolls or a moment has passed. */
    _cache() {
      const t = now(), c = this._cc;
      if (c && c.y === scrollY && t - c.t < 0.3) return c;
      return (this._cc = { y: scrollY, t, lines: new Map(), ctl: null, avoid: null });
    }
    /** The boxes of the links, buttons and fields in the window (those that show and can be used). */
    _controls() {
      const c = this._cache();
      if (c.ctl) return c.ctl;
      const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight, out = [];
      for (const el of document.querySelectorAll(INTERACTIVE)) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
        if (el.closest('[inert], [aria-hidden="true"], mlh-intro') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue;
        out.push(r);
      }
      return (c.ctl = out);
    }
    /**
     * What lies at a point of the window: something to click or type in weighs 3, a picture or text 1, empty background
     * 0.
     */
    _weigh(x, y) {
      for (const el of document.elementsFromPoint(x, y)) {
        // (The opening intro's stage lies over the whole window while it plays; the page under it is what counts.)
        if (el === this || el === this._dimEl || el === this._ringEl || el === document.documentElement || el === document.body || el.closest('mlh-intro')) continue;
        if (el.closest(INTERACTIVE)) return 3;
        if (el.matches(MEDIA) || el.matches('svg') && el.getBoundingClientRect().width > 12) return 1;
        if (el.matches(TEXTY) ? el.textContent.trim() : [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
          // Text weighs where its lines are, not in the empty rest of its box (beside a short line, or in its padding):
          // there, what lies under it counts instead.
          if (this._onLine(el, x, y)) return 1;
          continue;
        }
        return 0;
      }
      return 0;
    }
    /** Whether a point lies on one of an element's lines of text (or within a few pixels of one). */
    _onLine(el, x, y) {
      const lines = this._cache().lines;
      let rects = lines.get(el);
      if (rects === undefined) {
        rects = [];
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
        for (let n = walk.nextNode(), k = 0; n; n = walk.nextNode()) {
          if (!n.textContent.trim()) continue;
          // (A long stretch of text, a whole article say, is taken as a block, as it would be read.)
          if (++k > 80) { rects = null; break; }
          range.selectNodeContents(n);
          for (const q of range.getClientRects()) if (q.width > 0 && q.height > 0) rects.push(q);
        }
        lines.set(el, rects);
      }
      return !rects || rects.some(q => x >= q.left - 4 && x <= q.right + 4 && y >= q.top - 4 && y <= q.bottom + 4);
    }
    /**
     * Tucked into a bottom corner (the right one, where it lives), with only the head showing: for when every spot
     * would cover the page. `deep`: sunk further, only its eyes and the top of its head showing, for a corner whose
     * head would sit over something to click (a grid of course cards, say).
     */
    _peekSpot(side, deep) {
      const w = this.clientWidth, h = this.clientHeight, left = side === 'left';
      const base = left ? this._homes().find(x => x.id === 'L') : null;
      return { id: (left ? 'PL' : 'P') + (deep ? 'd' : ''), x: left && base ? base.x - Math.round(w * 0.22) : Math.round(w * 0.22), y: Math.round(h * (deep ? 0.64 : 0.52)),
        side: left ? 'left' : 'right', peek: true };
    }
    /**
     * Whether it may tuck into a corner: not under reduced motion, nor while the footer's last row is in view (lifted
     * clear of that row, its head would sit on the row's links again).
     */
    _canPeek() { return !this._calm && !this.hasAttribute('data-near-footer'); }
    /** Whether the line on show is a passing remark that has finished and been up for a couple of seconds. */
    _read(t) {
      return !this._sayDone && !this._bubble.classList.contains('hint') && t - (this._saidAt || 0) > 2;
    }
    /**
     * The corner to peek from: the side given, unless the other is clearly better (nothing to click there where this
     * one has something, or a good deal less of the page), so it never swaps corners over a word or two.
     */
    _corner(side = 'right', crossOk = true) {
      // In each corner, sunk deeper where its head would cover something to click and its eyes alone cover less.
      const at = s => {
        const p = this._peekSpot(s), c = this._coverOf(p, true, true);
        if (!c.ctl) return [p, c];
        const d = this._peekSpot(s, true), dc = this._coverOf(d, true, true);
        return dc.ctl < c.ctl || (dc.ctl === c.ctl && dc.score < c.score) ? [d, dc] : [p, c];
      };
      const [mine, m] = at(side), other = side === 'right' ? 'left' : 'right';
      if (!crossOk || !this._homes().some(x => x.side === other)) return mine;
      const [alt, a] = at(other);
      return (m.ctl && !a.ctl) || a.score + 4 <= m.score ? alt : mine;
    }
    /**
     * A spot that covers nothing of the page: up its own side first, then along the bottom on its own half, then (with
     * `cross`) up the other side and along the rest of the bottom.
     */
    _clearSpot(side, cross, except) {
      const spots = this._homes(), slots = this._slots(side), ok = x => x.id !== except && this._busyAt(x) < MOVE_AT;
      return spots.filter(x => x.side === side).find(ok) || slots.filter(x => x.side === side).find(ok) ||
        (cross && (spots.filter(x => x.side !== side).find(ok) || slots.filter(x => x.side !== side).find(ok))) || null;
    }
    /**
     * Of the spots and the places along the bottom, the one that covers least of the page (something to click weighing
     * as three words), the one over fewer controls when two tie. Against `cur` (where it is) a move must be worth it: a
     * point or more better.
     */
    _leastBusy(spots, side, cross, cur, curC) {
      let best = cur || spots[0], bc = cur ? curC : null;
      for (const s of spots.concat(this._slots(side))) {
        if ((cur && s.id === cur.id) || (!cross && s.side !== side)) continue;
        const c = this._coverOf(s);
        if (!bc || c.score < bc.score - (best === cur ? 1 : 0) || (c.score === bc.score && c.ctl < bc.ctl)) { best = s; bc = c; }
      }
      return best;
    }
    /**
     * The best spot for this page right now: the first that covers nothing, or else the first that is clear enough, or
     * else a clear place along the bottom; failing those, peeking from the corner if its head covers less there than
     * the least covered spot would.
     */
    _pickHome(noPeek, ignorePointer) {
      let best = null, bc = null, near = null;
      for (const spot of this._homes()) {
        const c = this._coverOf(spot, ignorePointer);
        if (c.score === 0) return spot;
        if (!near && c.score < MOVE_AT) near = spot;
        if (!bc || c.score < bc.score) { best = spot; bc = c; }
      }
      if (near) return near;
      if (!best) return { id: 'R', x: 0, y: 0, side: 'right' };
      const slot = this._slots('right').find(x => this._busyAt(x, ignorePointer) < MOVE_AT);
      if (slot) return slot;
      if (noPeek || !this._canPeek()) return best;
      const corner = this._corner('right'), cc = this._coverOf(corner, ignorePointer, true);
      return cc.score < bc.score || (bc.ctl && !cc.ctl) ? corner : best;
    }
    /**
     * Moves when the spot it rests on covers the page; `force` also re-places it after a resize or on a new page (and
     * takes over a flight under way). It keeps to its own side while the page is read, crosses the window at most once
     * in CROSS_GAP, and never leaves a line being said.
     */
    _settle(force) {
      if (this._popping) { if (force) this._settleAgain = true; return; }
      // Out on a visit: the check is made as it comes back (see _flight), in place of the flight home.
      if (this._visiting) { this._settleAgain = true; return; }
      if (this._mode !== 'idle' || this._chat || this._guiding || this._leaving || this._opening || (this._fly && !force)) return;
      // An ordinary check waits for the pointer to leave, and for a hint (help it came out to offer) to be read; after a
      // resize it goes ahead, as Ixia may now be off the window.
      if (!force && (this._hover || this._bubble.classList.contains('hint'))) return;
      const t = now(), talking = this._bubble.classList.contains('show');
      // Checks are a few seconds apart, but a scroll since the last one always gets a fresh look.
      if (!force && t - (this._settledAt || 0) < 2.5 && scrollY === this._settledY) return;
      // A gesture under way plays out first (a flight would blend into it half way); the check comes again as it ends.
      // Re-placing (a new page, a resize) cannot wait so long: the gesture eases out, and the move follows it.
      const left = this._gestureLeft();
      if (left > 0.05 && !force) { clearTimeout(this._settleT); this._settleT = setTimeout(() => this._settle(), (left + 0.4) * 1000); return; }
      if (left > 0.35 && force) { this.stopGesture(); clearTimeout(this._resizeT); this._resizeT = setTimeout(() => this._settle(true), 340); return; }
      this._settledAt = t; this._settledY = scrollY;
      const reading = !talking && t - (this._scrollAt || -1e9) < READ_PAUSE;
      // A line being said, or only just said, is read where it was said.
      const saying = talking && !this._read(t);
      const spots = this._homes();
      if (this._home.peek) {
        // A remark already read gives way once the reader scrolls on.
        if (talking && this._read(t) && !this._chat && t - (this._scrollAt || -1e9) < 1.5) this.hush();
        // Out of the corner after a moment there and a pause in the reading; at once if its head is over something to
        // click (or the footer's last row has come into view, where it does not peek).
        const urgent = this._coverOf(this._home, true, true).ctl > 0 || !this._canPeek();
        if (!force && !urgent && (reading || saying || t - (this._arrivedAt || 0) < PEEK_HOLD)) return;
        // (Across the window at most once in CROSS_GAP, even from over a link: on a page of cards it would only find
        // more of them over there.)
        const side = this._home.side, crossOk = force || t - (this._crossedAt || -1e9) > CROSS_GAP;
        const out = this._clearSpot(side, crossOk);
        if (out) return this._moveHome(out);
        if (this._canPeek()) {
          const corner = this._corner(side, crossOk);
          if (force || corner.id !== this._home.id) this._moveHome(corner);
          return;
        }
        return this._moveHome(this._leastBusy(spots, side, crossOk));
      }
      const cur = this._curSpot(spots), c = this._coverOf(cur, true), here = c.score;
      // Where it actually is may differ from its spot (it drifts a little, and a resize moves the spots).
      const away = Math.hypot(cur.x - this._off.x, cur.y - this._off.y) > 2;
      // (The same spot keeps the same object: a visit or a pop waiting to come back to it knows it by name.)
      const keep = () => { if (this._home.id !== cur.id || this._home.x !== cur.x || this._home.y !== cur.y) this._home = cur; };
      if (here < MOVE_AT) {
        if (away && (force || this._busyAt({ x: this._off.x, y: this._off.y }, true) >= MOVE_AT)) this._moveHome(cur); else keep();
        return;
      }
      // Its spot covers the page. Saying a line, it stays to be read unless it covers something to click, and then
      // only hops up or down its own side.
      if (saying && !force) {
        const hop = c.ctl ? spots.find(x => x.side === cur.side && x.id !== cur.id && this._busyAt(x) < MOVE_AT) : null;
        if (hop) this._moveHome(hop);
        return;
      }
      const crossOk = force || t - (this._crossedAt || -1e9) > CROSS_GAP;
      // While the page is read: a hop up or down its own side (or along the bottom), or into its corner if its head
      // covers less there and nothing to click; otherwise it waits for a pause in the reading, unless it covers
      // something to click. Over a few words it first stays a while, so it does not hop with every scroll.
      if (reading && !force && !this._calm) {
        if (!c.ctl && t - (this._arrivedAt || 0) < PEEK_HOLD) return;
        const hop = this._clearSpot(cur.side, false, cur.id);
        if (hop) return this._moveHome(hop);
        if (this._canPeek()) {
          const corner = this._corner(cur.side, false), cc = this._coverOf(corner, true, true);
          if (!cc.ctl && cc.score < here) return this._moveHome(corner);
        }
        if (!c.ctl) return;
      }
      const next = this._clearSpot(cur.side, crossOk, cur.id);
      if (next) return this._moveHome(next);
      // Nowhere clear: into the corner if its head covers less there, and a passing remark ends rather than cover the
      // page (a hint stays); otherwise (under reduced motion, or with the footer in view) the spot that covers least.
      if (this._canPeek()) {
        const corner = this._corner(cur.side, crossOk), cc = this._coverOf(corner, true, true);
        if (cc.score < here || cc.ctl < c.ctl) { if (talking && this._read(t)) this.hush(); return this._moveHome(corner); }
      }
      const best = this._leastBusy(spots, cur.side, crossOk, cur, c);
      if (best.id !== cur.id || (force && away)) this._moveHome(best); else keep();
    }
    /**
     * Finds its spot once the page has stopped changing (a new page's lists and pictures arrive after it opens): 400 ms
     * after the last change to the page's content or size, and never more than `cap` seconds on.
     */
    _settleWhenStill(force, cap = 2.5) {
      clearTimeout(this._stillT);
      if (this._stillObs) this._stillObs.forEach(o => o.disconnect());
      const end = now() + cap, main = document.querySelector('main') || document.body;
      const done = () => {
        clearTimeout(this._stillT);
        if (this._stillObs) { this._stillObs.forEach(o => o.disconnect()); this._stillObs = null; }
        if (this._mode === 'hidden') this._placeDock(); else this._settle(force);
      };
      const bump = () => { clearTimeout(this._stillT); this._stillT = setTimeout(done, clamp((end - now()) * 1000, 0, 400)); };
      this._stillObs = [];
      try {
        const mo = new MutationObserver(bump); mo.observe(main, { childList: true, subtree: true }); this._stillObs.push(mo);
        const ro = new ResizeObserver(bump); ro.observe(main); this._stillObs.push(ro);
      } catch (e) { /* the timer alone */ }
      bump();
    }
    /** Where the chat opens: the bottom corner of the side Ixia rests on (its first spot there). */
    _chatSpot() {
      const spots = this._homes(), id = this._home.side === 'left' ? 'L' : 'R';
      return spots.find(x => x.id === id) || spots[0];
    }
    /** Up out of the corner into full view, straight above where it peeked (after a click while peeking). */
    _rise() {
      if (!this._home.peek) return Promise.resolve();
      return this._moveHome(this._chatSpot());
    }
    /** Glides to a new resting spot: no turning about on the way, only a lean into the flight, so it reads as calm. */
    _moveHome(spot) {
      if (spot.side !== this._home.side) this._crossedAt = now();
      this._home = spot; this._arrivedAt = now();
      if (this._mode !== 'idle') return Promise.resolve();
      const dist = Math.hypot(spot.x - this._off.x, spot.y - this._off.y);
      if (dist > 260 && !this._calm && !this._sleeping && this._faceName === 'neutral') this.face('happy', 1.2);
      this._holdActs(2.5, 5);
      return this._flyTo(spot.x, spot.y, false, { dur: clamp(0.75 + dist / 700, 0.95, 2.2) * rand(0.95, 1.15), gentle: this._sleeping, bulge: rand(0.04, 0.14) });
    }

    // ---------- tips and remarks ----------
    _sess() { try { return JSON.parse(sessionStorage.getItem(K_SESSION) || '{}'); } catch (e) { return {}; } }
    _sessSet(patch) { try { sessionStorage.setItem(K_SESSION, JSON.stringify(Object.assign(this._sess(), patch))); } catch (e) {} }
    // At most one per page and a few per session, never soon after another or while the visitor is busy: a tip for this
    // page if there is one, otherwise one of the remarks for this audience (encouragement, or a reason to join).
    _maybeTip(t) {
      // (Never begun in flight, nor in the middle of a gesture: the line waits for it to land and be still.)
      if (this.hasAttribute('quiet') || !this._isEngaged || this._greetPending || this._bubble.classList.contains('show') || this._fly || this._gestures.length || this._popping || this._visiting) return;
      const T = Object.assign({ firstAfter: 20, idle: 6, minGap: 120, perPage: 1, perSession: 3 }, this._cfg.tipTiming);
      // (The first remark comes as long after the greeting as after the page opened.)
      if (t - this._pageStart < T.firstAfter || t - (this._greetedAt || -1e9) < T.firstAfter || t - this._lastAct < T.idle || this._tipsHere >= T.perPage) return;
      const s = this._sess();
      if ((s.tips || 0) >= T.perSession || Date.now() - (s.lastTip || 0) < T.minGap * 1000) return;
      let seen = []; try { seen = JSON.parse(localStorage.getItem(K_SEEN) || '[]'); } catch (e) {}
      // A tip for this page that suits it as it is now, about something on the screen (it waits until that is in view).
      const tip = (this._cfg.tips || []).find(x => matchPath(x.path, location.pathname) && !seen.includes(x.id || x.text) && meets(x) &&
        (!x.target || (el => el && inView(el))(pick(x.target))));
      const said = s.said || [], fresh = (this._cfg.lines || []).filter(x => !said.includes(x)), line = !tip && fresh.length ? choice(fresh) : null;
      if (!tip && !line) return;
      if (tip) { seen.push(tip.id || tip.text); try { localStorage.setItem(K_SEEN, JSON.stringify(seen.slice(-200))); } catch (e) {} }
      this._sessSet({ tips: (s.tips || 0) + 1, lastTip: Date.now(), said: line ? said.concat(line) : said });
      this._tipsHere++;
      if (tip) return this.tip(tip);
      const learner = this._audience() === 'learner';
      this.emote(learner ? choice(['star', 'heart', 'sparkle']) : 'sparkle', 2);
      this.say(line, { gesture: learner ? 'hop' : 'nod', face: learner ? 'star' : 'happy', faceFor: 2.2 });
    }

    // ---------- guiding ----------
    async _showStep(step, i, n, token, opts) {
      const L = this._labels(), text = this._fill(String(step.say || '')), title = opts.title || '';
      const el = typeof step.target === 'string' ? pick(step.target) : step.target || null;
      clearTimeout(this._guideWait); this._tourEl.hidden = true; this._ring(null); this.stopGesture('point');
      this._guiding = { el, docked: true }; this._guideScrollY = null;
      this.hush();
      this._bubble.style.removeProperty('width'); this._lineSide = null;
      this._bubble.classList.add('touring'); this._x.hidden = false;
      this._asked.textContent = title; this._asked.hidden = !(n > 1 && title);
      let spot = null;
      if (el) {
        await this._reveal(el);
        if (token !== this._guideToken) return null;
        spot = this._calm ? null : this._spotFor(el);
        if (spot) {
          const travel = [].concat(L.travel || []);
          if (travel.length && Math.hypot(spot.x - this._off.x, spot.y - this._off.y) > 120) {
            this._travelN = ((this._travelN || 0) + 1) % travel.length;
            this.say(travel[this._travelN], { hold: Infinity, speed: 60 });
          }
          await this._flyTo(spot.x, spot.y);
          if (token !== this._guideToken) return null;
        }
        this._guideScrollY = scrollY;
        this._guiding.docked = !spot;
        this._bubbleOverride = spot ? spot.bubble : null; this._bubbleBelow = !!(spot && spot.below);
        this._guiding.anchor = { y: scrollY, top: el.getBoundingClientRect().top };
        this._followTarget(); this._startTrack();
        this._ring(el, typeof step.target === 'string' ? step.target : null);
        this.gesture('point', { at: el, dur: text.length / 36 + 2.6 });
      } else if (this._off.x !== this._home.x || this._off.y !== this._home.y) {
        await this._flyTo(this._home.x, this._home.y);
        if (token !== this._guideToken) return null;
      }
      this._count.textContent = n > 1 ? String(L.step).replace('{n}', i + 1).replace('{total}', n) : '';
      this._prev.textContent = L.back; this._prev.hidden = n === 1 || i === 0;
      this._next.textContent = n === 1 ? L.gotIt : i === n - 1 ? L.finish : L.next;
      await this.say(text, { hold: Infinity, speed: opts.speed });
      if (token !== this._guideToken) return null;
      this._tourEl.hidden = false; this._placeBubble();
      if (n > 1) this._next.focus({ preventScroll: true });
      return new Promise(res => {
        this._tourRes = res;
        if (n > 1) return;
        const hold = opts.hold != null ? opts.hold : Math.max(5000, text.length * 60 + 3500);
        const wait = () => { if (this._tourRes !== res) return; if (this._bubbleHover) { this._guideWait = setTimeout(wait, 600); return; } this._tourAct('timeout'); };
        this._guideWait = setTimeout(wait, hold);
      });
    }
    // Content can move without a scroll (text typing out, images loading): follow the element every frame while guiding.
    _startTrack() {
      cancelAnimationFrame(this._trackRaf);
      const g = this._guiding;
      if (!g || !g.el) return;
      const tick = () => {
        if (this._guiding !== g) return;
        const r = g.el.getBoundingClientRect(), k = [r.left, r.top, r.width, r.height].map(Math.round).join();
        // Pushed by content above while nobody scrolled: scroll back so the element stays where it was shown.
        if (g.anchor && !this._fly && Math.abs(scrollY - g.anchor.y) < 1 && Math.abs(r.top - g.anchor.top) > 60) {
          const goal = clamp(scrollY + r.top - g.anchor.top, 0, Math.max(0, document.documentElement.scrollHeight - innerHeight));
          g.anchor = { y: goal, top: g.anchor.top };
          scrollTo({ top: goal, behavior: this._calm ? 'auto' : 'smooth' });
        }
        if (k !== g.k) { g.k = k; this._followTarget(); }
        this._trackRaf = requestAnimationFrame(tick);
      };
      this._trackRaf = requestAnimationFrame(tick);
    }
    _tourAct(act) { const r = this._tourRes; this._tourRes = null; clearTimeout(this._guideWait); if (r) r(act); }
    _followTarget() {
      const g = this._guiding;
      if (!g || !g.el || this._fly || this._guideScrollY == null) return;
      const spot = this._calm || !inView(g.el) ? null : this._spotFor(g.el);
      if (spot) {
        if (g.docked) this._flyTo(spot.x, spot.y).then(() => this._followTarget()); else this._setOff(spot.x, spot.y);
        g.docked = false; this._bubbleOverride = spot.bubble; this._bubbleBelow = spot.below;
      } else if (!g.docked) { g.docked = true; this._bubbleOverride = null; this._bubbleBelow = false; this._flyTo(this._home.x, this._home.y); }
      this._placeBubble(); this._syncRing();
    }
    async _reveal(el) {
      // An element inside a scrolling strip or list is first brought into view within it.
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY) && (a.scrollWidth > a.clientWidth + 1 || a.scrollHeight > a.clientHeight + 1)) {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: this._calm ? 'auto' : 'smooth' });
          await sleep(this._calm ? 0 : 380);
          break;
        }
      }
      // Tall elements and every target on a narrow screen go near the top, leaving room for the robot below; whatever
      // is shown stays clear of the page's bar at the top and of a phone bar at the bottom.
      const r = el.getBoundingClientRect(), vh = innerHeight;
      const safe = (parseFloat(getComputedStyle(this).getPropertyValue('--robot-safe-top')) || 72) + 8;
      const foot = document.querySelector('[data-robot="phone-bar"]:not([inert])') && innerWidth < 1024 ? 96 : 70;
      const high = r.height > vh * 0.45 || innerWidth < 640, want = Math.max(safe + 8, vh * (r.height > vh * 0.45 ? 0.14 : 0.16));
      if (high ? Math.abs(r.top - want) < 48 : r.top >= safe && r.bottom <= vh - foot) return;
      const max = Math.max(0, document.documentElement.scrollHeight - vh);
      const goal = clamp(scrollY + r.top - (high ? want : vh * 0.38), 0, max);
      scrollTo({ top: goal, behavior: this._calm ? 'auto' : 'smooth' });
      await new Promise(res => {
        let last = scrollY, still = 0, n = 0, moved = false;
        const chk = () => {
          const y = scrollY; if (y !== last) moved = true;
          still = y === last ? still + 1 : 0; last = y;
          if (Math.abs(y - goal) < 2 || still > (moved ? 4 : 15) || ++n > 150) res(); else requestAnimationFrame(chk);
        };
        requestAnimationFrame(chk);
      });
    }
    _spotFor(el) {
      if (!this._px) return null;
      const r = focusRect(el), vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight, M = 8, w = this.clientWidth;
      const b = this._stage.getBoundingClientRect(), dock = { left: b.left - this._off.x, top: b.top - this._off.y };
      const bl = this._px(-235, 200).x, br = this._px(235, 200).x, top = this._px(0, 565).y, bot = this._px(0, 0).y;
      const shy = (this._sh.l.y + this._sh.r.y) / 2, cy = r.top + r.height / 2;
      const cy2 = y => clamp(y, M - top, vh - M - bot);
      const cands = [
        { x: r.right + 18 - bl, y: cy2(cy - shy + 34), bubble: 'right' },
        { x: r.left - 18 - br, y: cy2(cy - shy + 34), bubble: 'left' },
        { x: r.left + r.width / 2 - w / 2, y: cy2(r.bottom + 14 - top), bubble: 'right', below: true },
        { x: r.left + r.width / 2 - w / 2, y: cy2(r.top - 14 - bot), bubble: 'right' },
      ];
      // Of the places beside the element that fit the window and leave it uncovered, the one that covers least of the
      // rest of the page (a sticky panel beside a section, say), in this order when they tie.
      let best = null, least = Infinity;
      for (const c of cands) {
        if (c.x + bl < M || c.x + br > vw - M) continue;
        const o = { l: c.x + bl, r: c.x + br, t: c.y + top, b: c.y + bot };
        if (o.l < r.right && o.r > r.left && o.t < r.bottom && o.b > r.top) continue;
        const score = this._coverAt(o.l, o.t, o.r - o.l, o.b - o.t);
        if (score < least) { least = score; best = c; }
        if (!score) break;
      }
      return best && { x: best.x - dock.left, y: best.y - dock.top, bubble: best.bubble, below: !!best.below };
    }
    /** Flies to an offset from its corner. */
    _flyTo(x, y, instant, opts = {}) {
      // Sent away, only the corner button shows, and moving the robot's box would carry the button with it.
      if (this._mode === 'hidden' || this._mode === 'away') return Promise.resolve();
      const cur = this._fly ? this._flyState() : { x: this._off.x, y: this._off.y, vx: 0, vy: 0 };
      this._stopFly(cur);
      const dist = Math.hypot(x - cur.x, y - cur.y);
      if (instant || this._calm || dist < 1.5) { this._setOff(x, y); return Promise.resolve(); }
      // Unhurried: a little longer for a longer way, so it glides rather than darts across the window.
      const dur = opts.dur || clamp(0.7 + dist / 560, 0.95, 2.3);
      const plan = planFlight(cur, { x: cur.vx, y: cur.vy }, { x, y }, Object.assign({
        pace: opts.gentle ? 'lazy' : 'smooth', bulge: opts.gentle ? 0.05 : 0.1, stiff: opts.gentle ? 8 : 12, damp: opts.gentle ? 1 : 0.88,
      }, opts, { dur: dur * 0.84 }));
      return this._launch(plan, { x, y }, opts);
    }
    /** Flies through a list of offsets on a smooth curve, arms out all the way. */
    _flyPath(path, dur, opts = {}) {
      const cur = this._fly ? this._flyState() : { x: this._off.x, y: this._off.y, vx: 0, vy: 0 };
      this._stopFly(cur);
      const to = path[path.length - 1];
      if (this._calm) { this._setOff(to.x, to.y); return Promise.resolve(); }
      const plan = planFlight(cur, { x: cur.vx, y: cur.vy }, to, Object.assign({ shape: 'path', points: [cur].concat(path.slice(1)), pace: 'smooth', stiff: 14, damp: 0.85 }, opts, { dur: dur * 0.9 }));
      return this._launch(plan, to, Object.assign({ pose: 'loop' }, opts));
    }
    /** Plays a planned flight: an animation of its position on the compositor, followed frame by frame by _pose. */
    _launch(plan, to, opts) {
      return new Promise(res => {
        const n = plan.pts.length / 2, frames = [];
        for (let i = 0; i < n; i += 2) frames.push({ transform: `translate3d(${plan.pts[i * 2].toFixed(2)}px, ${plan.pts[i * 2 + 1].toFixed(2)}px, 0)`, offset: Math.min(1, (i * plan.step) / plan.dur) });
        if (frames[frames.length - 1].offset < 1) frames.push({ transform: `translate3d(${to.x}px, ${to.y}px, 0)`, offset: 1 });
        const anim = this._stage.animate(frames, { duration: plan.dur * 1000, easing: 'linear', fill: 'forwards' });
        const dir = to.x < this._off.x ? -1 : 1;
        const fly = (this._fly = Object.assign(plan, { anim, res, to, start: now(), gentle: !!opts.gentle, pose: opts.pose || (opts.gentle ? 'drift' : 'glide'), spin: opts.spin || 0, dir }));
        // Should no frame be drawn as it ends (a hidden tab, a lost 3D context), the flight still lands.
        anim.finished.then(() => { if (this._fly === fly) this._stopFly(to); }, () => {});
        this._kick();
      });
    }
    /** Where the flight has Ixia now, and how fast it is going (pixels a second). */
    _flyState(f = this._fly) {
      const at = f.anim && f.anim.currentTime != null ? f.anim.currentTime / 1000 : now() - f.start;
      const n = f.pts.length / 2, i = clamp(at / f.step, 0, n - 1), i0 = Math.floor(i), i1 = Math.min(n - 1, i0 + 1), k = i - i0;
      const x = f.pts[i0 * 2] + (f.pts[i1 * 2] - f.pts[i0 * 2]) * k, y = f.pts[i0 * 2 + 1] + (f.pts[i1 * 2 + 1] - f.pts[i0 * 2 + 1]) * k;
      const a = Math.max(0, i0 - 1), b = Math.min(n - 1, i0 + 2), dt = Math.max(1e-6, (b - a) * f.step);
      return { x, y, vx: (f.pts[b * 2] - f.pts[a * 2]) / dt, vy: (f.pts[b * 2 + 1] - f.pts[a * 2 + 1]) / dt, at, s: clamp(at / f.dur, 0, 1) };
    }
    /** Ends a flight where it is (or at `at`), settling its promise. */
    _stopFly(at) {
      const f = this._fly;
      if (!f) return;
      this._fly = null;
      if (at) this._setOff(at.x, at.y);
      if (f.anim) f.anim.cancel();
      f.res();
    }
    _setOff(x, y) {
      this._off = { x, y };
      // In flight it moves by fractions of a pixel, for smoothness; at rest it sits on whole device pixels, for sharpness.
      const k = this._fly ? 10 : window.devicePixelRatio || 1, px = Math.round(x * k) / k, py = Math.round(y * k) / k;
      if (px || py) this._stage.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      else this._stage.style.removeProperty('transform');
    }
    _endGuide(animate) {
      clearTimeout(this._guideWait);
      if (!this._guiding) return;
      this._guideToken++;
      this._tourAct(null);
      cancelAnimationFrame(this._trackRaf); this._trackRaf = 0;
      this._guiding = null; this._bubbleOverride = null; this._bubbleBelow = false; this._guideScrollY = null;
      this._ring(null); this.stopGesture('point'); this.hush();
      this._tourEl.hidden = true; this._bubble.classList.remove('touring');
      if (!this._chat) { this._x.hidden = true; this._asked.hidden = true; }
      this.style.removeProperty('z-index');
      this._flyTo(this._home.x, this._home.y, !animate);
      this._holdActs(4, 7);
      // Back on its spot, it checks a few seconds later whether the spot is still clear.
      this._settledAt = now();
    }
    /**
     * Marks an element for a moment: a fine ring of light draws in round it with a soft glow and a glint that runs once
     * about its edge, the page around it dims a touch, and both fade away after HIGHLIGHT_MS.
     */
    _ring(el, sel) {
      clearTimeout(this._ringT); cancelAnimationFrame(this._ringRaf);
      this._ringToken = (this._ringToken || 0) + 1;
      if (this._ringEl) { this._ringEl.remove(); this._ringEl = null; }
      if (this._dimEl) { this._dimEl.remove(); this._dimEl = null; }
      this._ringTarget = el || null; this._ringSel = typeof sel === 'string' ? sel : null;
      if (!el) return;
      const big = el.getBoundingClientRect(), large = big.height > innerHeight * 0.6 || big.width > innerWidth * 0.92;
      const token = this._ringToken, cs = getComputedStyle(this);
      const accent = cs.getPropertyValue('--robot-ring').trim() || cs.getPropertyValue('--robot-accent').trim() || '#00b4c8';
      const rad = (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) + RING_PAD;
      const tint = (pct) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`;
      if (this._cfg.spotlight !== false && !large) {
        const m = (this._dimEl = document.createElement('div'));
        m.setAttribute('aria-hidden', 'true'); m.setAttribute('data-robot-spotlight', '');
        m.style.cssText = `position:fixed;z-index:2147482998;pointer-events:none;border-radius:${rad}px;` +
          `box-shadow:0 0 0 200vmax ${cs.getPropertyValue('--robot-dim').trim() || 'rgba(8, 10, 22, .14)'}`;
        document.body.appendChild(m);
      }
      // The ring: a crisp hairline, a faint halo just outside it and a wide, soft glow.
      const d = (this._ringEl = document.createElement('div'));
      d.setAttribute('aria-hidden', 'true'); d.setAttribute('data-robot-ring', '');
      d.style.cssText = `position:fixed;z-index:2147482999;pointer-events:none;border-radius:${rad}px;` +
        `box-shadow:0 0 0 1.5px ${accent}, 0 0 0 5px ${tint(14)}, 0 0 30px 3px ${tint(30)}`;
      // The glint: a turning arc of light, seen only where it crosses the ring.
      const edge = document.createElement('div'), glint = document.createElement('div');
      edge.style.cssText = 'position:absolute;inset:-2px;border-radius:inherit;padding:2.5px;overflow:hidden;' +
        '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;' +
        'mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)';
      glint.style.cssText = 'position:absolute;left:50%;top:50%;width:var(--ring-diag);height:var(--ring-diag);translate:-50% -50%;opacity:0;' +
        `background:conic-gradient(transparent 0deg 240deg, ${tint(70)} 318deg, #ffffff 348deg, transparent 360deg)`;
      edge.appendChild(glint); d.appendChild(edge);
      document.body.appendChild(d);
      this._syncRing();
      // Kept on its element every frame while it shows (content reveals and moves without any scroll).
      const follow = () => { if (token !== this._ringToken || !this._ringEl) return; this._syncRing(); this._ringRaf = requestAnimationFrame(follow); };
      this._ringRaf = requestAnimationFrame(follow);
      if (!this._calm) {
        d.animate([{ opacity: 0, transform: 'scale(1.035)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.2, .8, .2, 1)' });
        glint.animate([{ rotate: '0turn', opacity: 0 }, { opacity: 1, offset: 0.14 }, { opacity: 1, offset: 0.78 }, { rotate: '1turn', opacity: 0 }],
          { duration: 1500, delay: 200, easing: 'cubic-bezier(.45, .05, .3, 1)' });
        if (this._dimEl) this._dimEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: 'ease-out' });
      }
      // Then it fades away; the step's words stay.
      this._ringT = setTimeout(() => {
        if (token !== this._ringToken) return;
        if (this._calm) return this._ring(null);
        const out = { opacity: [1, 0] }, o = { duration: 700, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' };
        if (this._dimEl) this._dimEl.animate(out, o);
        d.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.012)' }], o).finished
          .then(() => { if (token === this._ringToken) this._ring(null); }, () => {});
      }, HIGHLIGHT_MS);
    }
    _syncRing() {
      if (!this._ringTarget || !this._ringEl) return;
      // The element was replaced (a panel switched view, a form was sent): ring its successor, or fade away.
      if (!this._ringTarget.isConnected) {
        const again = this._ringSel && pick(this._ringSel);
        if (again) this._ringTarget = again;
        else { const d = this._ringEl; this._ringEl = null; this._ringTarget = null; d.animate({ opacity: [1, 0] }, { duration: 300, fill: 'forwards' }).finished.then(() => d.remove(), () => d.remove()); if (this._dimEl) { this._dimEl.remove(); this._dimEl = null; } return; }
      }
      const r = this._ringRect(this._ringTarget), p = RING_PAD;
      const box = { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + p * 2 + 'px', height: r.height + p * 2 + 'px' };
      Object.assign(this._ringEl.style, box);
      this._ringEl.style.setProperty('--ring-diag', Math.ceil(Math.hypot(r.width + p * 2, r.height + p * 2)) + 'px');
      if (this._dimEl) Object.assign(this._dimEl.style, box);
    }

    /**
     * The part of an element the ring goes round: all of it, or, for one taller than most of the window, the band at
     * its top where its heading is, kept inside the window below the page's bar.
     */
    _ringRect(el) {
      const r = el.getBoundingClientRect(), vh = innerHeight;
      if (r.height <= vh * 0.6) return r;
      const safe = (parseFloat(getComputedStyle(this).getPropertyValue('--robot-safe-top')) || 72) + 6;
      const top = clamp(r.top, safe, Math.max(safe, r.bottom - 140)), h = Math.min(r.bottom - top, Math.max(140, vh * 0.3));
      return { left: r.left, right: r.right, width: r.width, top, bottom: top + h, height: h };
    }

    // ---------- 3D ----------
    async _init() {
      const cfgUrl = this.getAttribute('config');
      const cfgP = cfgUrl ? fetch(cfgUrl).then(r => r.json()).then(c => this.configure(c)).catch(e => console.warn('[robot-companion] config', e)) : Promise.resolve();
      // Once the page has loaded, but never held up for long by its pictures (a slow one on a cold private window).
      await new Promise(r => { if (document.readyState === 'complete') return r(); addEventListener('load', r, { once: true }); setTimeout(r, LOAD_WAIT_MS); });
      // While the opening intro plays in its worker, the page's own thread is free: the 3D is set up then, unseen, and
      // Ixia flies in just after the intro lifts. Drawn on the page instead, the intro has the thread to itself until
      // it ends.
      const html = document.documentElement, intro = html.hasAttribute('data-intro');
      const introEnd = () => new Promise(r => { if (!html.hasAttribute('data-intro')) return r(); addEventListener('mlh:intro-end', r, { once: true }); setTimeout(r, 15000); });
      if (intro && !(window.__mlhStage && window.__mlhStage.worker)) await introEnd();
      // As the intro goes the page may gain a scroll bar (it was held still under it): a fresh look at its spot soon.
      if (intro) addEventListener('mlh:intro-end', () => { this._settledAt = 0; }, { once: true });
      // Never in the middle of a scroll: the setup takes a few frames' worth of work.
      await new Promise(r => {
        const evs = ['scroll', 'wheel', 'touchmove'], o = { passive: true, capture: true };
        let t = 0;
        const still = () => { clearTimeout(t); t = setTimeout(() => { evs.forEach(e => removeEventListener(e, still, o)); r(); }, 250); };
        evs.forEach(e => addEventListener(e, still, o));
        still();
      });
      const idle = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 600 }) : setTimeout(r, 120)));
      await idle();
      try {
        const THREE = (this.THREE = await import(this.getAttribute('three') || THREE_URL));
        const r = (this._renderer = this._makeRenderer(this._canvas));
        const scene = (this._scene = new THREE.Scene());
        scene.add(new THREE.HemisphereLight(0xffffff, 0xd3d9ea, 1.0));
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(800, 1660, 1000); key.target.position.set(0, 260, 0);
        const map = this._hand.matches ? 1024 : 2048;
        key.castShadow = true; key.shadow.mapSize.set(map, map); key.shadow.radius = 3;
        key.shadow.bias = -0.0004; key.shadow.normalBias = 3;
        Object.assign(key.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 200, far: 4000 });
        key.shadow.camera.updateProjectionMatrix();
        const fill = new THREE.DirectionalLight(0xeaf6ff, 0.5); fill.position.set(-5, 3, -4);
        // An aqua rim from behind and to the left, the site's accent light.
        const rim = new THREE.DirectionalLight(0x34cfe0, 1.1); rim.position.set(-700, 600, -900);
        scene.add(key, key.target, fill, rim);
        const rig = (this._rig = buildRobot(THREE));
        rig.blob = makeShadow(THREE);
        scene.add(rig.root, rig.blob);
        this.stats = { triangles: rig.triangles, meshes: rig.meshes };
        this._cam = new THREE.PerspectiveCamera(18, 1, 100, 10000);
        this._frame();
        await idle();
        // Shaders compile in the background where the browser can; elsewhere they compile at once, which avoids
        // three.js warning about the missing extension in the console.
        if (r.compileAsync && r.extensions.has('KHR_parallel_shader_compile')) await Promise.race([r.compileAsync(scene, this._cam).catch(() => {}), sleep(2500)]);
        else r.compile(scene, this._cam);
        new ResizeObserver(() => { this._frame(); this._kick(); }).observe(this);
        // Back to the tab after a while: the reader is here again (it never dozes off at once on an old idle clock),
        // and after a long while away it stretches.
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) { this._hiddenAt = now(); return; }
          this._visibleAt = now(); this._lastAct = now(); this._kick();
          if (now() - (this._hiddenAt || now()) > 60 && this._mode === 'idle' && !this._chat && !this._guiding && !this._calm) {
            if (this._sleeping) this._wake();
            this._soon(() => this._mode === 'idle' && !this._fly && this._play('stretch'), 700);
          }
        });
        const logo = this.getAttribute('logo') || LOGO;
        if (logo && logo !== 'none' && !logo.startsWith('__')) {
          const img = new Image();
          if (!logo.startsWith('data:')) img.crossOrigin = 'anonymous';
          img.onload = () => { addLogo(THREE, rig, img, r.capabilities.getMaxAnisotropy()); this._kick(); };
          img.src = logo;
        }
      } catch (err) {
        console.warn('[robot-companion] 3D unavailable — the bubble, tips and chat still work.', err);
        // What was built before the failure is let go, so nothing tries to draw with it and the corner button stands in.
        try { this._renderer?.dispose(); } catch (e) { /* the context is gone already */ }
        this._renderer = null; this._rig = null; this._scene = null;
      }
      await cfgP;
      if (html.hasAttribute('data-intro')) await this._afterLift();
      // Who is looking (and which pages are private) comes from the page: never in before it has said, unless it is
      // slow to (set up on its own, with no page to tell it).
      await Promise.race([this._configured, sleep(3000)]);
      this._down = !this._rig;
      this._ready();
      this._kick();
      let pend = null;
      try { pend = JSON.parse(sessionStorage.getItem(K_PENDING) || 'null'); sessionStorage.removeItem(K_PENDING); } catch (e) {}
      // A private page: Ixia stays out of sight until the reader moves on (see _checkAway).
      if (this._away || this._isPrivate()) { this._away = true; this._setMode('away'); return; }
      const tour = pend && pend.path === location.pathname && (pend.steps || pend.target) ? pend : null;
      // Hidden earlier in this visit, or no 3D here at all: the corner button stands in, and its chat still works.
      if (!this._rig) this._setMode('hidden');
      if (this._mode !== 'hidden') {
        await this._enter(tour ? 'quiet' : 'first');
        this._watchMoments();
      }
      // A tour explicitly requested on another page continues.
      if (tour) this.tour(tour.steps || [{ target: tour.target, say: tour.text || 'Here it is.' }], { title: tour.title });
    }

    _frame() {
      if (!this._renderer) return;
      const THREE = this.THREE, w = Math.max(1, this.clientWidth), h = Math.max(1, this.clientHeight), cam = this._cam;
      this._renderer.setSize(w, h, false);
      cam.aspect = w / h;
      const tan = Math.tan((cam.fov * Math.PI) / 360), d = Math.max(300 / tan, 345 / (tan * cam.aspect)) * 1.02;
      const target = new THREE.Vector3(0, 272, 0);
      cam.position.copy(target).add(new THREE.Vector3(0, 0.14, 1).normalize().multiplyScalar(d));
      cam.near = d * 0.5; cam.far = d * 2;
      cam.lookAt(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      const v = new THREE.Vector3();
      this._px = (x, y, z = 0) => { v.set(x, y, z).project(cam); return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h }; };
      const r = this._rig;
      this._head = this._px(0, 412);
      this._sh = { l: this._px(r.armL.position.x, r.armL.position.y + 12, r.armL.position.z), r: this._px(r.armR.position.x, r.armR.position.y + 12, r.armR.position.z) };
      const a = this._px(-215, 0), b = this._px(215, 560);
      Object.assign(this._hit.style, { left: a.x + 'px', top: b.y + 'px', width: b.x - a.x + 'px', height: a.y - b.y + 'px' });
      const top = this._px(0, 585);
      Object.assign(this._emotes.style, { left: top.x + 'px', top: top.y + 'px' });
      this._placeBubble();
    }

    _placeBubble() {
      const b = this._bubble;
      // While Ixia flies (and is not guiding), the bubble talks from above, centred and held inside the window, rather
      // than switching from one side to the other as the room beside it changes.
      let side = this._bubbleOverride || (this._fly && !this._guiding && !this._chat ? 'top' : this._lineSide || this.bubble);
      if (!this._px) { b.dataset.side = side; return; }
      const w = this.clientWidth, h = this.clientHeight, host = this._stage.getBoundingClientRect(), vw = document.documentElement.clientWidth || innerWidth;
      // Anchored well clear of the head's ears and the arms, so turning or waving never brings them under the bubble.
      const bw = b.offsetWidth, L = this._px(-250, 450), R = this._px(250, 450), T = this._px(0, 600), GAP = 8;
      const fitsL = host.left + L.x - GAP - bw >= 8, fitsR = host.left + R.x + GAP + bw <= vw - 8, strict = !!this._guiding;
      // A short window (a phone held sideways) has no room for the chat above Ixia: it opens beside it, from its foot.
      const low = this._chat && innerHeight < SHORT_WINDOW && (fitsL || fitsR);
      if (low) side = fitsL ? 'left' : 'right';
      if (side === 'left' && !fitsL) side = !strict && fitsR ? 'right' : 'top';
      if (side === 'right' && !fitsR) side = !strict && fitsL ? 'left' : 'top';
      // Standing below its target, the robot talks from underneath so the bubble never covers what it points at.
      if (side === 'top' && this._bubbleBelow && host.top + this._px(0, 0).y + 6 + b.offsetHeight <= innerHeight - 8) side = 'bottom';
      // A change of side while the bubble shows happens at once: gliding from one place to the other, it would sweep
      // across the screen and past its edge.
      if (b.dataset.side !== side && b.classList.contains('show')) {
        b.style.transition = 'none';
        cancelAnimationFrame(this._snapRaf);
        this._snapRaf = requestAnimationFrame(() => { this._snapRaf = requestAnimationFrame(() => b.style.removeProperty('transition')); });
      }
      b.dataset.side = side;
      b.style.left = b.style.right = b.style.top = '';
      if (side === 'bottom') {
        const cx = clamp(host.left + T.x, bw / 2 + 8, vw - bw / 2 - 8) - host.left;
        b.style.left = cx + 'px'; b.style.top = this._px(0, 0).y + 6 + 'px'; b.style.bottom = 'auto'; b.style.setProperty('--tail', T.x - cx + 'px');
      } else if (side === 'top') {
        const cx = clamp(host.left + T.x, bw / 2 + 8, vw - bw / 2 - 8) - host.left;
        b.style.left = cx + 'px'; b.style.bottom = h - T.y + 'px'; b.style.setProperty('--tail', T.x - cx + 'px');
      } else if (side === 'left') { b.style.right = w - L.x + GAP + 'px'; b.style.bottom = (low ? 0 : h - L.y) + 'px'; }
      else { b.style.left = R.x + GAP + 'px'; b.style.bottom = (low ? 0 : h - R.y) + 'px'; }
      // The height the bubble may grow into: above its anchor, or below it when it talks from underneath.
      const anchor = side === 'bottom' ? null : low ? host.top + h : host.top + (side === 'top' ? T.y : side === 'left' ? L.y : R.y);
      b.style.setProperty('--room', Math.round(anchor === null ? innerHeight - (host.top + this._px(0, 0).y + 6) : anchor) + 'px');
      // Last check, on the bubble as drawn: if any of it runs off the window (Ixia moved, or the text grew), it talks
      // from above instead, centred and held inside the window, or from below when there is no room above.
      if (!this._bubbleRetry && b.classList.contains('show')) {
        // (Under the site's nav counts as off the window.)
        const top = this._chat ? 6 : parseFloat(getComputedStyle(this).getPropertyValue('--robot-safe-top')) || 6;
        const br = b.getBoundingClientRect(), off = br.left < 6 || br.right > vw - 6 || br.top < top;
        if (off && side !== 'bottom' && !low) {
          const keepO = this._bubbleOverride, keepB = this._bubbleBelow;
          this._bubbleRetry = true;
          this._bubbleOverride = 'top'; this._bubbleBelow = br.top < top || side === 'top';
          this._placeBubble();
          this._bubbleOverride = keepO; this._bubbleBelow = keepB; this._bubbleRetry = false;
        }
      }
    }

    _kick() {
      this._busy = true; this._motion = 2;
      // Before its entrance one frame is drawn, unseen (so the first one seen is never slow); no more until it enters.
      if (this._mode === 'off' && this._t != null) return;
      if (!this._raf && this._rig && this._renderer && this._visible && this.isConnected) this._raf = requestAnimationFrame(this._loop);
    }
    /** Resolves a moment after the opening intro lifts (the dark opens and the page's entrances run), or at its end. */
    _afterLift() {
      const html = document.documentElement;
      return new Promise(r => {
        const s = html.getAttribute('data-intro');
        if (!s || s === 'lifting' || s === 'handoff') return r();
        const go = () => { removeEventListener('mlh:intro-lift', go); removeEventListener('mlh:intro-end', go); clearTimeout(cap); r(); };
        const cap = setTimeout(go, 15000);
        addEventListener('mlh:intro-lift', go); addEventListener('mlh:intro-end', go);
      }).then(() => sleep(Math.max(0, (this._liftAt || now()) + LIFT_WAIT - now()) * 1000));
    }

    _loop(ms) {
      this._raf = 0;
      if (!this._visible || !this.isConnected) return;
      this._raf = requestAnimationFrame(this._loop);
      // The first frame counts as one frame on from nothing, so the cap below never holds the very first drawing back.
      // The cap reads the time since the last drawing as it is; the pose moves on by it up to a tenth of a second, so a
      // long pause (a hidden tab) never makes it jump.
      const t = ms / 1000, since = this._t == null ? 1 / 60 : t - this._t, dt = Math.min(0.1, since);
      // As often as it needs, and no more (`_motion`, set after each drawing): a steady 60 frames a second (every other
      // frame on a faster screen) while some part of it crosses the screen faster than 75 pixels a second (a spin, a
      // dance, a wave) and as a move starts, so nothing quick looks stepped; 30 for slower moves (talk, a blink, a look,
      // a glide), and for anything while the page scrolls; 20 while it floats still (its sway and bob move a fraction of
      // a pixel a frame at that rate); 15 asleep. On a phone or a tablet, where it is drawn smaller, 60 only past 150
      // pixels a second (and not just because a move starts), 20 for slower moves, 12 still, 8 asleep, and none while
      // the page scrolls.
      const scrolling = !this._fly && now() - (this._scrollAt || -1e9) < 0.3, hand = this._hand.matches;
      // (On a phone or a tablet the page's own scrolling comes first: unless it is on the move, it is not drawn again
      // until the page comes to rest.)
      if (hand && scrolling && !this._busy) return;
      const motion = scrolling ? Math.min(this._motion || 0, 1) : this._motion || 0;
      // (Each bar sits well below a whole number of 60 Hz frames, so a frame that comes a hair early still counts and the
      // rhythm stays even: 30 is every other frame, 20 every third, 15 every fourth, 12 every fifth, 8 every eighth.)
      if (since < (motion === 2 ? 1 / 62 : hand ? (motion === 1 ? 1 / 23 : this._sleeping ? 1 / 9 : 1 / 13) : motion === 1 ? 1 / 45 : this._sleeping ? 1 / 17 : 1 / 23)) return;
      if (this._lost) return; // the browser took the 3D context away: nothing can be drawn until it comes back
      const peek = !!(this._home && this._home.peek);
      if (peek !== this._peekShown) { this._peekShown = peek; this.toggleAttribute('data-peek', peek); }
      this._t = t;
      this._apply(this._smooth(this._pose(t, dt), dt));
      // The shadows it casts on itself (a third of each drawing's cost) follow every frame while it moves quickly, and
      // every other frame otherwise, when they shift well under a pixel in between.
      this._shadowOdd = !this._shadowOdd;
      this._renderer.shadowMap.needsUpdate = motion === 2 || this._shadowOdd;
      try { this._renderer.render(this._scene, this._cam); this._renderFails = 0; } catch (err) {
        // A frame that cannot be drawn is tried again; a run of them hands over to the corner button.
        if (++this._renderFails >= 3) { console.warn('[robot-companion] drawing failed.', err); this._renderFails = 0; this._fallBack(); }
        return;
      }
      const speed = this._markSpeed(t);
      this._motion = (hand ? speed > 150 : this._fresh || speed > 75) ? 2 : this._busy ? 1 : 0;
      // In flight while it talks, the bubble rides above it, kept on the screen every frame.
      if (this._fly && this._bubble.classList.contains('show')) this._placeBubble();
      // Seen only once its entrance has begun (it starts out of sight): never first in its corner, then gone, then back.
      if (!this._shown && this._mode !== 'off') {
        this._shown = true; this._canvas.classList.add('on'); this.setAttribute('data-drawn', '');
        this.dispatchEvent(new CustomEvent('robot-ready', { bubbles: true, composed: true }));
      }
      if (this._mode === 'off' || (this._calm && !this._busy)) { cancelAnimationFrame(this._raf); this._raf = 0; }
    }

    /**
     * How fast, in CSS pixels a second, the quickest of the rig's marks moved on the screen since the last drawing, from
     * the matrices that drawing has just brought up to date.
     */
    _markSpeed(t) {
      const r = this._rig, marks = r.marks, prev = this._markAt || (this._markAt = marks.map(() => [0, 0]));
      const size = this._renderer.getSize(this._markSize || (this._markSize = new this.THREE.Vector2()));
      const v = this._markV || (this._markV = new this.THREE.Vector3());
      const gap = t - (this._markT ?? -1);
      let most = 0;
      for (let i = 0; i < marks.length; i++) {
        v.copy(marks[i][1]).applyMatrix4(marks[i][0].matrixWorld).project(this._cam);
        const x = (v.x * size.x) / 2, y = (v.y * size.y) / 2, q = prev[i];
        if (gap > 0 && gap < 0.2) most = Math.max(most, Math.hypot(x - q[0], y - q[1]) / gap);
        q[0] = x; q[1] = y;
      }
      this._markT = t;
      return most;
    }

    _pose(t, dt) {
      const live = this._calm ? 0 : 1;
      // At rest it floats: a slow bob, a little sway and a gentle turn, slower and lower while it dozes.
      this._sleepAmt = (this._sleepAmt || 0) + ((this._sleeping ? 1 : 0) - (this._sleepAmt || 0)) * (1 - Math.exp(-dt * 1.4));
      const sleepy = this._sleepAmt;
      this._bobPh = (this._bobPh || 0) + dt * (1.35 - 0.45 * sleepy);
      const bob = Math.sin(this._bobPh) * live;
      // It never hangs quite still: a slow, uneven sway from side to side, as if on a light breeze.
      const sway = (14 * Math.sin(t * 0.37 + 0.6) + 8 * Math.sin(t * 0.61 + 2.1)) * live * (1 - 0.6 * sleepy);
      const p = { sx: sway, spin: 0.07 * Math.sin(t * 0.47) * live, lift: 15 + (8 - 4 * sleepy) * bob, lean: 0.016 * Math.sin(t * 0.83) * live - sway * 0.0012, hx: 0.06 * sleepy, hy: 0, hz: 0,
        lx: 0, lz: (0.06 + 0.04 * Math.sin(t * 1.35 + 0.8)) * live, rx: 0, rz: (0.06 + 0.04 * Math.sin(t * 1.35 + 1.5)) * live, eye: 1, ex: 0, ey: 0, mouth: 1, squash: 0, flip: 0, wheel: 0 };
      // Whether anything moves (talk, a blink, a look, a flight, a gesture), and whether a flight or gesture has only
      // just started, before its speed shows (see _loop).
      let busy = false, fresh = false;
      const away = this.look === 'none' || t - this._lastMove > 4 || this._fly || this._sleeping;
      const tx = away ? 0 : this._lkT.x, ty = away ? 0 : this._lkT.y, k = 1 - Math.exp(-dt * 4.5);
      this._lk.x += (tx - this._lk.x) * k; this._lk.y += (ty - this._lk.y) * k;
      if (Math.abs(tx - this._lk.x) + Math.abs(ty - this._lk.y) > 0.004) busy = true;
      p.hy += this._lk.x * 0.42 * live; p.hx += this._lk.y * 0.2 * live; p.ex += this._lk.x * 9; p.ey -= this._lk.y * 6;
      // Looks down as the page scrolls down and up as it scrolls up, easing into the glance and out of it again.
      this._tiltT *= Math.exp(-dt * 2.6);
      this._tilt += (this._tiltT - this._tilt) * (1 - Math.exp(-dt * 7));
      if (Math.abs(this._tilt) > 0.01 || Math.abs(this._tiltT) > 0.01) { busy = true; p.hx += 0.14 * this._tilt * live; p.ey -= 5 * this._tilt * live; }
      const hv = this._hover ? 1 : 0;
      this._hoverAmt += (hv - this._hoverAmt) * (1 - Math.exp(-dt * 8));
      if (Math.abs(hv - this._hoverAmt) > 0.01) busy = true;
      p.hz += 0.07 * this._hoverAmt * live; p.lift += 6 * this._hoverAmt * live;
      this._talkAmt += ((this._talking ? 1 : 0) - this._talkAmt) * (1 - Math.exp(-dt * 14));
      if (this._talkAmt > 0.01) {
        busy = true;
        const o = Math.abs(Math.sin(t * 15.5)) * (0.65 + 0.35 * Math.sin(t * 4.3 + 1));
        p.mouth += (0.3 + 0.95 * o - 1) * this._talkAmt;
        p.hx += 0.022 * Math.sin(t * 7.7) * this._talkAmt; p.hz += 0.012 * Math.sin(t * 3.1) * this._talkAmt;
      }
      const f = this._fly;
      if (f) {
        busy = true;
        const st = this._flyState(f), s = st.s;
        if (st.at < 0.25) fresh = true;
        // The animation moves it on the screen; this is where the rest of Ixia's logic takes it to be.
        this._off = { x: st.x, y: st.y };
        const out = Math.sin(Math.PI * s) ** 2, P = FLIGHT_POSES[f.pose] || FLIGHT_POSES.glide;
        if (P.lead) {
          // The arm on the side it is heading for reaches out ahead to show the way; the other trails a little.
          const lead = f.dir > 0 ? 'r' : 'l';
          p[lead + 'z'] += P.lead * out; p[(lead === 'r' ? 'l' : 'r') + 'z'] += P.trail * out;
        } else { p.lz += P.lz * out; p.rz += P.rz * out; }
        p.lx += P.lx * out; p.rx += P.rx * out; p.hx += P.hx * out; p.lift += P.lift * out;
        // Whole turns on the way, eased in and out in the middle of the flight.
        if (f.spin) p.spin += Math.PI * 2 * f.spin * smoother(clamp((s - 0.12) / 0.76, 0, 1));
        // Its speed: it leans and looks the way it travels, by how fast, so a curve or a change of course banks smoothly.
        const k = 1 - Math.exp(-dt * 16);
        this._vel.x += (st.vx - this._vel.x) * k; this._vel.y += (st.vy - this._vel.y) * k;
        // Done when the animation says so: Safari reports its time to the microsecond, a hair short of the planned length.
        if (st.at >= f.dur - 0.002 || (f.anim && f.anim.playState === 'finished')) this._stopFly(f.to);
      } else { const d = Math.exp(-dt * 9); this._vel.x *= d; this._vel.y *= d; }
      const bank = clamp(this._vel.x / 900, -1, 1) * (f && f.gentle ? 0.45 : 1);
      if (Math.abs(bank) > 0.002) { busy = true; p.lean -= 0.18 * bank; p.hy += 0.32 * bank; }
      for (let i = this._gestures.length - 1; i >= 0; i--) {
        const g = this._gestures[i], lt = t - g.start, w = g.kill ? 1 - sm((t - g.kill) / 0.3) : 1;
        if (lt >= g.D || w <= 0) { this._gestures.splice(i, 1); g.res(!g.kill); continue; }
        busy = true;
        if (lt < 0.25) fresh = true;
        const d = g.def.fn(Math.max(0, lt), g.o, g.D);
        // Cut short mid-turn, a spin settles the short way round (a whole turn looks the same), never unwinding at speed.
        if (g.kill && d.spin) d.spin = d.spin - Math.PI * 2 * Math.round(d.spin / (Math.PI * 2));
        for (const key in d) p[key] += d[key] * w;
      }
      // Faces: back to the usual one when the time is up; each change is made behind a quick blink.
      if (t > this._faceUntil) { this._faceName = this._sleeping ? 'sleepy' : 'neutral'; this._faceUntil = Infinity; if (this._faceName !== this._faceShown && this._faceSwap < 0) this._faceSwap = t; }
      if (this._faceSwap >= 0) {
        busy = true;
        const s = (t - this._faceSwap) / 0.2;
        if (s >= 0.5 && this._faceShown !== this._faceName) this._faceShown = this._faceName;
        if (s >= 1) { this._faceSwap = this._faceShown !== this._faceName ? t : -1; }
        else p.eye *= 1 - 0.92 * Math.sin(Math.PI * clamp(s, 0, 1));
      }
      if (t > this._blinkNext) { this._blinkAt = t; this._blinkNext = t + (Math.random() < 0.2 ? 0.35 : 2.2 + Math.random() * 4); }
      const bk = (t - this._blinkAt) / 0.17;
      if (bk > 0 && bk < 1 && this._faceShown !== 'sleepy') { busy = true; p.eye *= 1 - 0.94 * Math.sin(bk * Math.PI); }
      this._busy = busy; this._fresh = fresh;
      return p;
    }

    /**
     * Eases the body's pose towards the one just worked out (eyes and mouth stay crisp), so whatever starts, stops or
     * changes course, nothing snaps: about 30 ms to close half the gap, which keeps dances lively.
     */
    _smooth(p, dt) {
      const s = this._ps, k = 1 - Math.exp(-dt * 30);
      if (!s || this._calm) { this._ps = Object.assign({}, p); return p; }
      for (const key of ['sx', 'lift', 'lean', 'hx', 'hy', 'hz', 'lx', 'lz', 'rx', 'rz', 'squash']) s[key] += (p[key] - s[key]) * k;
      // A turn is followed the short way round: a twirl that ends on two whole turns looks the same as none, so its end
      // must never read as two turns to unwind.
      const turn = p.spin - s.spin;
      s.spin += (turn - Math.PI * 2 * Math.round(turn / (Math.PI * 2))) * k;
      return Object.assign({}, p, { sx: s.sx, spin: s.spin, lift: s.lift, lean: s.lean, hx: s.hx, hy: s.hy, hz: s.hz, lx: s.lx, lz: s.lz, rx: s.rx, rz: s.rz, squash: s.squash });
    }

    _apply(p) {
      const r = this._rig, e = r.eyeBase, ex = clamp(p.ex, -14, 14), ey = clamp(p.ey, -9, 9), F = FACES[this._faceShown] || FACES.neutral;
      r.root.position.x = p.sx || 0; r.root.position.y = p.lift; r.root.position.z = 0;
      r.root.rotation.set(0, p.spin, p.lean);
      // A somersault or a cartwheel turns about the body's middle, not its feet.
      if (p.flip) { r.root.rotation.x = p.flip; r.root.position.y += BODY_MID * (1 - Math.cos(p.flip)); r.root.position.z -= BODY_MID * Math.sin(p.flip); }
      if (p.wheel) { r.root.rotation.z += p.wheel; r.root.position.x += BODY_MID * Math.sin(p.wheel); r.root.position.y += BODY_MID * (1 - Math.cos(p.wheel)); }
      const sq = clamp(p.squash, -0.12, 0.16);
      r.root.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      // Soft limits: the head eases into the end of its turn rather than stopping dead.
      const soft = (v, lim) => lim * Math.tanh(v / lim);
      r.head.rotation.set(p.hx < 0 ? soft(p.hx, 0.35) : soft(p.hx, 0.3), soft(p.hy, 0.65), soft(p.hz, 0.3));
      r.armL.rotation.set(p.lx, 0, -p.lz);
      r.armR.rotation.set(p.rx, 0, p.rz);
      // Which eye and mouth shapes show for this face, and how they are scaled.
      const es = F.es || [1, 1], ms = F.ms || [1, 1];
      for (const [k, variant, tilt] of [['L', F.eyes, F.tilt || 0], ['R', F.right || F.eyes, -(F.tilt || 0)]]) {
        const set = r.faces[k];
        for (const name in set) set[name].visible = name === variant;
        const pivot = r['eye' + k], sc = k === 'R' && F.esR ? F.esR : es;
        pivot.scale.set(sc[0], clamp(p.eye * sc[1], 0.06, 1.3), 1);
        pivot.rotation.z = tilt;
      }
      r.eyeL.position.x = e.l + ex; r.eyeR.position.x = e.r + ex; r.eyeL.position.y = r.eyeR.position.y = e.y + ey;
      for (const name in r.faces.mouth) r.faces.mouth[name].visible = name === F.mouth;
      r.mouth.scale.set(ms[0], clamp(p.mouth, 0.2, 1.3) * ms[1], 1);
      r.mouth.rotation.z = (F.flip ? Math.PI : 0) + (F.mt || 0);
      // The shadow tightens and darkens as Ixia sinks, and spreads and fades as it rises.
      const h = Math.max(0, p.lift - 8);
      r.blob.scale.setScalar(clamp(1.04 - h / 170, 0.5, 1.06)); r.blob.material.opacity = clamp(1.05 - h / 85, 0.28, 1); r.blob.position.x = p.sx || 0;
    }

    _opts(name, o) {
      let side = o.side === 'left' || o.side === 'right' ? o.side : null, angle = Math.PI / 2, up = 0, pitch = -0.04;
      const el = typeof o.at === 'string' ? pick(o.at) : o.at;
      if (el && el.getBoundingClientRect && this._sh) {
        const b = focusRect(el), c = this._canvas.getBoundingClientRect();
        const tx = b.left + b.width / 2, ty = b.top + b.height / 2;
        side = side || (tx < c.left + (this._sh.l.x + this._sh.r.x) / 2 ? 'left' : 'right');
        const s = side === 'left' ? this._sh.l : this._sh.r, sx = c.left + s.x, sy = c.top + s.y;
        const a = Math.atan2(sy - ty, Math.max(8, side === 'left' ? sx - tx : tx - sx));
        angle = a + Math.PI / 2; up = Math.sign(sy - ty); pitch = clamp(-a * 0.32, -0.24, 0.16);
      }
      const away = this.bubble === 'right' ? 'left' : 'right';
      side = side || (name === 'point' ? (away === 'left' ? 'right' : 'left') : away);
      return { s: side[0], dir: side === 'left' ? -1 : 1, angle: clamp(angle - this._rig.armBias, 0.55, 2.0), up, pitch };
    }
  }

  customElements.define('robot-companion', RobotCompanion);
})();
