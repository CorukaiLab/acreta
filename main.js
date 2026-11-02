/* =========================================================
   ACRETA — PROTOTIPO 02: COSMOS LOCO
   1) Explosión inicial visible y pausada → Imagen de puntos a PANTALLA COMPLETA
   2) Glifo E-Estrella interactivo
   3) Constelaciones + Ruta donde cada Drop es una Explosión de Nova
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const mouse = { x: innerWidth / 2, y: innerHeight / 2, sx: innerWidth / 2, sy: innerHeight / 2 };
  addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

  /* ---------------- Smooth scroll (Lenis) + Skew por velocidad ---------------- */
  let lenis = null;
  let scrollVel = 0;
  if (typeof window.Lenis !== "undefined") {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on("scroll", ({ velocity }) => { scrollVel = velocity; });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      lenis ? lenis.scrollTo(el, { duration: 1.3 }) : el.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* ---------------- Cursor ácido ---------------- */
  const cursor = $("#cursor"), cursorLabel = $("#cursorLabel");
  if (!isTouch && cursor) {
    const ring = $(".cursor__ring", cursor);
    let rx = mouse.x, ry = mouse.y;
    const loopCursor = () => {
      rx = lerp(rx, mouse.x, 0.22); ry = lerp(ry, mouse.y, 0.22);
      ring.style.left = rx + "px"; ring.style.top = ry + "px";
      cursorLabel.style.left = rx + "px"; cursorLabel.style.top = ry + "px";
      requestAnimationFrame(loopCursor);
    };
    loopCursor();
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("[data-cursor]");
      if (t) { cursorLabel.textContent = t.dataset.cursor; cursor.classList.add("is-hover"); }
    });
    document.addEventListener("pointerout", (e) => {
      const t = e.target.closest("[data-cursor]");
      if (t && !t.contains(e.relatedTarget)) cursor.classList.remove("is-hover");
    });
  }

  /* ---------------- Scramble de texto en enlaces ---------------- */
  const GLYPHS = "✶✦✧⋆01ACRETA星屑";
  $$(".scramble").forEach((el) => {
    const orig = el.textContent;
    let iv;
    el.addEventListener("pointerenter", () => {
      let i = 0;
      clearInterval(iv);
      iv = setInterval(() => {
        el.textContent = [...orig].map((ch, idx) => (idx < i ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
        i += 0.5;
        if (i > orig.length) { clearInterval(iv); el.textContent = orig; }
      }, 28);
    });
  });

  const chars = $$(".hero__title .char");

  /* =========================================================
     PORTADA A PANTALLA COMPLETA: EXPLOSIÓN VISIBLE → FIGURA 100VW×100VH
     ========================================================= */
  const canvas = $("#bang");
  const ctx = canvas.getContext("2d");
  const flashEl = $("#flash");
  const introT = $("#introT");
  const introBar = $("#introBar");
  const heroCountEl = $("#heroCount");
  const heroStatusEl = $("#heroStatus");
  const boomBtn = $("#boomBtn");
  const modeBtn = $("#modeBtn");

  let W = 0, H = 0;
  // Región a pantalla completa donde se mapea la figura de puntillismo
  let figRect = { x: 0, y: 0, w: 0, h: 0 };
  let dots = [];
  let bgStars = [];
  let shockwaves = [];
  let fireballs = [];
  let cosmosOnly = false; // false = lienzo hueso a pantalla completa tras la explosión; true = estrellas sobre cosmos oscuro
  let phase = "implode";  // "implode" -> "explode" -> "form"
  let phaseTime = performance.now();
  let irisRadius = 0;     // Radio del lienzo hueso que se abre a pantalla completa al formar la figura
  const heroMouse = { x: -9999, y: -9999, active: false };

  function computeLayout() {
    W = canvas.width = canvas.clientWidth * DPR;
    H = canvas.height = canvas.clientHeight * DPR;
    const isPortrait = W < H * 0.85;
    // Caja horizontal amplia en el centro de la portada para el nombre/logo ACR✶TA
    const logoW = Math.min(W * (isPortrait ? 0.94 : 0.88), H * 2.35);
    const logoH = logoW / 3.0;
    figRect.w = logoW;
    figRect.h = logoH;
    figRect.x = (W - logoW) * 0.5;
    figRect.y = (H - logoH) * (isPortrait ? 0.34 : 0.43);

    bgStars = Array.from({ length: isTouch ? 140 : 280 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: (0.6 + Math.random() * 1.6) * DPR,
      p: Math.random() * Math.PI * 2,
      sp: 0.015 + Math.random() * 0.03,
    }));
  }

  // Genera un lienzo offscreen con el logo "ACR [Estrella] TA" y lo convierte en puntos de puntillismo
  function sampleLogoToDots() {
    const sw = 960, sh = 320;
    const c = document.createElement("canvas");
    c.width = sw; c.height = sh;
    const x = c.getContext("2d");

    x.fillStyle = "#ffffff";
    x.fillRect(0, 0, sw, sh);

    const fontSize = 248;
    x.font = `${fontSize}px "Anton", Impact, "Arial Black", sans-serif`;
    x.textBaseline = "middle";

    const wLeft = x.measureText("ACR").width;
    const wRight = x.measureText("TA").width;
    const starW = fontSize * 0.78;
    const gap = fontSize * 0.05;
    const totalW = wLeft + gap + starW + gap + wRight;
    const startX = (sw - totalW) * 0.5;
    const cy = sh * 0.52;

    // Letras ACR y TA en negro (canal R = 0, G = 0, B = 0)
    x.fillStyle = "#000000";
    x.fillText("ACR", startX, cy);
    x.fillText("TA", startX + wLeft + gap + starW + gap, cy);

    // Estrella de 8 puntas en lugar de la E, pintada en canal rojo puro (#ff0000) para distinguir sus partículas
    const sx = startX + wLeft + gap + starW * 0.5;
    const sy = cy - fontSize * 0.02;
    const scale = (fontSize * 0.82) / 110;
    const starPts = [
      [44, 0], [53, 37], [76, 18], [59, 46],
      [88, 55], [59, 64], [76, 92], [53, 73],
      [44, 110], [35, 73], [12, 92], [29, 64],
      [0, 55], [29, 46], [12, 18], [35, 37],
    ];
    x.fillStyle = "#ff0000";
    x.beginPath();
    starPts.forEach(([px, py], i) => {
      const gx = sx + (px - 44) * scale;
      const gy = sy + (py - 55) * scale;
      if (i === 0) x.moveTo(gx, gy);
      else x.lineTo(gx, gy);
    });
    x.closePath();
    x.fill();

    // Hueco central de la estrella
    x.fillStyle = "#ffffff";
    x.beginPath();
    x.arc(sx, sy, 6.5 * scale, 0, Math.PI * 2);
    x.fill();

    const data = x.getImageData(0, 0, sw, sh).data;
    const list = [];
    const maxDots = isTouch ? 4800 : 8200;
    const step = 2;

    const isInk = (px, py) => {
      if (px < 0 || py < 0 || px >= sw || py >= sh) return false;
      const idx = (py * sw + px) * 4;
      return data[idx + 1] < 128; // Tanto #000000 como #ff0000 tienen canal G = 0
    };

    for (let py = 0; py < sh; py += step) {
      for (let px = 0; px < sw; px += step) {
        if (!isInk(px, py)) continue;
        const idx = (py * sw + px) * 4;
        const isStar = data[idx] > 180 && data[idx + 1] < 80; // #ff0000
        const isEdge = !isInk(px - 3, py) || !isInk(px + 3, py) || !isInk(px, py - 3) || !isInk(px, py + 3);
        // Mayor densidad en los bordes para que el nombre ACR✶TA se lea con total nitidez
        const prob = isEdge ? 0.96 : 0.62;
        if (Math.random() < prob) {
          list.push({
            u: (px + (Math.random() - 0.5) * 1.4) / sw,
            v: (py + (Math.random() - 0.5) * 1.4) / sh,
            s: isEdge ? 0.95 + Math.random() * 0.55 : 0.65 + Math.random() * 0.85,
            starGlyph: isStar,
            edge: isEdge,
          });
        }
      }
    }
    while (list.length > maxDots) list.splice((Math.random() * list.length) | 0, 1);
    return list;
  }

  function buildParticles(rawDots) {
    const cx = W * 0.5, cy = H * 0.5;
    // 1) Puntos que forman el nombre/logo ACR✶TA en el centro
    const figureParticles = rawDots.map((d, idx) => {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.pow(Math.random(), 1.8) * 36 * DPR;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      return {
        u: d.u,
        v: d.v,
        ambient: false,
        starGlyph: !!d.starGlyph,
        edge: !!d.edge,
        s: d.s,
        x, y,
        px: x, py: y,
        vx: 0, vy: 0,
        orbitSpeed: (Math.random() - 0.5) * 0.025,
        acid: d.starGlyph ? idx % 2 === 0 : idx % 16 === 0,
        crimson: d.starGlyph ? idx % 2 === 1 : idx % 44 === 0,
      };
    });

    // 2) Puntos de polvo estelar / puntillismo repartidos por el resto de la pantalla para que no quede vacía
    const ambientCount = isTouch ? 1300 : 2600;
    const ambientParticles = [];
    for (let i = 0; i < ambientCount; i++) {
      const au = Math.random();
      let av = Math.random();
      const sx = au * W, sy = av * H;
      const inLogoX = sx > figRect.x - 16 * DPR && sx < figRect.x + figRect.w + 16 * DPR;
      const inLogoY = sy > figRect.y - 16 * DPR && sy < figRect.y + figRect.h + 16 * DPR;
      // Despejamos ligeramente el rectángulo del logo para que las letras respiren y se lean limpias
      if (inLogoX && inLogoY && Math.random() < 0.78) {
        av = Math.random() < 0.5 ? Math.random() * 0.25 : 0.72 + Math.random() * 0.28;
      }
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.pow(Math.random(), 1.8) * 36 * DPR;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      ambientParticles.push({
        u: au,
        v: av,
        ambient: true,
        starGlyph: false,
        phase: Math.random() * Math.PI * 2,
        s: 0.45 + Math.pow(Math.random(), 1.6) * 1.15,
        x, y,
        px: x, py: y,
        vx: 0, vy: 0,
        orbitSpeed: (Math.random() - 0.5) * 0.025,
        acid: i % 11 === 0,
        crimson: i % 29 === 0,
      });
    }

    dots = figureParticles.concat(ambientParticles);
    heroCountEl.textContent = `${dots.length.toLocaleString("es-ES")} estrellas`;
  }

  // Detona una explosión visible y pausada desde (ox, oy)
  function triggerExplosion(ox = W * 0.5, oy = H * 0.5, initial = false) {
    phase = "explode";
    phaseTime = performance.now();
    irisRadius = 0;
    if (heroStatusEl) heroStatusEl.textContent = "Fase: Explosión de Nova en curso…";

    // Destello de supernova + ondas expansivas escalonadas
    flashEl.classList.add("is-bang");
    setTimeout(() => flashEl.classList.remove("is-bang"), 180);

    const maxD = Math.hypot(W, H) * 0.95;
    shockwaves.push({ x: ox, y: oy, r: 6 * DPR, maxR: maxD, speed: 0.045, alpha: 1, color: "#d7ff3b", w: 3.5 });
    shockwaves.push({ x: ox, y: oy, r: 2 * DPR, maxR: maxD * 0.78, speed: 0.032, alpha: 0.9, color: "#ff2e4c", w: 2.5 });
    shockwaves.push({ x: ox, y: oy, r: 1 * DPR, maxR: maxD * 0.58, speed: 0.024, alpha: 0.75, color: "#ece8e0", w: 1.5 });
    fireballs.push({ x: ox, y: oy, r: 20 * DPR, maxR: Math.min(W, H) * 0.55, alpha: 0.95 });

    // Impulso radial 360° calibrado para que la explosión viaje de forma visible durante ~2.1s
    for (let i = 0; i < dots.length; i++) {
      const p = dots[i];
      if (initial) {
        const a0 = Math.random() * Math.PI * 2;
        const r0 = Math.random() * 14 * DPR;
        p.x = ox + Math.cos(a0) * r0;
        p.y = oy + Math.sin(a0) * r0;
        p.px = p.x; p.py = p.y;
      }
      const dx = p.x - ox, dy = p.y - oy;
      const a = initial ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.55;
      // Velocidades variadas en capas (núcleo lento, manto medio, eyección rápida) para ver toda la nebulosa explotar
      const layer = Math.random();
      const power = (layer < 0.25 ? 3 + Math.random() * 8 : layer < 0.75 ? 9 + Math.random() * 16 : 22 + Math.random() * 24) * DPR;
      p.vx = Math.cos(a) * power;
      p.vy = Math.sin(a) * power;
    }

    // Sacudida de las letras de ACR✶TA
    chars.forEach((c) => {
      c.style.transform = `translate(${(Math.random() - 0.5) * 28}px, ${(Math.random() - 0.5) * 28}px) rotate(${(Math.random() - 0.5) * 16}deg)`;
      setTimeout(() => { c.style.transform = ""; }, 650);
    });
  }

  let seqTimers = [];
  function startSequence(fromZero = true) {
    seqTimers.forEach(clearTimeout);
    seqTimers = [];
    document.body.classList.add("is-intro");
    phase = "implode";
    phaseTime = performance.now();
    irisRadius = 0;

    if (introT) introT.textContent = "CONCENTRANDO MATERIA…";
    if (introBar) introBar.style.width = "18%";

    const tImplode = fromZero ? 1100 : 450;
    seqTimers.push(setTimeout(() => {
      if (introBar) introBar.style.width = "55%";
      if (introT) introT.textContent = "✶ EXPLOSIÓN DE NOVA ✶";
      triggerExplosion(W * 0.5, H * 0.5, true);
    }, tImplode));

    seqTimers.push(setTimeout(() => {
      if (introBar) introBar.style.width = "85%";
      if (introT) introT.textContent = "ACRETANDO ACR✶TA…";
    }, tImplode + 1950));

    seqTimers.push(setTimeout(() => {
      if (introBar) introBar.style.width = "100%";
      document.body.classList.remove("is-intro");
      if (heroStatusEl) heroStatusEl.textContent = "Fase: Acreción completada";
    }, tImplode + 3100));
  }

  function initHeroDots() {
    computeLayout();
    const build = () => {
      buildParticles(sampleLogoToDots());
      startSequence(true);
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(build).catch(build);
    } else {
      build();
    }
  }

  const heroEl = $("#hero");
  heroEl.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    heroMouse.x = (e.clientX - r.left) * DPR;
    heroMouse.y = (e.clientY - r.top) * DPR;
    heroMouse.active = true;
  });
  heroEl.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (!t) return;
    const r = canvas.getBoundingClientRect();
    heroMouse.x = (t.clientX - r.left) * DPR;
    heroMouse.y = (t.clientY - r.top) * DPR;
    heroMouse.active = true;
  }, { passive: true });
  heroEl.addEventListener("touchend", () => { heroMouse.active = false; heroMouse.x = heroMouse.y = -9999; }, { passive: true });
  heroEl.addEventListener("pointerleave", () => { heroMouse.active = false; heroMouse.x = heroMouse.y = -9999; });
  heroEl.addEventListener("pointerdown", (e) => {
    if (e.target.closest("a, button")) return;
    const r = canvas.getBoundingClientRect();
    if (e.pointerType === "touch") {
      heroMouse.x = (e.clientX - r.left) * DPR;
      heroMouse.y = (e.clientY - r.top) * DPR;
      heroMouse.active = true;
      return;
    }
    triggerExplosion((e.clientX - r.left) * DPR, (e.clientY - r.top) * DPR, false);
  });

  boomBtn.addEventListener("click", () => startSequence(false));
  modeBtn.addEventListener("click", () => {
    cosmosOnly = !cosmosOnly;
    modeBtn.classList.toggle("is-on", cosmosOnly);
    modeBtn.textContent = cosmosOnly ? "Fondo: Cosmos oscuro" : "Fondo: Lienzo / Cosmos";
  });

  function drawHero(now) {
    const rect = heroEl.getBoundingClientRect();
    if (rect.bottom < 0) return;

    // Fondo base espacial oscuro
    ctx.fillStyle = "#070709";
    ctx.fillRect(0, 0, W, H);

    // 1. Estrellas lejanas del cosmos
    for (let i = 0; i < bgStars.length; i++) {
      const st = bgStars[i];
      st.p += st.sp;
      ctx.globalAlpha = 0.25 + (Math.sin(st.p) * 0.5 + 0.5) * 0.55;
      ctx.fillStyle = "#ece8e0";
      ctx.fillRect(st.x, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;

    const dt = (now - phaseTime) / 1000;
    const cx = W * 0.5, cy = H * 0.5;

    // 2. Fase 1: Ignición / Implosión en el centro (0 -> 1.1s)
    if (phase === "implode") {
      const p = clamp(dt / 1.1, 0, 1);
      const pulse = 1 - p;

      // Halo incandescente previo al estallido
      const g = ctx.createRadialGradient(cx, cy, 4 * DPR, cx, cy, (140 + Math.sin(dt * 24) * 25) * DPR);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.25, "rgba(215, 255, 59, .95)");
      g.addColorStop(0.55, "rgba(255, 46, 76, .45)");
      g.addColorStop(1, "rgba(7, 7, 9, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 200 * DPR, 0, Math.PI * 2);
      ctx.fill();

      // Anillos gravitatorios colapsando hacia la estrella
      for (let rIdx = 1; rIdx <= 3; rIdx++) {
        const ringR = ((pulse * 220 * rIdx * 0.45) + 18) * DPR;
        ctx.strokeStyle = rIdx === 1 ? "#d7ff3b" : rIdx === 2 ? "#ff2e4c" : "rgba(236,232,224,.5)";
        ctx.lineWidth = (2.5 - rIdx * 0.5) * DPR;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, dt * (rIdx * 2), dt * (rIdx * 2) + Math.PI * 1.4);
        ctx.stroke();
      }

      // Espiral de partículas absorbiéndose hacia el núcleo
      for (let i = 0; i < dots.length; i += 2) {
        const pt = dots[i];
        const a = (i * 0.17) + dt * (4 + (i % 7));
        const dist = (8 + (i % 160) * (0.25 + pulse * 1.45)) * DPR;
        pt.x = cx + Math.cos(a) * dist;
        pt.y = cy + Math.sin(a) * dist;
        ctx.fillStyle = pt.crimson ? "#ff2e4c" : pt.acid ? "#d7ff3b" : "#ece8e0";
        ctx.fillRect(pt.x, pt.y, 2.2 * DPR, 2.2 * DPR);
      }
      return;
    }

    // Transición de "explode" (2.1 segundos de explosión visible a toda pantalla) a "form"
    if (phase === "explode" && dt > 2.1) {
      phase = "form";
      phaseTime = now;
      if (heroStatusEl) heroStatusEl.textContent = "Fase: Acretando figura…";
    }

    // 3. Iris a pantalla completa del lienzo hueso cuando las estrellas se unen en la figura
    const maxScreenR = Math.hypot(W, H);
    if (phase === "form" && !cosmosOnly) {
      irisRadius = lerp(irisRadius, maxScreenR * 1.05, 0.042);
    } else if (cosmosOnly) {
      irisRadius = lerp(irisRadius, 0, 0.12);
    }

    if (irisRadius > 2) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, irisRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#ece8e0";
      ctx.fill();
      if (irisRadius < maxScreenR * 0.95) {
        ctx.strokeStyle = "#d7ff3b";
        ctx.lineWidth = 4 * DPR;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Bola de fuego de la supernova en el centro durante la explosión
    for (let i = fireballs.length - 1; i >= 0; i--) {
      const fb = fireballs[i];
      fb.r += (fb.maxR - fb.r) * 0.055;
      fb.alpha *= 0.955;
      const fg = ctx.createRadialGradient(fb.x, fb.y, 2 * DPR, fb.x, fb.y, fb.r);
      fg.addColorStop(0, `rgba(255,255,255,${fb.alpha})`);
      fg.addColorStop(0.3, `rgba(215,255,59,${fb.alpha * 0.75})`);
      fg.addColorStop(0.65, `rgba(255,46,76,${fb.alpha * 0.38})`);
      fg.addColorStop(1, "rgba(7,7,9,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, fb.r, 0, Math.PI * 2);
      ctx.fill();
      if (fb.alpha < 0.02) fireballs.splice(i, 1);
    }

    // 4. Física de las ~9.800 partículas: explosión lenta -> convergencia en la figura a pantalla completa
    const formElapsed = phase === "form" ? (now - phaseTime) / 1000 : 0;
    // En "explode" casi no hay atracción al destino y la fricción es suave (0.968) para que la explosión dure y llene toda la pantalla
    const spring = phase === "explode"
      ? (dt < 1.2 ? 0 : 0.0025)
      : clamp(0.014 + formElapsed * 0.028, 0.014, 0.08);
    const damp = phase === "explode" ? 0.968 : 0.84;
    const repelR = Math.min(W, H) * 0.15;

    for (let i = 0; i < dots.length; i++) {
      const p = dots[i];
      p.px = p.x;
      p.py = p.y;

      // Si es punto del diseño va a figRect; si es punto ambiental cubre el resto de la pantalla completa (W × H)
      const tx = p.ambient
        ? p.u * W + Math.sin(now * 0.0008 + p.phase) * 4 * DPR
        : figRect.x + p.u * figRect.w;
      const ty = p.ambient
        ? p.v * H + Math.cos(now * 0.0008 + p.phase) * 4 * DPR
        : figRect.y + p.v * figRect.h;

      if (phase === "explode") {
        // Ligero remolino cósmico mientras se expanden tras la explosión
        const dxC = p.x - cx, dyC = p.y - cy;
        p.vx += -dyC * p.orbitSpeed * 0.06;
        p.vy += dxC * p.orbitSpeed * 0.06;
      }

      p.vx += (tx - p.x) * spring;
      p.vy += (ty - p.y) * spring;

      // Interacción con el cursor en toda la portada
      let nearCursor = false;
      if (heroMouse.active) {
        const dx = p.x - heroMouse.x;
        const dy = p.y - heroMouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < repelR) {
          nearCursor = true;
          const f = (1 - dist / repelR) * 3.8 * DPR;
          p.vx += (dx / (dist || 1)) * f;
          p.vy += (dy / (dist || 1)) * f;
        }
      }

      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx;
      p.y += p.vy;

      const speed = Math.hypot(p.vx, p.vy);
      const distFromCenter = Math.hypot(p.x - cx, p.y - cy);
      const onBone = !cosmosOnly && distFromCenter < irisRadius;
      const sz = Math.max(1.35 * DPR, p.s * (figRect.w / 620) * 0.78);

      if (onBone && speed < 6.5 * DPR && !nearCursor) {
        // En el lienzo hueso: las letras ACR y TA se dibujan en tinta negra y la estrella central destaca en rojo/tinta
        ctx.fillStyle = p.starGlyph ? (p.crimson ? "#ff2e4c" : "#070709") : "#070709";
        ctx.fillRect(p.x, p.y, sz, sz);
      } else {
        // Durante la explosión, al dispersar con el cursor o en Modo Cosmos: estrella brillante con estela
        const col = p.starGlyph
          ? (p.acid ? "#d7ff3b" : "#ff2e4c")
          : p.crimson
            ? "#ff2e4c"
            : p.acid
              ? (onBone ? "#070709" : "#d7ff3b")
              : (onBone ? "#ff2e4c" : "#ece8e0");

        if (speed > 2.2 * DPR) {
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(1.2 * DPR, sz * 0.95);
          ctx.beginPath();
          // Estela alargada para que la explosión sea súper visible
          ctx.moveTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else {
          ctx.fillStyle = col;
          ctx.fillRect(p.x, p.y, sz * 1.2, sz * 1.2);
        }
      }
    }

    // 5. Ondas expansivas de la explosión
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.r += (sw.maxR - sw.r) * sw.speed;
      sw.alpha *= 0.965;
      ctx.save();
      ctx.globalAlpha = sw.alpha;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.w * DPR;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (sw.alpha < 0.02) shockwaves.splice(i, 1);
    }
  }

  /* ---------------- Coordenadas astronómicas vivas ---------------- */
  const coordRA = $("#coordRA"), coordDEC = $("#coordDEC");
  function updateCoords() {
    const ra = (mouse.sx / innerWidth) * 24;
    const h = Math.floor(ra), m = Math.floor((ra - h) * 60);
    const dec = Math.round((0.5 - mouse.sy / innerHeight) * 180);
    coordRA.textContent = `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
    coordDEC.textContent = `${dec >= 0 ? "+" : ""}${dec}°`;
  }

  /* ---------------- Skew elástico al hacer scroll ---------------- */
  const skewEls = $$(".skew");
  let curSkew = 0;
  function updateSkew() {
    const target = clamp(scrollVel * 0.18, -5.5, 5.5);
    curSkew = lerp(curSkew, target, 0.12);
    scrollVel *= 0.9;
    skewEls.forEach((el) => { el.style.transform = `skewY(${curSkew.toFixed(2)}deg)`; });
  }

  /* ---------------- Galería de Drop 001 + Bolsa ---------------- */
  const glitchBox = $("#glitch");
  const glitchImgs = $$("img", glitchBox);
  $$("#thumbs button").forEach((b) => {
    b.addEventListener("click", () => {
      $$("#thumbs button").forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
      glitchImgs.forEach((im) => (im.src = b.dataset.src));
    });
  });

  const bag = $("#bag"), bagBody = $("#bagBody"), bagCount = $("#bagCount"), bagTotal = $("#bagTotal");
  const claimBtn = $("#claimBtn"), toast = $("#toast");
  const cart = [];
  const showToast = (msg) => {
    toast.textContent = msg; toast.classList.add("is-visible");
    clearTimeout(showToast.t); showToast.t = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  };
  const openBag = () => { bag.classList.add("is-open"); bag.setAttribute("aria-hidden", "false"); };
  const closeBag = () => { bag.classList.remove("is-open"); bag.setAttribute("aria-hidden", "true"); };

  function renderBag() {
    bagCount.textContent = cart.length;
    bagTotal.textContent = cart.reduce((a, c) => a + c.price, 0) + "€";
    if (!cart.length) {
      bagBody.innerHTML = `<p class="mono">Tu bolsa está vacía como el espacio profundo.</p>`;
      $("span", claimBtn).textContent = "Reclamar pieza";
      return;
    }
    bagBody.innerHTML = cart.map((c, i) => `
      <div class="bag__item">
        <img src="${c.img}" alt="" />
        <div><span class="mono">${c.ref}</span><h5>${c.name}</h5><span class="mono">Talla ${c.size} · ${c.price}€</span></div>
        <button class="mono" data-rm="${i}" data-cursor="Quitar">✕</button>
      </div>`).join("");
  }
  renderBag();

  claimBtn.addEventListener("click", () => {
    if (!cart.length) {
      cart.push({ ref: "NOVA 001 · 1/1", name: "Enana Blanca", size: "S", price: 85, img: "assets/img/look-02.jpg" });
      $("span", claimBtn).textContent = "En tu bolsa";
      renderBag();
      showToast("✶ Nova 001 atrapada en tu órbita");
    }
    setTimeout(openBag, 350);
  });
  bagBody.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm]");
    if (!rm) return;
    cart.splice(+rm.dataset.rm, 1);
    renderBag();
  });
  $("#bagBtn").addEventListener("click", openBag);
  $("#bagClose").addEventListener("click", closeBag);
  bag.addEventListener("click", (e) => { if (e.target === bag) closeBag(); });

  /* ---------------- Rastro de imágenes en Avistamientos ---------------- */
  const sightings = $("#avistamientos"), trail = $("#trail");
  const trailSources = [
    "assets/img/look-01.jpg",
    "assets/img/detalle.jpg",
    "assets/img/look-02.jpg",
    "assets/img/look-03.jpg",
    "assets/img/look-04.jpg",
  ];
  let lastTrailX = 0, lastTrailY = 0, trailIdx = 0;
  sightings.addEventListener("pointermove", (e) => {
    const r = sightings.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.hypot(x - lastTrailX, y - lastTrailY) < 75) return;
    lastTrailX = x; lastTrailY = y;
    const im = document.createElement("img");
    im.className = "trail-img";
    im.src = trailSources[trailIdx++ % trailSources.length];
    const rot = (Math.random() - 0.5) * 22;
    im.style.left = x + "px";
    im.style.top = y + "px";
    im.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(0.5)`;
    im.style.opacity = "0";
    trail.appendChild(im);
    requestAnimationFrame(() => {
      im.style.transition = "transform .45s cubic-bezier(.19,1,.22,1), opacity .45s";
      im.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(1)`;
      im.style.opacity = "1";
    });
    setTimeout(() => {
      im.style.opacity = "0";
      im.style.transform = `translate(-50%, -35%) rotate(${rot * 1.4}deg) scale(0.75)`;
      setTimeout(() => im.remove(), 450);
    }, 650);
  });

  /* =========================================================
     CONSTELACIONES + RUTA DE NOVAS (CADA DROP = EXPLOSIÓN DE NOVA)
     ========================================================= */
  const pieces = [
    { n: "NOVA 001", name: "Enana Blanca", tech: "Puntillismo a mano · ~40.000 puntos", desc: "Camisa blanca recuperada e intervenida punto a punto. Primera ignición de la ruta Acreta: disponible ahora.", p: 100, x: 14, y: 32, born: true },
    { n: "NOVA 002", name: "Nebulosa Índigo", tech: "Combinación textil · Sashiko + Denim", desc: "Chaqueta vaquera reconstruida con paneles de kimono antiguo y costuras vistas en hilo crudo.", p: 78, x: 29, y: 66 },
    { n: "NOVA 003", name: "Cinturón de Orión", tech: "Bordado astronómico + Ilustración", desc: "Vaquero recto con las tres estrellas de Orión bordadas e intervenidas con tinta sobre la cadera.", p: 52, x: 45, y: 26 },
    { n: "NOVA 004", name: "Marea Lunar", tech: "Upcycling de satén + Encaje", desc: "Vestido asimétrico que fusiona dos prendas olvidadas con trazos de constelación en la espalda.", p: 35, x: 58, y: 58 },
    { n: "NOVA 005", name: "Horizonte de Sucesos", tech: "Puntillismo inverso · Tinta blanca", desc: "Sudadera negra intervenida con miles de puntos blancos. El negativo estelar de la Nova 001.", p: 64, x: 72, y: 24 },
    { n: "NOVA 006", name: "Polvo Cósmico", tech: "Patchwork de 5 tejidos recuperados", desc: "Falda plisada de corte asiático construida con retales de cinco prendas con historia.", p: 22, x: 82, y: 74 },
    { n: "NOVA 007", name: "Perihelio", tech: "Trazo orbital + Serigrafía manual", desc: "Camiseta de algodón pesado con cartas celestes y coordenadas dibujadas a mano.", p: 88, x: 91, y: 40 },
  ];

  // Ruta secuencial principal (0->1->2->3->4->5->6) + líneas secundarias de constelación
  const routeLinks = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]];
  const auxLinks = [[0, 2], [1, 3], [2, 4], [3, 5], [4, 6]];

  const map = $("#chartMap");
  const linesSvg = $("#chartLines");
  const card = $("#chartCard");
  const routeStepsEl = $("#routeSteps");
  const chartCanvas = $("#chartCanvas");
  const cctx = chartCanvas.getContext("2d");

  let CW = 0, CH = 0;
  let activeNovaIdx = 0;
  const novaBursts = []; // Partículas de explosiones de Nova dentro del mapa
  const novaRings = [];  // Ondas expansivas de Nova dentro del mapa
  let routeTraveler = { from: 0, to: 1, t: 0 };

  function resizeChartCanvas() {
    CW = chartCanvas.width = map.clientWidth * DPR;
    CH = chartCanvas.height = map.clientHeight * DPR;
  }
  resizeChartCanvas();

  // Dibujar líneas SVG de constelación y ruta principal
  linesSvg.innerHTML =
    auxLinks.map(([a, b]) => `<line class="constellation-aux" x1="${pieces[a].x * 10}" y1="${pieces[a].y * 5.6}" x2="${pieces[b].x * 10}" y2="${pieces[b].y * 5.6}"/>`).join("") +
    routeLinks.map(([a, b]) => `<line class="route-line" x1="${pieces[a].x * 10}" y1="${pieces[a].y * 5.6}" x2="${pieces[b].x * 10}" y2="${pieces[b].y * 5.6}"/>`).join("");

  // Crear barra superior de pasos de la ruta
  routeStepsEl.innerHTML = pieces.map((pc, i) => `
    <button type="button" class="route-step ${pc.born ? "is-born" : ""} ${i === 0 ? "is-active" : ""}" data-step="${i}" data-cursor="Detonar">
      <i></i><span>${pc.n} · ${pc.name}</span>
    </button>
    ${i < pieces.length - 1 ? `<span class="route-arrow">→</span>` : ""}
  `).join("");

  // Detona una explosión de Nova en la estrella `idx` del mapa de constelación
  function detonateChartNova(idx) {
    const pc = pieces[idx];
    const x = (pc.x / 100) * CW;
    const y = (pc.y / 100) * CH;

    novaRings.push({ x, y, r: 4 * DPR, maxR: 130 * DPR, alpha: 1, color: pc.born ? "#d7ff3b" : "#ff2e4c" });
    novaRings.push({ x, y, r: 2 * DPR, maxR: 85 * DPR, alpha: 0.85, color: "#ece8e0" });

    for (let i = 0; i < 110; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1.5 + Math.pow(Math.random(), 0.7) * 9.5) * DPR;
      novaBursts.push({
        x, y,
        px: x, py: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        alpha: 1,
        decay: 0.014 + Math.random() * 0.015,
        size: (1.2 + Math.random() * 2.2) * DPR,
        color: i % 3 === 0 ? "#d7ff3b" : i % 5 === 0 ? "#ff2e4c" : "#ece8e0",
      });
    }
  }

  const starBtns = [];
  function selectNova(idx, triggerBurst = true) {
    const prevIdx = activeNovaIdx;
    activeNovaIdx = (idx + pieces.length) % pieces.length;
    const pc = pieces[activeNovaIdx];
    const star = starBtns[activeNovaIdx];

    if (prevIdx !== activeNovaIdx) {
      routeTraveler = { from: prevIdx, to: activeNovaIdx, t: 0 };
    }
    if (triggerBurst) detonateChartNova(activeNovaIdx);

    starBtns.forEach((b, i) => b.classList.toggle("is-active", i === activeNovaIdx));
    $$(".route-step", routeStepsEl).forEach((b, i) => b.classList.toggle("is-active", i === activeNovaIdx));

    $("#cardN").textContent = `${pc.n} · RUTA 0${activeNovaIdx + 1}/0${pieces.length}`;
    $("#cardBadge").textContent = pc.born ? "NOVA ACTIVA · 1/1" : `ACRECIÓN ${pc.p}%`;
    $("#cardBadge").style.background = pc.born ? "var(--acid)" : "var(--crimson)";
    $("#cardBadge").style.color = pc.born ? "var(--ink)" : "var(--bone)";
    $("#cardName").textContent = pc.name;
    $("#cardTech").textContent = pc.tech;
    $("#cardDesc").textContent = pc.desc;
    $("#cardState").textContent = pc.born ? "Disponible en Drop 001" : `Fase de ignición: ${pc.p}%`;
    $("#cardBar").style.width = pc.p + "%";

    const mr = map.getBoundingClientRect(), sr = star.getBoundingClientRect();
    const cw = card.offsetWidth || 300;
    let left = sr.left - mr.left + 34, top = sr.top - mr.top - 30;
    if (left + cw + 14 > mr.width) left = sr.left - mr.left - cw - 16;
    left = clamp(left, 10, Math.max(10, mr.width - cw - 10));
    top = clamp(top, 14, Math.max(14, mr.height - 255));
    card.style.left = left + "px";
    card.style.top = top + "px";
    card.classList.add("is-visible");
  }

  pieces.forEach((pc, idx) => {
    const s = document.createElement("button");
    s.className = "star" + (pc.born ? " star--born" : "");
    s.style.left = pc.x + "%"; s.style.top = pc.y + "%";
    s.dataset.cursor = "💥 Nova";
    s.innerHTML = `<span class="star__core"></span><span class="star__label">${pc.n}</span>`;
    s.addEventListener("pointerenter", () => selectNova(idx, true));
    s.addEventListener("click", () => selectNova(idx, true));
    map.appendChild(s);
    starBtns.push(s);
  });

  routeStepsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-step]");
    if (!btn) return;
    selectNova(+btn.dataset.step, true);
  });

  $("#nextNovaBtn").addEventListener("click", () => {
    selectNova(activeNovaIdx + 1, true);
  });

  // Cuando la sección de constelaciones entra en pantalla, detonamos la Nova activa
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) selectNova(activeNovaIdx, true);
  }, { threshold: 0.35 }).observe(map);

  function drawChartCanvas(now) {
    const r = map.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;

    cctx.clearRect(0, 0, CW, CH);

    // 1. Pulsos luminosos viajando constantemente a lo largo de la ruta de Novas
    for (let i = 0; i < routeLinks.length; i++) {
      const [aIdx, bIdx] = routeLinks[i];
      const A = pieces[aIdx], B = pieces[bIdx];
      const ax = (A.x / 100) * CW, ay = (A.y / 100) * CH;
      const bx = (B.x / 100) * CW, by = (B.y / 100) * CH;
      const t = ((now * 0.00045) + i * 0.22) % 1;
      const px = lerp(ax, bx, t), py = lerp(ay, by, t);

      cctx.fillStyle = "#d7ff3b";
      cctx.beginPath();
      cctx.arc(px, py, 3 * DPR, 0, Math.PI * 2);
      cctx.fill();
    }

    // 2. Viajero rápido cuando el usuario salta de una Nova a otra
    if (routeTraveler.t < 1) {
      routeTraveler.t = Math.min(1, routeTraveler.t + 0.06);
      const A = pieces[routeTraveler.from], B = pieces[routeTraveler.to];
      const px = lerp((A.x / 100) * CW, (B.x / 100) * CW, routeTraveler.t);
      const py = lerp((A.y / 100) * CH, (B.y / 100) * CH, routeTraveler.t);
      cctx.fillStyle = "#ff2e4c";
      cctx.beginPath();
      cctx.arc(px, py, 6 * DPR, 0, Math.PI * 2);
      cctx.fill();
    }

    // 3. Partículas de explosión de Nova en cada estrella
    for (let i = novaBursts.length - 1; i >= 0; i--) {
      const p = novaBursts[i];
      p.px = p.x; p.py = p.y;
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.94; p.vy *= 0.94;
      p.alpha -= p.decay;
      if (p.alpha <= 0) { novaBursts.splice(i, 1); continue; }
      cctx.save();
      cctx.globalAlpha = p.alpha;
      cctx.strokeStyle = p.color;
      cctx.lineWidth = p.size;
      cctx.beginPath();
      cctx.moveTo(p.px, p.py);
      cctx.lineTo(p.x, p.y);
      cctx.stroke();
      cctx.restore();
    }

    // 4. Ondas de choque de cada Nova
    for (let i = novaRings.length - 1; i >= 0; i--) {
      const nr = novaRings[i];
      nr.r += (nr.maxR - nr.r) * 0.09;
      nr.alpha *= 0.93;
      cctx.save();
      cctx.globalAlpha = nr.alpha;
      cctx.strokeStyle = nr.color;
      cctx.lineWidth = 2 * DPR;
      cctx.beginPath();
      cctx.arc(nr.x, nr.y, nr.r, 0, Math.PI * 2);
      cctx.stroke();
      cctx.restore();
      if (nr.alpha < 0.02) novaRings.splice(i, 1);
    }
  }

  /* ---------------- Contadores + Cuenta atrás ---------------- */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target; countIO.unobserve(el);
      const target = +el.dataset.count, t0 = performance.now();
      const step = (now) => {
        const p = clamp((now - t0) / 1500, 0, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("es-ES");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  const DROP_DATE = new Date("2026-12-04T20:00:00+01:00");
  const cdEls = { d: $('[data-cd="d"]'), h: $('[data-cd="h"]'), m: $('[data-cd="m"]'), s: $('[data-cd="s"]') };
  const tickCD = () => {
    let diff = Math.max(0, DROP_DATE - new Date());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const m = Math.floor(diff / 6e4); diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    cdEls.d.textContent = String(d).padStart(2, "0");
    cdEls.h.textContent = String(h).padStart(2, "0");
    cdEls.m.textContent = String(m).padStart(2, "0");
    cdEls.s.textContent = String(s).padStart(2, "0");
  };
  tickCD(); setInterval(tickCD, 1000);

  $("#orbitForm").addEventListener("submit", (e) => {
    e.preventDefault();
    $("input", e.target).value = "";
    $("#orbitMsg").textContent = "✶ Estás dentro de la órbita. Te avisaremos antes de la próxima Nova.";
    showToast("✶ Bienvenida a la órbita");
  });

  /* ---------------- Bucle principal ---------------- */
  function loop(now) {
    mouse.sx = lerp(mouse.sx, mouse.x, 0.1);
    mouse.sy = lerp(mouse.sy, mouse.y, 0.1);
    drawHero(now);
    drawChartCanvas(now);
    updateCoords();
    updateSkew();
    requestAnimationFrame(loop);
  }

  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      computeLayout();
      resizeChartCanvas();
    }, 180);
  });

  initHeroDots();
  requestAnimationFrame(loop);
})();
