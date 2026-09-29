(() => {
  "use strict";

  // ────────────────────────────────────────────────────────────────────────────
  // Neon Serpents — a dependency-free canvas game made for GitHub Pages.
  // ────────────────────────────────────────────────────────────────────────────

  const canvas = document.querySelector("#game");
  // `desynchronized` lets supported browsers present frames with less latency.
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const minimap = document.querySelector("#minimap");
  const mini = minimap.getContext("2d");

  const ui = {
    menu: document.querySelector("#menu"),
    form: document.querySelector("#start-form"),
    nickname: document.querySelector("#nickname"),
    skinButton: document.querySelector("#skin-btn"),
    skinPreview: document.querySelector("#skin-preview"),
    hud: document.querySelector("#hud"),
    score: document.querySelector("#score"),
    best: document.querySelector("#best"),
    leaders: document.querySelector("#leader-list"),
    boostFill: document.querySelector("#boost-fill"),
    boostPercent: document.querySelector("#boost-percent"),
    pauseButton: document.querySelector("#pause-btn"),
    soundButton: document.querySelector("#sound-btn"),
    pauseScreen: document.querySelector("#pause-screen"),
    resumeButton: document.querySelector("#resume-btn"),
    quitButton: document.querySelector("#quit-btn"),
    gameover: document.querySelector("#gameover"),
    deathTitle: document.querySelector("#death-title"),
    finalScore: document.querySelector("#final-score"),
    finalLength: document.querySelector("#final-length"),
    finalFood: document.querySelector("#final-food"),
    finalTime: document.querySelector("#final-time"),
    againButton: document.querySelector("#again-btn"),
    menuButton: document.querySelector("#menu-btn"),
    status: document.querySelector("#status-message"),
    joystick: document.querySelector("#mobile-joystick"),
    joystickKnob: document.querySelector(".joystick-knob"),
    mobileBoost: document.querySelector("#mobile-boost")
  };

  const TAU = Math.PI * 2;
  const WORLD_RADIUS = 2260;
  // These counts keep the arena busy without making lower-powered laptops draw
  // thousands of glowing objects every frame.
  const FOOD_TARGET = 430;
  const FOOD_MAX = 560;
  const BOT_TARGET = 10;
  const SKINS = [
    { name: "Arctic", main: "#2cf7ff", light: "#b8ffff", dark: "#1689df", pattern: "#566aff" },
    { name: "Plasma", main: "#ff43d1", light: "#ffd2f3", dark: "#9b25e8", pattern: "#ff784c" },
    { name: "Venom", main: "#93ff43", light: "#eaffad", dark: "#20b96c", pattern: "#dcff3f" },
    { name: "Solar", main: "#ffbf35", light: "#fff0a2", dark: "#ff5e3a", pattern: "#ffde59" },
    { name: "Nova", main: "#8b68ff", light: "#eadcff", dark: "#4c46e7", pattern: "#ff57e6" },
    { name: "Crimson", main: "#ff4f67", light: "#ffd4d8", dark: "#c5185d", pattern: "#ff9c3f" }
  ];
  const BOT_NAMES = [
    "Vortex", "Pixel Fang", "NightByte", "Nova", "Glitch", "Hypercoil",
    "Venom.exe", "Comet", "Zero", "Astro", "Shockwave", "ByteBite",
    "Specter", "Solaris", "Noodle King", "Orbit", "Neon Wasp", "Titan"
  ];
  const FOOD_COLORS = ["#2cf7ff", "#7f6dff", "#ff4cc9", "#94ff53", "#ffcc4a", "#50a6ff"];

  let W = innerWidth;
  let H = innerHeight;
  let dpr = 1;
  let backgroundGradient = null;
  let screenVignette = null;
  let state = "menu"; // menu | playing | paused | dead
  let lastTime = performance.now();
  let elapsed = 0;
  let player = null;
  let snakes = [];
  let foods = [];
  let particles = [];
  let floatingText = [];
  let skinIndex = Number(localStorage.getItem("neon-serpents-skin") || 0) % SKINS.length;
  let bestScore = Number(localStorage.getItem("neon-serpents-best") || 0);
  let uiTimer = 0;
  let miniTimer = 0;
  let collisionTimer = 0;
  let botSpawnQueue = [];
  let shake = 0;
  let flash = 0;
  let statusTimer = 0;
  let pointer = { x: W * .7, y: H * .5, down: false };
  let keys = Object.create(null);
  let touchAngle = null;
  let joystickPointer = null;
  let mobileBoosting = false;
  let soundOn = localStorage.getItem("neon-serpents-sound") !== "off";
  let lowDetail = ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4);
  let fpsAverage = 60;
  let fpsFrames = 0;
  let fpsTime = 0;
  let slowTime = 0;
  let fastTime = 0;

  const camera = { x: 0, y: 0, zoom: .92, targetZoom: .92 };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const choose = arr => arr[(Math.random() * arr.length) | 0];
  const distanceSq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const normalizeAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const mixAngle = (a, b, amount) => a + normalizeAngle(b - a) * amount;
  const formatNumber = n => Math.floor(n).toLocaleString("en-US");
  const escapeHtml = text => String(text).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);

  function resize() {
    W = innerWidth;
    H = innerHeight;
    // A 2× or 3× display can otherwise require 4–9 times more pixels per frame.
    dpr = Math.min(devicePixelRatio || 1, lowDetail ? 1 : 1.25);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    backgroundGradient = ctx.createRadialGradient(W * .5, H * .42, 0, W * .5, H * .5, Math.max(W, H) * .8);
    backgroundGradient.addColorStop(0, "#0c1640");
    backgroundGradient.addColorStop(.52, "#070d27");
    backgroundGradient.addColorStop(1, "#030611");
    screenVignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.max(W, H) * .72);
    screenVignette.addColorStop(0, "rgba(0,0,0,0)");
    screenVignette.addColorStop(1, "rgba(0,2,10,.43)");
  }

  // Small WebAudio synth: no audio files are needed.
  const audio = {
    context: null,
    master: null,
    init() {
      if (this.context) return;
      try {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.context.createGain();
        this.master.gain.value = .13;
        this.master.connect(this.context.destination);
      } catch (_) { soundOn = false; }
    },
    tone(freq = 440, duration = .08, type = "sine", volume = .18, slide = 0) {
      if (!soundOn) return;
      this.init();
      if (!this.context) return;
      if (this.context.state === "suspended") this.context.resume();
      const now = this.context.currentTime;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + .008);
      gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + .02);
    },
    eat(value) { this.tone(300 + value * 38, .055, "sine", .13, 90); },
    boost() { this.tone(85, .12, "sawtooth", .045, 40); },
    crash() { this.tone(180, .6, "sawtooth", .26, -130); this.tone(70, .75, "square", .12, -25); },
    click() { this.tone(520, .07, "sine", .12, 100); }
  };

  class Food {
    constructor(x, y, value = null, color = null) {
      this.x = x;
      this.y = y;
      this.value = value ?? (Math.random() < .055 ? 5 : Math.random() < .18 ? 3 : 1);
      this.radius = this.value === 5 ? 7.5 : this.value === 3 ? 5.5 : rand(2.8, 4.4);
      this.color = color || choose(FOOD_COLORS);
      this.phase = rand(0, TAU);
      this.alive = true;
      this.vx = 0;
      this.vy = 0;
    }
    update(dt) {
      this.phase += dt * (2 + this.value * .2);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= Math.pow(.05, dt);
      this.vy *= Math.pow(.05, dt);
    }
  }

  class Particle {
    constructor(x, y, color, options = {}) {
      this.x = x;
      this.y = y;
      const angle = options.angle ?? rand(0, TAU);
      const speed = options.speed ?? rand(25, 155);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = options.life ?? rand(.3, .8);
      this.maxLife = this.life;
      this.size = options.size ?? rand(1.5, 5);
      this.color = color;
      this.drag = options.drag ?? 2.8;
    }
    update(dt) {
      this.life -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const drag = Math.exp(-this.drag * dt);
      this.vx *= drag;
      this.vy *= drag;
      return this.life > 0;
    }
    draw() {
      const a = clamp(this.life / this.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (.3 + a * .7), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  class Snake {
    constructor({ x, y, angle = rand(0, TAU), skin = choose(SKINS), name = "Bot", bot = true, length = 55, giant = false }) {
      this.id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      this.bot = bot;
      this.isGiant = giant;
      this.name = name;
      this.skin = skin;
      this.angle = angle;
      this.targetAngle = angle;
      this.radius = giant ? 21 : 12.4;
      this.baseSpeed = giant ? rand(108, 118) : (bot ? rand(126, 143) : 142);
      this.speed = this.baseSpeed;
      this.boost = 100;
      this.boosting = false;
      this.alive = true;
      this.alpha = 1;
      this.score = Math.max(0, Math.round((length - 30) * 7));
      this.foodEaten = 0;
      this.maxLength = length;
      this.targetLength = length;
      this.segments = [];
      this.aiTimer = rand(0, .16);
      this.aiWander = rand(-1, 1);
      this.aiMood = giant ? rand(.82, 1) : Math.random();
      this.shedTimer = 0;
      this.hitPulse = 0;
      this.spawnShield = giant ? 2.8 : (bot ? .9 : 1.3);
      this.killer = "";
      let segmentX = x;
      let segmentY = y;
      const spawnCurve = giant ? (Math.random() < .5 ? -.008 : .008) : 0;
      for (let i = 0; i < length; i++) {
        this.segments.push({ x: segmentX, y: segmentY });
        const bodyAngle = angle + spawnCurve * i;
        segmentX -= Math.cos(bodyAngle) * this.radius * .66;
        segmentY -= Math.sin(bodyAngle) * this.radius * .66;
      }
    }

    get head() { return this.segments[0]; }
    get lengthScore() { return Math.round(this.segments.length * 10 + this.score); }

    update(dt) {
      if (!this.alive) return;
      this.spawnShield = Math.max(0, this.spawnShield - dt);
      this.hitPulse = Math.max(0, this.hitPulse - dt * 3);

      if (this.bot) this.think(dt);
      else this.readPlayerInput();

      // Snakes become thicker as they grow; titans have a much higher cap.
      const radiusTarget = clamp(11.8 + Math.max(0, this.segments.length - 35) * .027, 11.8, this.isGiant ? 25 : 18.5);
      this.radius = lerp(this.radius, radiusTarget, 1 - Math.exp(-1.8 * dt));

      const lengthPenalty = clamp((this.segments.length - 35) / 350, 0, .22);
      const wantsBoost = this.boosting && this.boost > 1 && this.segments.length > 30;
      const targetSpeed = this.baseSpeed * (1 - lengthPenalty) * (wantsBoost ? 1.62 : 1);
      this.speed = lerp(this.speed, targetSpeed, 1 - Math.exp(-6 * dt));
      const turnRate = (this.bot ? 3.15 : 3.8) * (1 - clamp(this.segments.length / 700, 0, .36));
      this.angle = mixAngle(this.angle, this.targetAngle, clamp(turnRate * dt, 0, 1));

      const h = this.head;
      h.x += Math.cos(this.angle) * this.speed * dt;
      h.y += Math.sin(this.angle) * this.speed * dt;

      const gap = this.radius * .64;
      for (let i = 1; i < this.segments.length; i++) {
        const prev = this.segments[i - 1];
        const seg = this.segments[i];
        const dx = prev.x - seg.x;
        const dy = prev.y - seg.y;
        const dist = Math.hypot(dx, dy) || 1;
        const move = dist - gap;
        if (move > 0) {
          seg.x += dx / dist * move;
          seg.y += dy / dist * move;
        }
      }

      const desired = Math.max(25, Math.floor(this.targetLength));
      while (this.segments.length < desired) {
        const tail = this.segments[this.segments.length - 1];
        const prev = this.segments[this.segments.length - 2] || tail;
        const dx = tail.x - prev.x;
        const dy = tail.y - prev.y;
        this.segments.push({ x: tail.x + dx, y: tail.y + dy });
      }
      while (this.segments.length > desired && this.segments.length > 25) this.segments.pop();
      this.maxLength = Math.max(this.maxLength, this.segments.length);

      if (wantsBoost) {
        this.boost = Math.max(0, this.boost - dt * 22);
        this.shedTimer -= dt;
        if (this.shedTimer <= 0) {
          this.shedTimer = .16;
          const tail = this.segments[this.segments.length - 1];
          if (this.targetLength > 30) {
            this.targetLength -= .32;
            const dropped = new Food(tail.x + rand(-5, 5), tail.y + rand(-5, 5), 1, this.skin.main);
            dropped.vx = rand(-25, 25);
            dropped.vy = rand(-25, 25);
            foods.push(dropped);
          }
          if (!this.bot && Math.random() < .25) audio.boost();
        }
        if (!lowDetail && Math.random() < .2) {
          const tail = this.segments[Math.min(this.segments.length - 1, 8)];
          particles.push(new Particle(tail.x, tail.y, this.skin.main, { speed: rand(8, 32), life: .25, size: rand(1, 3) }));
        }
      } else {
        this.boost = Math.min(100, this.boost + dt * 9);
      }
    }

    readPlayerInput() {
      if (touchAngle !== null) this.targetAngle = touchAngle;
      else {
        const dx = pointer.x - W / 2;
        const dy = pointer.y - H / 2;
        if (Math.hypot(dx, dy) > 12) this.targetAngle = Math.atan2(dy, dx);
      }
      if (keys.ArrowLeft || keys.a) this.targetAngle -= .065;
      if (keys.ArrowRight || keys.d) this.targetAngle += .065;
      this.boosting = !!(keys[" "] || keys.Shift || pointer.down || mobileBoosting);
    }

    think(dt) {
      this.aiTimer -= dt;
      if (this.aiTimer > 0) return;
      this.aiTimer = rand(.14, .24);
      const head = this.head;
      const radial = Math.hypot(head.x, head.y);

      // Pick a goal: valuable nearby food, safe wandering, or occasionally the
      // player's projected path when this bot is large enough to pressure them.
      let goalAngle = this.angle + this.aiWander * .22;
      let goalValue = Infinity;
      let nearestFood = null;
      for (let i = 0; i < foods.length; i += 3) {
        const f = foods[i];
        if (!f.alive) continue;
        const d2 = distanceSq(head, f);
        const weighted = d2 / (1 + f.value * 1.5);
        if (weighted < goalValue && d2 < 850 * 850) { goalValue = weighted; nearestFood = f; }
      }
      if (nearestFood) goalAngle = Math.atan2(nearestFood.y - head.y, nearestFood.x - head.x);

      let hunting = false;
      if (player?.alive && this.segments.length > player.segments.length * 1.18 && this.aiMood > .62) {
        const pd = Math.sqrt(distanceSq(head, player.head));
        if (pd < 720 && pd > 100) {
          const lead = clamp(pd / 310, .2, 1.6);
          const tx = player.head.x + Math.cos(player.angle) * player.speed * lead;
          const ty = player.head.y + Math.sin(player.angle) * player.speed * lead;
          goalAngle = Math.atan2(ty - head.y, tx - head.x);
          hunting = true;
        }
      }

      if (radial > WORLD_RADIUS - 430) goalAngle = Math.atan2(-head.y, -head.x);

      // Score several possible steering directions. Long look-ahead makes bots
      // avoid traps earlier instead of turning only after they hit something.
      const offsets = [-.95, -.43, 0, .43, .95];
      let bestAngle = this.angle;
      let bestSafety = -Infinity;
      for (const offset of offsets) {
        const candidate = this.angle + offset;
        let safety = Math.cos(normalizeAngle(candidate - goalAngle)) * 35 - Math.abs(offset) * 2.5;
        for (const look of [90, 205]) {
          const px = head.x + Math.cos(candidate) * look;
          const py = head.y + Math.sin(candidate) * look;
          const edgeRoom = WORLD_RADIUS - Math.hypot(px, py);
          if (edgeRoom < 75) safety -= (80 - edgeRoom) * (look / 40);
          for (const other of snakes) {
            if (!other.alive) continue;
            const start = other === this ? 18 : 1;
            const step = other.segments.length > 130 ? 9 : 6;
            for (let j = start; j < other.segments.length; j += step) {
              const s = other.segments[j];
              const dx = px - s.x;
              const dy = py - s.y;
              const danger = this.radius + other.radius + (look > 150 ? 23 : 12);
              const d2 = dx * dx + dy * dy;
              if (d2 < danger * danger) safety -= (danger * danger - d2) / 35 + (250 - look) * .5;
            }
          }
        }
        if (safety > bestSafety) { bestSafety = safety; bestAngle = candidate; }
      }

      this.targetAngle = bestAngle;
      this.aiWander = clamp(this.aiWander + rand(-.25, .25), -1, 1);
      const aligned = Math.abs(normalizeAngle(this.targetAngle - this.angle)) < .26;
      this.boosting = bestSafety > 14 && aligned && this.boost > 28 && (hunting || (nearestFood && goalValue > 35000 && Math.random() < .2));
    }

    draw() {
      if (!this.alive || this.alpha <= 0) return;
      const segs = this.segments;
      const r = this.radius;
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Build one body path and reuse it for the outline, color and glow.
      ctx.beginPath();
      ctx.moveTo(segs[0].x, segs[0].y);
      const bodyStep = (lowDetail || this.isGiant) ? 3 : 2;
      for (let i = bodyStep; i < segs.length; i += bodyStep) ctx.lineTo(segs[i].x, segs[i].y);
      if (!lowDetail || this === player || this.boosting) {
        ctx.strokeStyle = this.skin.dark;
        ctx.globalAlpha = this.alpha * .2;
        ctx.shadowColor = this.skin.main;
        ctx.shadowBlur = this.boosting ? 16 : 8;
        ctx.lineWidth = r * 2.55;
        ctx.stroke();
      }

      // Dark outline and main body create one smooth, readable snake.
      ctx.globalAlpha = this.alpha;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#091126";
      ctx.lineWidth = r * 2.12;
      ctx.stroke();
      ctx.strokeStyle = this.skin.main;
      ctx.lineWidth = r * 1.76;
      ctx.stroke();

      // Alternating plates provide texture and make motion easier to read.
      const plateStep = (lowDetail || this.isGiant) ? 10 : 6;
      for (let i = segs.length - 2; i >= 3; i -= plateStep) {
        const s = segs[i];
        const tailScale = clamp(i / 12, .45, 1);
        ctx.fillStyle = (Math.floor(i / plateStep) % 2) ? this.skin.pattern : this.skin.light;
        ctx.globalAlpha = this.alpha * ((Math.floor(i / plateStep) % 2) ? .46 : .24);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * .72 * tailScale, 0, TAU);
        ctx.fill();
      }

      const head = segs[0];
      ctx.globalAlpha = this.alpha;
      if (!lowDetail || this === player) {
        const grad = ctx.createRadialGradient(head.x - r * .35, head.y - r * .4, 1, head.x, head.y, r * 1.3);
        grad.addColorStop(0, this.skin.light);
        grad.addColorStop(.45, this.skin.main);
        grad.addColorStop(1, this.skin.dark);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = this.skin.main;
      }
      ctx.strokeStyle = "#081126";
      ctx.lineWidth = 2.2;
      ctx.shadowColor = this.skin.main;
      ctx.shadowBlur = lowDetail ? 0 : (this.boosting ? 16 : 7);
      ctx.beginPath();
      ctx.ellipse(head.x, head.y, r * 1.12, r, this.angle, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Face follows the travel direction.
      const sideX = Math.cos(this.angle + Math.PI / 2) * r * .48;
      const sideY = Math.sin(this.angle + Math.PI / 2) * r * .48;
      const frontX = Math.cos(this.angle) * r * .5;
      const frontY = Math.sin(this.angle) * r * .5;
      for (const side of [-1, 1]) {
        const ex = head.x + frontX + sideX * side;
        const ey = head.y + frontY + sideY * side;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(ex, ey, r * .28, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#061020";
        ctx.beginPath();
        ctx.arc(ex + Math.cos(this.angle) * r * .09, ey + Math.sin(this.angle) * r * .09, r * .13, 0, TAU);
        ctx.fill();
      }

      if (this.spawnShield > 0) {
        ctx.strokeStyle = this.skin.light;
        ctx.globalAlpha = this.alpha * (.2 + Math.sin(elapsed * 12) * .12);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(head.x, head.y, r * 2.2, 0, TAU);
        ctx.stroke();
      }

      // Name tag stays understated until the camera is close.
      if (camera.zoom > .42) {
        ctx.globalAlpha = this.alpha * .82;
        ctx.font = `800 ${this.bot ? 10 : 11}px Nunito, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = this.bot ? "#b4c0df" : "#ffffff";
        ctx.shadowColor = "#02040d";
        ctx.shadowBlur = lowDetail ? 0 : 3;
        ctx.fillText(this.name, head.x, head.y - r * 2.1);
      }
      ctx.restore();
    }
  }

  function randomWorldPoint(margin = 120) {
    const a = rand(0, TAU);
    const r = Math.sqrt(Math.random()) * (WORLD_RADIUS - margin);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }

  function safeSpawn(minPlayerDistance = 500) {
    for (let tries = 0; tries < 35; tries++) {
      const p = randomWorldPoint(350);
      if (player?.alive && distanceSq(p, player.head) < minPlayerDistance ** 2) continue;
      let clear = true;
      for (const snake of snakes) {
        if (snake.alive && distanceSq(p, snake.head) < 260 ** 2) { clear = false; break; }
      }
      if (clear) return p;
    }
    return randomWorldPoint(420);
  }

  function createBot(index = snakes.length) {
    const giantCount = snakes.filter(s => s.bot && s.alive && s.isGiant).length;
    const giant = giantCount < 2;
    let p;
    let angle;
    let length;
    let name;
    let skin;

    if (giant) {
      const spawnAngle = rand(0, TAU);
      const spawnRadius = rand(850, 1250);
      p = { x: Math.cos(spawnAngle) * spawnRadius, y: Math.sin(spawnAngle) * spawnRadius };
      angle = spawnAngle + (Math.random() < .5 ? Math.PI / 2 : -Math.PI / 2);
      length = giantCount === 0 ? (rand(500, 590) | 0) : (rand(400, 490) | 0);
      const titanNames = ["WORLD EATER", "VOID TITAN", "COLOSSUS"];
      name = titanNames.find(n => !snakes.some(s => s.alive && s.name === n)) || choose(titanNames);
      skin = giantCount === 0 ? SKINS[3] : SKINS[1];
    } else {
      p = safeSpawn(620);
      angle = rand(0, TAU);
      skin = SKINS[index % SKINS.length];
      length = index < 4 ? (rand(180, 280) | 0) : (rand(60, 155) | 0);
      name = BOT_NAMES[index % BOT_NAMES.length];
    }

    return new Snake({ x: p.x, y: p.y, angle, skin, name, bot: true, length, giant });
  }

  function seedWorld() {
    foods = [];
    particles = [];
    floatingText = [];
    snakes = [];
    botSpawnQueue = [];
    for (let i = 0; i < FOOD_TARGET; i++) {
      const p = randomWorldPoint(70);
      foods.push(new Food(p.x, p.y));
    }
    for (let i = 0; i < BOT_TARGET; i++) snakes.push(createBot(i));
  }

  function startGame() {
    audio.init();
    audio.click();
    const rawName = ui.nickname.value.trim().slice(0, 14);
    const name = rawName || "Neon Rider";
    localStorage.setItem("neon-serpents-name", name);
    seedWorld();
    const spawn = { x: rand(-120, 120), y: rand(-120, 120) };
    player = new Snake({ x: spawn.x, y: spawn.y, angle: rand(0, TAU), skin: SKINS[skinIndex], name, bot: false, length: 36 });
    snakes.unshift(player);
    camera.x = player.head.x;
    camera.y = player.head.y;
    camera.zoom = .95;
    elapsed = 0;
    state = "playing";
    ui.menu.classList.remove("visible");
    ui.gameover.classList.remove("visible");
    ui.pauseScreen.classList.remove("visible");
    ui.hud.classList.remove("hidden");
    ui.hud.setAttribute("aria-hidden", "false");
    pointer.down = false;
    mobileBoosting = false;
    flash = .25;
    showStatus("SURVIVE & GROW", 1.5);
  }

  function quitToMenu() {
    state = "menu";
    player = null;
    ui.hud.classList.add("hidden");
    ui.hud.setAttribute("aria-hidden", "true");
    ui.pauseScreen.classList.remove("visible");
    ui.gameover.classList.remove("visible");
    ui.menu.classList.add("visible");
    if (snakes.length < BOT_TARGET) seedWorld();
  }

  function setPause(paused) {
    if (paused && state === "playing") {
      state = "paused";
      ui.pauseScreen.classList.add("visible");
      ui.pauseScreen.setAttribute("aria-hidden", "false");
    } else if (!paused && state === "paused") {
      state = "playing";
      ui.pauseScreen.classList.remove("visible");
      ui.pauseScreen.setAttribute("aria-hidden", "true");
      lastTime = performance.now();
    }
  }

  function killSnake(snake, killer = null) {
    if (!snake.alive || snake.spawnShield > 0) return;
    snake.alive = false;
    snake.killer = killer?.name || "the arena";
    const step = Math.max(3, Math.floor(snake.segments.length / 50));
    for (let i = 0; i < snake.segments.length; i += step) {
      const s = snake.segments[i];
      const food = new Food(s.x + rand(-7, 7), s.y + rand(-7, 7), Math.random() < .18 ? 3 : 1, snake.skin.main);
      food.vx = rand(-40, 40);
      food.vy = rand(-40, 40);
      foods.push(food);
      if (i % (step * 2) === 0) {
        particles.push(new Particle(s.x, s.y, snake.skin.main, { speed: rand(40, 180), life: rand(.35, .75), size: rand(2, 5) }));
      }
    }
    if (snake === player) {
      state = "dead";
      shake = 20;
      flash = .8;
      audio.crash();
      bestScore = Math.max(bestScore, Math.floor(player.score));
      localStorage.setItem("neon-serpents-best", bestScore);
      setTimeout(showGameOver, 850);
    } else {
      botSpawnQueue.push({ time: rand(1.5, 3.2), index: (Math.random() * BOT_NAMES.length) | 0 });
      if (killer === player) {
        player.score += 75;
        player.targetLength += 4;
        showFloatingText(snake.head.x, snake.head.y, "+75 KNOCKOUT", "#ffdb5e");
        showStatus("SERPENT ELIMINATED  +75", 1.1);
      }
    }
  }

  function showGameOver() {
    if (state !== "dead" || !player) return;
    ui.deathTitle.textContent = player.killer === "the arena" ? "WALL CRASH!" : `CAUGHT BY ${player.killer.toUpperCase()}`;
    ui.finalScore.textContent = formatNumber(player.score);
    ui.finalLength.textContent = player.maxLength;
    ui.finalFood.textContent = player.foodEaten;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60).toString().padStart(2, "0");
    ui.finalTime.textContent = `${mins}:${secs}`;
    ui.gameover.classList.add("visible");
    ui.gameover.setAttribute("aria-hidden", "false");
  }

  function eatFood(snake) {
    const h = snake.head;
    const eatRadius = snake.radius + 8;
    for (const f of foods) {
      if (!f.alive) continue;
      const dx = f.x - h.x;
      const dy = f.y - h.y;
      const d2 = dx * dx + dy * dy;
      // A small attraction radius makes collecting food feel responsive.
      if (d2 < 78 ** 2 && d2 > eatRadius ** 2) {
        const d = Math.sqrt(d2) || 1;
        const pull = (1 - d / 78) * 520;
        f.x -= dx / d * pull * .016;
        f.y -= dy / d * pull * .016;
      }
      if (d2 < eatRadius ** 2) {
        f.alive = false;
        snake.score += f.value * 4;
        snake.targetLength += f.value * .48;
        snake.foodEaten++;
        snake.boost = Math.min(100, snake.boost + f.value * .9);
        snake.hitPulse = 1;
        const particleCount = lowDetail ? 1 : Math.min(3, f.value + 1);
        for (let i = 0; i < particleCount; i++) particles.push(new Particle(f.x, f.y, f.color, { speed: rand(20, 90), life: rand(.18, .4), size: rand(1, 3.2) }));
        if (snake === player) {
          audio.eat(f.value);
          if (f.value >= 5) showFloatingText(f.x, f.y, `+${f.value * 4}`, f.color);
        }
      }
    }
  }

  function checkCollisions() {
    const alive = snakes.filter(s => s.alive);
    for (const snake of alive) {
      if (snake.spawnShield > 0) continue;
      const h = snake.head;
      if (Math.hypot(h.x, h.y) > WORLD_RADIUS - snake.radius * 1.3) {
        killSnake(snake);
        continue;
      }
      let collided = false;
      for (const other of alive) {
        if (!other.alive) continue;
        if (other !== snake && other.spawnShield <= 0 && distanceSq(h, other.head) < (snake.radius + other.radius) ** 2 * .72) {
          if (snake.segments.length < other.segments.length * .96) killSnake(snake, other);
          else if (other.segments.length < snake.segments.length * .96) killSnake(other, snake);
          else { killSnake(snake, other); killSnake(other, snake); }
          collided = true;
          break;
        }
        const start = other === snake ? 20 : 7;
        for (let j = start; j < other.segments.length; j += 4) {
          const seg = other.segments[j];
          const rr = snake.radius + other.radius * .68;
          if ((h.x - seg.x) ** 2 + (h.y - seg.y) ** 2 < rr * rr) {
            killSnake(snake, other === snake ? null : other);
            collided = true;
            break;
          }
        }
        if (collided) break;
      }
    }
  }

  function showFloatingText(x, y, text, color) {
    floatingText.push({ x, y, text, color, life: 1, maxLife: 1 });
  }

  function showStatus(text, duration = 1) {
    ui.status.textContent = text;
    ui.status.classList.add("show");
    statusTimer = duration;
  }

  function update(dt) {
    if (state === "paused") return;
    if (state === "playing") elapsed += dt;

    // Keep the menu background alive, but do not let that world affect a run.
    for (const snake of snakes) snake.update(dt);
    for (const snake of snakes) if (snake.alive) eatFood(snake);
    collisionTimer -= dt;
    if (collisionTimer <= 0 && (state === "playing" || state === "menu")) {
      collisionTimer = 1 / 30;
      checkCollisions();
    }

    for (const f of foods) if (f.alive) f.update(dt);
    foods = foods.filter(f => f.alive);
    if (foods.length > FOOD_MAX) foods.splice(0, foods.length - FOOD_MAX);
    while (foods.length < FOOD_TARGET) {
      const p = randomWorldPoint(55);
      foods.push(new Food(p.x, p.y));
    }

    particles = particles.filter(p => p.update(dt));
    if (particles.length > 280) particles.splice(0, particles.length - 280);
    floatingText = floatingText.filter(t => { t.life -= dt; t.y -= 22 * dt; return t.life > 0; });
    snakes = snakes.filter(s => s.alive || s === player);

    for (const item of botSpawnQueue) item.time -= dt;
    const ready = botSpawnQueue.filter(item => item.time <= 0);
    botSpawnQueue = botSpawnQueue.filter(item => item.time > 0);
    for (const item of ready) snakes.push(createBot(item.index));
    while (snakes.filter(s => s.bot && s.alive).length < BOT_TARGET && botSpawnQueue.length === 0) snakes.push(createBot((Math.random() * BOT_NAMES.length) | 0));

    const focus = player?.alive ? player.head : snakes.find(s => s.alive)?.head || { x: 0, y: 0 };
    if (state === "menu" && !player) {
      const showcase = snakes.filter(s => s.alive).sort((a, b) => b.segments.length - a.segments.length)[0];
      if (showcase) { camera.x = lerp(camera.x, showcase.head.x, dt * .18); camera.y = lerp(camera.y, showcase.head.y, dt * .18); }
      camera.targetZoom = .7;
    } else {
      camera.x = lerp(camera.x, focus.x, 1 - Math.exp(-5.8 * dt));
      camera.y = lerp(camera.y, focus.y, 1 - Math.exp(-5.8 * dt));
      camera.targetZoom = player ? clamp(1.05 - player.segments.length / 620, .48, .96) : .75;
    }
    camera.zoom = lerp(camera.zoom, camera.targetZoom, 1 - Math.exp(-2.4 * dt));
    shake = Math.max(0, shake - dt * 30);
    flash = Math.max(0, flash - dt * 1.8);
    statusTimer -= dt;
    if (statusTimer <= 0) ui.status.classList.remove("show");

    if (state === "playing" && player) {
      uiTimer -= dt;
      miniTimer -= dt;
      if (uiTimer <= 0) { uiTimer = .18; updateHUD(); }
      if (miniTimer <= 0) { miniTimer = .15; drawMinimap(); }
    }
  }

  function updateHUD() {
    const score = Math.floor(player.score);
    ui.score.textContent = formatNumber(score);
    ui.best.textContent = formatNumber(Math.max(bestScore, score));
    ui.boostFill.style.width = `${player.boost.toFixed(1)}%`;
    ui.boostPercent.textContent = `${Math.round(player.boost)}%`;
    ui.boostFill.style.filter = player.boost < 20 ? "hue-rotate(125deg)" : "none";

    const leaders = snakes.filter(s => s.alive).sort((a, b) => b.lengthScore - a.lengthScore).slice(0, 8);
    ui.leaders.innerHTML = leaders.map((s, i) => `
      <li class="${s === player ? "me" : ""}">
        <span class="rank">${i + 1}</span>
        <span class="dot" style="color:${s.skin.main};background:${s.skin.main}"></span>
        <span class="name">${escapeHtml(s.name)}</span>
        <span class="points">${formatNumber(s.lengthScore)}</span>
      </li>`).join("");
  }

  function drawMinimap() {
    const mw = minimap.width;
    const mh = minimap.height;
    mini.clearRect(0, 0, mw, mh);
    mini.save();
    mini.translate(mw / 2, mh / 2);
    mini.beginPath();
    mini.arc(0, 0, mw * .44, 0, TAU);
    mini.fillStyle = "rgba(5,10,29,.88)";
    mini.fill();
    mini.strokeStyle = "rgba(88,143,255,.3)";
    mini.lineWidth = 2;
    mini.stroke();
    mini.clip();
    const scale = mw * .44 / WORLD_RADIUS;
    mini.strokeStyle = "rgba(75,113,205,.12)";
    mini.lineWidth = 1;
    mini.beginPath(); mini.moveTo(-mw, 0); mini.lineTo(mw, 0); mini.moveTo(0, -mh); mini.lineTo(0, mh); mini.stroke();
    for (const s of snakes) {
      if (!s.alive) continue;
      mini.fillStyle = s === player ? "#ffffff" : s.skin.main;
      mini.shadowColor = s.skin.main;
      mini.shadowBlur = s === player ? 7 : 3;
      mini.beginPath();
      mini.arc(s.head.x * scale, s.head.y * scale, s === player ? 3.8 : (s.isGiant ? 3.3 : 2.2), 0, TAU);
      mini.fill();
    }
    mini.restore();
  }

  function drawBackground() {
    ctx.fillStyle = backgroundGradient || "#070d27";
    ctx.fillRect(0, 0, W, H);

    // Screen-space stars give depth while the world grid shows movement.
    ctx.fillStyle = "rgba(120,174,255,.23)";
    const starOffsetX = ((-camera.x * .045) % 87 + 87) % 87;
    const starOffsetY = ((-camera.y * .045) % 83 + 83) % 83;
    for (let x = starOffsetX - 87; x < W + 87; x += 87) {
      for (let y = starOffsetY - 83; y < H + 83; y += 83) {
        const seed = Math.abs(Math.sin(x * 13.17 + y * 8.31));
        if (seed > (lowDetail ? .72 : .46)) ctx.fillRect(x + seed * 25, y + seed * 13, seed > .86 ? 1.5 : 1, seed > .86 ? 1.5 : 1);
      }
    }
  }

  function drawGrid() {
    const visibleHalfW = W / 2 / camera.zoom;
    const visibleHalfH = H / 2 / camera.zoom;
    const grid = 95;
    const minX = Math.floor((camera.x - visibleHalfW) / grid) * grid;
    const maxX = camera.x + visibleHalfW;
    const minY = Math.floor((camera.y - visibleHalfH) / grid) * grid;
    const maxY = camera.y + visibleHalfH;
    ctx.lineWidth = 1 / camera.zoom;
    ctx.strokeStyle = "rgba(76,116,220,.075)";
    ctx.beginPath();
    for (let x = minX; x <= maxX; x += grid) { ctx.moveTo(x, minY); ctx.lineTo(x, maxY); }
    for (let y = minY; y <= maxY; y += grid) { ctx.moveTo(minX, y); ctx.lineTo(maxX, y); }
    ctx.stroke();

    // Only render the expensive arena aura when the edge can actually be seen.
    const viewReach = Math.hypot(W, H) * .55 / camera.zoom;
    if (Math.hypot(camera.x, camera.y) + viewReach > WORLD_RADIUS - 250) {
      ctx.beginPath();
      ctx.arc(0, 0, WORLD_RADIUS, 0, TAU);
      ctx.strokeStyle = "rgba(63,113,255,.12)";
      ctx.lineWidth = 35;
      ctx.shadowColor = "#3069ff";
      ctx.shadowBlur = lowDetail ? 0 : 16;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, WORLD_RADIUS, 0, TAU);
      ctx.setLineDash([22, 12]);
      ctx.lineDashOffset = -elapsed * 28;
      ctx.strokeStyle = "rgba(92,181,255,.72)";
      ctx.lineWidth = 3.2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function isVisible(x, y, margin = 80) {
    const sx = (x - camera.x) * camera.zoom + W / 2;
    const sy = (y - camera.y) * camera.zoom + H / 2;
    return sx > -margin && sx < W + margin && sy > -margin && sy < H + margin;
  }

  function drawFoods() {
    const visible = [];
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      if (f.alive && isVisible(f.x, f.y, 60)) visible.push(f);
    }
    if (!visible.length) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // A few batched color paths replace hundreds of individual shadow calls.
    const visibleColors = new Set(visible.map(f => f.color));
    for (const color of visibleColors) {
      if (!lowDetail) {
        ctx.beginPath();
        for (const f of visible) {
          if (f.color !== color) continue;
          const pulse = 1 + Math.sin(f.phase) * .1;
          const rr = f.radius * pulse * 2.05;
          ctx.moveTo(f.x + rr, f.y);
          ctx.arc(f.x, f.y, rr, 0, TAU);
        }
        ctx.globalAlpha = .13;
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.beginPath();
      for (const f of visible) {
        if (f.color !== color) continue;
        const rr = f.radius * (1 + Math.sin(f.phase) * .1);
        ctx.moveTo(f.x + rr, f.y);
        ctx.arc(f.x, f.y, rr, 0, TAU);
      }
      ctx.globalAlpha = .95;
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = .72;
    ctx.fillStyle = "white";
    ctx.beginPath();
    for (const f of visible) {
      if (lowDetail && f.value < 3) continue;
      const rr = Math.max(.8, f.radius * .22);
      ctx.moveTo(f.x - f.radius * .2 + rr, f.y - f.radius * .22);
      ctx.arc(f.x - f.radius * .2, f.y - f.radius * .22, rr, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    const sx = shake ? rand(-shake, shake) : 0;
    const sy = shake ? rand(-shake, shake) : 0;
    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    drawGrid();

    drawFoods();
    for (const snake of snakes) if (snake.alive && snake.segments.some((s, i) => i % (snake.isGiant ? 16 : 28) === 0 && isVisible(s.x, s.y, 150))) snake.draw();
    for (const p of particles) if (isVisible(p.x, p.y)) p.draw();

    ctx.textAlign = "center";
    for (const t of floatingText) {
      ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.font = "900 13px Nunito, sans-serif";
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = lowDetail ? 0 : 6;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // A subtle screen vignette keeps focus on the action.
    ctx.fillStyle = screenVignette || "rgba(0,2,10,.12)";
    ctx.fillRect(0, 0, W, H);
    if (flash > 0) {
      ctx.fillStyle = `rgba(120,210,255,${flash * .17})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function frame(now) {
    const rawDt = (now - lastTime) / 1000 || .016;
    const dt = Math.min(.033, rawDt);
    lastTime = now;
    trackPerformance(rawDt);
    if (state !== "paused") update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function trackPerformance(rawDt) {
    if (rawDt > .2) return;
    fpsFrames++;
    fpsTime += rawDt;
    if (fpsTime < .75) return;
    const measured = fpsFrames / fpsTime;
    fpsAverage = lerp(fpsAverage, measured, .45);
    if (state === "playing" && fpsAverage < 51) {
      slowTime += fpsTime;
      fastTime = 0;
    } else if (fpsAverage > 57) {
      fastTime += fpsTime;
      slowTime = Math.max(0, slowTime - fpsTime);
    } else {
      slowTime = Math.max(0, slowTime - fpsTime * .35);
      fastTime = 0;
    }
    fpsFrames = 0;
    fpsTime = 0;
    if (!lowDetail && slowTime > 1.4) {
      lowDetail = true;
      slowTime = 0;
      resize();
      showStatus("60 FPS PERFORMANCE MODE", 1.2);
    } else if (lowDetail && fastTime > 8) {
      lowDetail = false;
      fastTime = 0;
      resize();
    }
  }

  function cycleSkin() {
    skinIndex = (skinIndex + 1) % SKINS.length;
    updateSkinPreview();
    localStorage.setItem("neon-serpents-skin", skinIndex);
    audio.click();
  }

  function updateSkinPreview() {
    const skin = SKINS[skinIndex];
    ui.skinPreview.style.background = skin.main;
    ui.skinPreview.style.boxShadow = `0 0 13px ${skin.main}`;
    ui.skinButton.title = skin.name;
  }

  function updateJoystick(clientX, clientY) {
    const rect = ui.joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const max = rect.width * .31;
    if (dist > max) { dx = dx / dist * max; dy = dy / dist * max; }
    ui.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (dist > 5) touchAngle = Math.atan2(dy, dx);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("blur", () => { if (state === "playing") setPause(true); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") setPause(true); });
  window.addEventListener("pointermove", e => {
    if (e.pointerType !== "touch") { pointer.x = e.clientX; pointer.y = e.clientY; }
  });
  window.addEventListener("pointerdown", e => {
    if (e.pointerType !== "touch" && e.button === 0 && state === "playing" && !e.target.closest("button, input")) pointer.down = true;
  });
  window.addEventListener("pointerup", e => { if (e.pointerType !== "touch") pointer.down = false; });
  window.addEventListener("contextmenu", e => e.preventDefault());
  window.addEventListener("keydown", e => {
    keys[e.key] = true;
    keys[e.key.toLowerCase()] = true;
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    if ((e.key === "p" || e.key === "P" || e.key === "Escape") && (state === "playing" || state === "paused")) setPause(state === "playing");
  });
  window.addEventListener("keyup", e => { keys[e.key] = false; keys[e.key.toLowerCase()] = false; });

  ui.form.addEventListener("submit", e => { e.preventDefault(); startGame(); });
  ui.skinButton.addEventListener("click", cycleSkin);
  ui.pauseButton.addEventListener("click", () => setPause(true));
  ui.resumeButton.addEventListener("click", () => setPause(false));
  ui.quitButton.addEventListener("click", quitToMenu);
  ui.menuButton.addEventListener("click", quitToMenu);
  ui.againButton.addEventListener("click", startGame);
  ui.soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    localStorage.setItem("neon-serpents-sound", soundOn ? "on" : "off");
    ui.soundButton.classList.toggle("muted", !soundOn);
    ui.soundButton.textContent = soundOn ? "♪" : "×";
    if (soundOn) audio.click();
  });

  ui.joystick.addEventListener("pointerdown", e => {
    joystickPointer = e.pointerId;
    ui.joystick.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
  });
  ui.joystick.addEventListener("pointermove", e => { if (e.pointerId === joystickPointer) updateJoystick(e.clientX, e.clientY); });
  const releaseJoystick = e => {
    if (e.pointerId !== joystickPointer) return;
    joystickPointer = null;
    touchAngle = null;
    ui.joystickKnob.style.transform = "translate(0, 0)";
  };
  ui.joystick.addEventListener("pointerup", releaseJoystick);
  ui.joystick.addEventListener("pointercancel", releaseJoystick);
  ui.mobileBoost.addEventListener("pointerdown", e => {
    e.preventDefault(); mobileBoosting = true; ui.mobileBoost.classList.add("active");
    ui.mobileBoost.setPointerCapture(e.pointerId);
  });
  const stopMobileBoost = () => { mobileBoosting = false; ui.mobileBoost.classList.remove("active"); };
  ui.mobileBoost.addEventListener("pointerup", stopMobileBoost);
  ui.mobileBoost.addEventListener("pointercancel", stopMobileBoost);

  // Initial menu scene.
  resize();
  ui.nickname.value = localStorage.getItem("neon-serpents-name") || "Neon Rider";
  ui.best.textContent = formatNumber(bestScore);
  ui.soundButton.classList.toggle("muted", !soundOn);
  ui.soundButton.textContent = soundOn ? "♪" : "×";
  updateSkinPreview();
  seedWorld();
  requestAnimationFrame(frame);
})();
