/* ==========================================================================
   Tminihu 站点交互
   依赖：GSAP + ScrollTrigger（js/vendor/，本地自托管）
   ========================================================================== */
(function () {
  "use strict";

  /* --- 环境判断 -------------------------------------------------------- */
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile =
    ("ontouchstart" in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768;
  const hasIO = "IntersectionObserver" in window;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const gsapReady = typeof window.gsap !== "undefined";
  if (gsapReady && window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  /* ======================================================================
     1. 主题切换（localStorage 记忆）
     ====================================================================== */
  function initTheme() {
    const btn = $("#themeToggle");
    if (!btn) return;
    const root = document.documentElement;
    const saved = localStorage.getItem("theme");
    if (saved) root.setAttribute("data-theme", saved);

    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  /* ======================================================================
     2. 顶栏滚动态 + 滚动进度条
     ====================================================================== */
  function initNavProgress() {
    const nav = $("#nav");
    const bar = $(".scroll-progress");
    let queued = false;

    function update() {
      const y = window.scrollY;
      if (nav) nav.classList.toggle("scrolled", y > 50);
      if (bar) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
      }
      queued = false;
    }

    window.addEventListener("scroll", () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });

    update();
  }

  /* ======================================================================
     3. 平滑锚点跳转
     ====================================================================== */
  function initSmoothAnchors() {
    $$('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        if (!href || href === "#") return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* ======================================================================
     4. 鼠标追光
     ====================================================================== */
  function initSpotlight() {
    const el = $("#spotlight");
    if (!el) return;
    if (isMobile) {
      el.style.display = "none";
      return;
    }
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    let queued = false;

    document.addEventListener("mousemove", (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!queued) {
        requestAnimationFrame(() => {
          el.style.setProperty("--mx", x + "px");
          el.style.setProperty("--my", y + "px");
          queued = false;
        });
        queued = true;
      }
    }, { passive: true });

    window.addEventListener("scroll", () => {
      if (window.innerWidth <= 768) return;
      const off = window.pageYOffset;
      const max = document.body.scrollHeight - window.innerHeight;
      el.style.opacity = String(Math.max(0, 0.5 - (off / max) * 0.4));
    }, { passive: true });
  }

  /* ======================================================================
     5. 神经网络背景画布
     ====================================================================== */
  const NEURAL_CONFIG = {
    linkDistance: 150,
    closeDistance: 65,
    mouseRadius: 200,
    mouseForce: 0.08,
    rippleMax: 250,
    rippleSpeed: 3,
    drag: 0.96,
    maxSpeed: 1.2,
    nodes: 80,
    nodesMobile: 40,
    parallax: 0.12,
    closeLinkColor: "198, 249, 76" /* 近距离连线偏黄绿 */
  };

  const THEME_COLORS = {
    dark: { rgb: "139, 92, 246", glow: 0.14 },
    light: { rgb: "124, 58, 237", glow: 0.1 }
  };

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? THEME_COLORS.dark
      : THEME_COLORS.light;
  }

  function createNode(w, h) {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      baseR: Math.random() * 1.4 + 0.7,
      phase: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.5 + 0.25
    };
  }

  function initNeuralCanvas() {
    const canvas = $("#neuralCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;
    let nodes = [];
    const ripples = [];
    let palette = currentTheme();
    const pointer = { x: 0, y: 0, active: false };
    let parallaxOffset = 0;
    let frame = null;
    let running = false;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 视口变小时把越界节点拉回
      nodes.forEach((n) => {
        if (n.x > w) n.x = Math.random() * w;
        if (n.y > h) n.y = Math.random() * h;
      });
    }

    function seed() {
      const count = isMobile ? NEURAL_CONFIG.nodesMobile : NEURAL_CONFIG.nodes;
      nodes = [];
      for (let i = 0; i < count; i++) nodes.push(createNode(w, h));
    }

    /* 更新单个节点：漂移 + 鼠标斥力 + 阻尼 + 环绕
       pointerInCanvas：鼠标在「画布坐标系」中的位置（已抵消 parallax 偏移） */
    function stepNode(n, pointerInCanvas) {
      const source = pointerInCanvas || null;
      n.x += n.vx;
      n.y += n.vy;
      n.phase += 0.02;

      if (n.x < -10) n.x = w + 10;
      else if (n.x > w + 10) n.x = -10;
      if (n.y < -10) n.y = h + 10;
      else if (n.y > h + 10) n.y = -10;

      if (source && source.active) {
        const dx = source.x - n.x;
        const dy = source.y - n.y;
        const dist = Math.hypot(dx, dy);
        if (dist < NEURAL_CONFIG.mouseRadius && dist > 0.01) {
          const f = (1 - dist / NEURAL_CONFIG.mouseRadius) * NEURAL_CONFIG.mouseForce;
          n.vx += (dx / dist) * f;
          n.vy += (dy / dist) * f;
        }
      }

      n.vx *= NEURAL_CONFIG.drag;
      n.vy *= NEURAL_CONFIG.drag;
      const speed = Math.hypot(n.vx, n.vy);
      if (speed > NEURAL_CONFIG.maxSpeed) {
        n.vx = (n.vx / speed) * NEURAL_CONFIG.maxSpeed;
        n.vy = (n.vy / speed) * NEURAL_CONFIG.maxSpeed;
      }
    }

    function drawLinks() {
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist >= NEURAL_CONFIG.linkDistance) continue;
          const alpha =
            dist < NEURAL_CONFIG.closeDistance
              ? (1 - dist / NEURAL_CONFIG.closeDistance) * 0.28
              : (1 - dist / NEURAL_CONFIG.linkDistance) * 0.11;
          ctx.strokeStyle =
            dist < NEURAL_CONFIG.closeDistance
              ? "rgba(" + NEURAL_CONFIG.closeLinkColor + ", " + alpha + ")"
              : "rgba(" + palette.rgb + ", " + alpha + ")";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    function drawNodes() {
      ctx.globalCompositeOperation = "lighter";
      nodes.forEach((n) => {
        const r = n.baseR + Math.sin(n.phase) * 0.35;
        const glow = Math.max(r * 4, 0.5);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glow);
        g.addColorStop(0, "rgba(" + palette.rgb + ", " + palette.glow + ")");
        g.addColorStop(1, "rgba(" + palette.rgb + ", 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, glow, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";
      nodes.forEach((n) => {
        const r = n.baseR + Math.sin(n.phase) * 0.35;
        ctx.fillStyle = "rgba(" + palette.rgb + ", " + n.opacity + ")";
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawRipples() {
      ctx.lineWidth = 2;
      ripples.forEach((p) => {
        const alpha = (1 - p.r / NEURAL_CONFIG.rippleMax) * 0.4;
        if (alpha <= 0) return;
        ctx.strokeStyle = "rgba(" + palette.rgb + ", " + alpha + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    function render() {
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(0, parallaxOffset);
      drawLinks();
      drawNodes();
      ctx.restore();
      drawRipples();
    }

    function tick() {
      const local = pointer.active ? { x: pointer.x, y: pointer.y - parallaxOffset, active: true } : null;
      nodes.forEach((n) => stepNode(n, local));
      ripples.forEach((p) => {
        p.r += NEURAL_CONFIG.rippleSpeed;
      });
      for (let i = ripples.length - 1; i >= 0; i--) {
        if (ripples[i].r > NEURAL_CONFIG.rippleMax) ripples.splice(i, 1);
      }
      render();
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (running || reducedMotion) return;
      running = true;
      frame = requestAnimationFrame(tick);
    }
    function stop() {
      running = false;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    }

    seed();
    resize();
    if (reducedMotion) render();
    else start();

    if (!isMobile && !reducedMotion) {
      window.addEventListener("mousemove", (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.active = true;
      }, { passive: true });
      document.addEventListener("mouseleave", () => { pointer.active = false; }, { passive: true });
      window.addEventListener("click", (e) => {
        ripples.push({ x: e.clientX, y: e.clientY, r: 0 });
        if (ripples.length > 12) ripples.shift();
      }, { passive: true });
    }

    if (!reducedMotion) {
      window.addEventListener("scroll", () => {
        parallaxOffset = window.scrollY * NEURAL_CONFIG.parallax;
      }, { passive: true });
    }
    window.addEventListener("resize", resize, { passive: true });

    if (hasIO) {
      new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), {
        threshold: 0
      }).observe(canvas);
    }
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

    // 主题切换后重建配色
    new MutationObserver(() => {
      palette = currentTheme();
      if (reducedMotion) render();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    window.addEventListener("beforeunload", stop, { passive: true });
  }

  /* ======================================================================
     6. 磁吸按钮
     ====================================================================== */
  function initMagnetic() {
    if (isMobile || reducedMotion) return;
    const items = $$(".magnetic");
    if (!items.length) return;
    const STRENGTH = 0.35;
    const RESET_DELAY = 300;

    items.forEach((el) => {
      let queued = false;
      let timer = null;
      el.addEventListener("mousemove", (e) => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        el.style.transition = "none";
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          const box = el.getBoundingClientRect();
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          const dx = (e.clientX - cx) * STRENGTH;
          const dy = (e.clientY - cy) * STRENGTH;
          el.style.transform = "translate(" + dx + "px, " + dy + "px)";
          queued = false;
        });
      });
      el.addEventListener("mouseleave", () => {
        el.style.transition = "";
        timer = setTimeout(() => {
          el.style.transform = "";
        }, RESET_DELAY);
      });
    });
  }

  /* ======================================================================
     7. 名片 3D 倾斜
     ====================================================================== */
  function initProfileTilt() {
    if (isMobile || reducedMotion) return;
    const card = $(".profile-card");
    if (!card) return;
    const MAX_DEG = 6;
    const PERSPECTIVE = 800;
    let queued = false;

    card.style.transformStyle = "preserve-3d";
    if (card.parentElement) card.parentElement.style.perspective = PERSPECTIVE + "px";

    card.addEventListener("mousemove", (e) => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        const box = card.getBoundingClientRect();
        const ratioX = (e.clientX - box.left) / box.width;
        const rotX = (0.5 - (e.clientY - box.top) / box.height) * MAX_DEG * 2;
        const rotY = (ratioX - 0.5) * MAX_DEG * 2;
        card.style.transform =
          "perspective(" + PERSPECTIVE + "px) rotateX(" + rotX + "deg) rotateY(" + rotY + "deg) translateY(-4px)";
        queued = false;
      });
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  }

  /* ======================================================================
     8. 能力卡片 hover 追光
     ====================================================================== */
  function initCellSpotlight() {
    if (isMobile || reducedMotion) return;
    const cells = $$(".sg-cell");
    if (!cells.length) return;
    let queued = false;

    cells.forEach((cell) => {
      cell.addEventListener("mousemove", (e) => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          const box = cell.getBoundingClientRect();
          cell.style.setProperty("--sx", e.clientX - box.left + "px");
          cell.style.setProperty("--sy", e.clientY - box.top + "px");
          queued = false;
        });
      });
      cell.addEventListener("mouseleave", () => {
        cell.style.setProperty("--sx", "50%");
        cell.style.setProperty("--sy", "50%");
      });
    });
  }

  /* ======================================================================
     9. 导航当前区块高亮
     ====================================================================== */
  function initNavActive() {
    const links = $$('.nav-r a[href^="#"]');
    if (!links.length || !hasIO) return;
    const map = new Map();
    links.forEach((link) => {
      const id = link.getAttribute("href").slice(1);
      const section = document.getElementById(id);
      if (section) map.set(section, link);
    });
    if (!map.size) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const link = map.get(entry.target);
        if (!link || !entry.isIntersecting) return;
        links.forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
      });
    }, { rootMargin: "-40% 0px -50% 0px", threshold: 0 });

    map.forEach((link, section) => io.observe(section));
  }

  /* ======================================================================
     10. Hero 入场时间线
     ====================================================================== */
  function initHeroIntro() {
    const heading = $("#hh");
    if (!heading) return;
    const lines = heading.querySelectorAll(".hero-line");
    const sub = $(".hero-sub");
    const strip = $("#hstrip");

    if (reducedMotion || !gsapReady) {
      if (sub) sub.classList.add("in");
      if (strip) strip.classList.add("in");
      return;
    }

    const gsap = window.gsap;
    gsap.set(lines, { yPercent: 110 });

    const revealSub = () => {
      if (sub) sub.classList.add("in");
      if (strip) strip.classList.add("in");
    };

    const tl = gsap.timeline({
      delay: 0.3,
      onComplete: revealSub
    });
    tl.to(lines[0], { yPercent: 0, duration: 0.8, ease: "power3.out" });
    tl.to(lines[1], { yPercent: 0, duration: 0.8, ease: "power3.out" }, "-=0.5");
    tl.fromTo(
      ".hs-item",
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power3.out" },
      "-=0.3"
    );

    /* 兜底：低帧率/后台标签页下 rAF 可能被节流，确保终态可见 */
    setTimeout(revealSub, 2600);
  }

  /* ======================================================================
     11. 滚动揭示动画
     ====================================================================== */
  function reveal(config) {
    if (!gsapReady || reducedMotion || !config.targets) return;
    const gsap = window.gsap;
    const list = typeof config.targets === "string" ? $$(config.targets) : config.targets;
    if (!list.length) return;
    gsap.fromTo(
      list,
      config.from,
      Object.assign({}, config.to, {
        scrollTrigger: {
          trigger: config.trigger,
          start: config.start,
          toggleActions: "play none none reverse"
        }
      })
    );
  }

  function initReveals() {
    if (!gsapReady || reducedMotion) return;
    const gsap = window.gsap;

    reveal({
      targets: ".about-layout",
      from: { opacity: 0, y: 30 },
      to: { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" },
      trigger: "#about",
      start: "top 70%"
    });

    $$(".s-h").forEach((el) => {
      reveal({
        targets: [el],
        from: { y: 30, opacity: 0 },
        to: { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
        trigger: el,
        start: "top 85%"
      });
    });

    $$(".s-label").forEach((el) => {
      reveal({
        targets: [el],
        from: { x: -20, opacity: 0 },
        to: { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
        trigger: el,
        start: "top 90%"
      });
    });

    reveal({
      targets: ".c-cell",
      from: { y: 60, opacity: 0 },
      to: { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "power3.out" },
      trigger: "#courses",
      start: "top 75%"
    });

    reveal({
      targets: ".rm-p-cell",
      from: { y: 40, opacity: 0 },
      to: { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "power3.out" },
      trigger: "#roadmap",
      start: "top 75%"
    });

    reveal({
      targets: ".sg-cell",
      from: { y: 30, opacity: 0 },
      to: { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" },
      trigger: ".skill-grid",
      start: "top 80%"
    });

    reveal({
      targets: ".m-card",
      from: { y: 50, opacity: 0, scale: 0.92 },
      to: { y: 0, opacity: 1, scale: 1, duration: 0.6, stagger: 0.12, ease: "power3.out" },
      trigger: "#moments",
      start: "top 75%"
    });

    $$(".stat-item").forEach((el, i) => {
      reveal({
        targets: [el],
        from: { y: 20, opacity: 0 },
        to: { y: 0, opacity: 1, duration: 0.5, delay: i * 0.08, ease: "power3.out" },
        trigger: el,
        start: "top 85%"
      });
    });

    reveal({
      targets: ".cert-frame, .cert-info",
      from: { y: 40, opacity: 0 },
      to: { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: "power3.out" },
      trigger: ".cert-layout",
      start: "top 80%"
    });

    reveal({
      targets: ".contact-card",
      from: { y: 40, opacity: 0 },
      to: { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "power3.out" },
      trigger: "#contact",
      start: "top 75%"
    });

    /* 时间线：桌面端 pin 左侧标题，并逐条揭示 */
    const items = $$(".tl-item");
    if (window.innerWidth > 1024) {
      window.ScrollTrigger.create({
        trigger: "#exp",
        start: "top top",
        end: "bottom bottom",
        pin: "#tlSticky",
        pinSpacing: false
      });
      items.forEach((el, i) => {
        reveal({
          targets: [el],
          from: { opacity: 0, y: 30 },
          to: { opacity: 1, y: 0, duration: 0.6, delay: i * 0.15, ease: "power3.out" },
          trigger: el,
          start: "top 75%"
        });
      });
    } else {
      items.forEach((el) => {
        reveal({
          targets: [el],
          from: { opacity: 0, y: 20 },
          to: { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
          trigger: el,
          start: "top 85%"
        });
      });
    }
  }

  /* ======================================================================
     12. 技术栈 chips 交错入场
     ====================================================================== */
  function initStackChips() {
    const row = $("#stack-row");
    if (!row || !hasIO) return;
    const chips = row.querySelectorAll(".s-chip");
    chips.forEach((chip) => {
      chip.style.opacity = "0";
      chip.style.transform = "translateY(12px)";
    });

    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      chips.forEach((chip, i) => {
        setTimeout(() => {
          chip.style.transition = "opacity .4s ease, transform .4s ease";
          chip.style.opacity = "1";
          chip.style.transform = "translateY(0)";
        }, i * 80);
      });
      io.unobserve(entry.target);
    }, { threshold: 0.3 });

    io.observe(row);
  }

  /* ======================================================================
     13. 数字统计动画
     ====================================================================== */
  function initCounters() {
    const numbers = $$(".stat-n");
    if (!numbers.length || !hasIO) return;

    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      numbers.forEach((el) => {
        const target = parseInt(el.dataset.target, 10);
        const suffix = target === 98 ? "%" : target === 500 ? "+" : "";
        const stepValue = Math.ceil(target / 40);
        let current = 0;
        const timer = setInterval(() => {
          current += stepValue;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          el.textContent = current + suffix;
        }, 30);
      });
      io.unobserve(entry.target);
    }, { threshold: 0.5 });

    const row = document.getElementById("statsRow");
    if (row) io.observe(row);
  }

  /* ======================================================================
     14. 证书灯箱
     ====================================================================== */
  function initCertLightbox() {
    const frame = $("#certFrame");
    if (!frame) return;
    const img = frame.querySelector("img");
    if (!img) return;

    const box = document.createElement("div");
    box.className = "cert-lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "证书大图查看器");

    const big = document.createElement("img");
    big.src = img.src;
    big.alt = img.alt;
    box.appendChild(big);
    document.body.appendChild(box);

    const open = () => {
      box.classList.add("open");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      box.classList.remove("open");
      document.body.style.overflow = "";
    };

    frame.addEventListener("click", open);
    frame.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
    box.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  /* ======================================================================
     15. 教学现场相册灯箱（支持键盘 / 触摸滑动）
     ====================================================================== */
  function initGallery() {
    const cards = $$(".m-card");
    if (!cards.length) return;

    const slides = cards.map((card) => {
      const img = card.querySelector(".m-img");
      const tag = card.querySelector(".m-tag");
      const title = card.querySelector(".m-info h3");
      const desc = card.querySelector(".m-info p");
      return {
        src: img ? img.getAttribute("data-full") : "",
        alt: img ? img.getAttribute("data-alt") : "",
        tag: tag ? tag.textContent.trim() : "",
        title: title ? title.textContent.trim() : "",
        desc: desc ? desc.textContent.trim() : ""
      };
    });

    const box = document.createElement("div");
    box.className = "gal-lb";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "教学现场照片查看器");
    box.innerHTML =
      '<button class="gal-lb-close" type="button" aria-label="关闭">&times;</button>' +
      '<button class="gal-lb-nav prev" type="button" aria-label="上一张">&#8249;</button>' +
      '<figure class="gal-lb-stage">' +
      '<img class="gal-lb-img" alt="" />' +
      '<figcaption class="gal-lb-cap">' +
      '<span class="gal-lb-tag"></span>' +
      '<h3 class="gal-lb-title"></h3>' +
      '<p class="gal-lb-desc"></p>' +
      "</figcaption>" +
      "</figure>" +
      '<button class="gal-lb-nav next" type="button" aria-label="下一张">&#8250;</button>' +
      '<div class="gal-lb-count"></div>';
    document.body.appendChild(box);

    const bigImg = box.querySelector(".gal-lb-img");
    const tagEl = box.querySelector(".gal-lb-tag");
    const titleEl = box.querySelector(".gal-lb-title");
    const descEl = box.querySelector(".gal-lb-desc");
    const countEl = box.querySelector(".gal-lb-count");

    let index = 0;
    let lastFocus = null;

    function show(i) {
      index = (i + slides.length) % slides.length;
      const slide = slides[index];
      bigImg.style.animation = "none";
      void bigImg.offsetWidth; /* 强制重排以重播入场动画 */
      bigImg.style.animation = "";
      bigImg.src = slide.src;
      bigImg.alt = slide.alt;
      tagEl.textContent = slide.tag;
      titleEl.textContent = slide.title;
      descEl.textContent = slide.desc;
      countEl.textContent = index + 1 + " / " + slides.length;
    }

    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.classList.add("open");
      document.body.style.overflow = "hidden";
      box.querySelector(".gal-lb-close").focus();
    }
    function close() {
      box.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    const next = () => show(index + 1);
    const prev = () => show(index - 1);

    cards.forEach((card, i) => {
      card.style.cursor = "zoom-in";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "查看大图：" + slides[i].title);
      card.addEventListener("click", () => open(i));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(i);
        }
      });
    });

    box.querySelector(".gal-lb-close").addEventListener("click", close);
    box.querySelector(".gal-lb-nav.prev").addEventListener("click", prev);
    box.querySelector(".gal-lb-nav.next").addEventListener("click", next);
    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.classList.contains("gal-lb-stage")) close();
    });
    document.addEventListener("keydown", (e) => {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    });

    let touchStartX = null;
    box.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (touchStartX === null) return;
      const delta = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(delta) > 50) (delta < 0 ? next : prev)();
      touchStartX = null;
    }, { passive: true });
  }

  /* ======================================================================
     16. 微信号复制
     ====================================================================== */
  function initCopyButton() {
    const btn = $(".contact-copy");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const text = btn.dataset.clipboardText;
      if (!text) return;
      const label = btn.querySelector("span");
      const original = label.textContent;

      const done = () => {
        label.textContent = "已复制!";
        btn.classList.add("copied");
        if (!reducedMotion) {
          btn.style.transform = "scale(1.08)";
          setTimeout(() => {
            btn.style.transform = "";
          }, 200);
        }
        setTimeout(() => {
          label.textContent = original;
          btn.classList.remove("copied");
        }, 2000);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
      } else {
        fallbackCopy(text, done);
      }
    });

    function fallbackCopy(text, callback) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        callback();
      } catch (err) {
        console.error("Failed to copy:", err);
      }
      document.body.removeChild(ta);
    }
  }

  /* ======================================================================
     17. 课程大纲标签页（支持方向键）
     ====================================================================== */
  function initSyllabusTabs() {
    const tabs = $$(".syl-tab");
    const panels = $$(".syl-panel");
    if (!tabs.length || !panels.length) return;

    function select(name, focus) {
      tabs.forEach((tab) => {
        const active = tab.dataset.syl === name;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
        tab.setAttribute("tabindex", active ? "0" : "-1");
        if (active && focus) tab.focus();
      });
      panels.forEach((panel) => {
        const active = panel.dataset.syl === name;
        panel.classList.toggle("is-active", active);
        if (active) panel.removeAttribute("hidden");
        else panel.setAttribute("hidden", "");
      });
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab.dataset.syl));
      tab.addEventListener("keydown", (e) => {
        let target = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") target = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") target = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === "Home") target = tabs[0];
        else if (e.key === "End") target = tabs[tabs.length - 1];
        if (!target) return;
        e.preventDefault();
        select(target.dataset.syl, true);
      });
    });

    const initial = tabs.find((tab) => tab.classList.contains("is-active")) || tabs[0];
    select(initial.dataset.syl);
  }

  /* ======================================================================
     18. Hero "Enter" 提示淡出
     ====================================================================== */
  function initHeroEnter() {
    const hint = $(".hero-enter");
    const hero = $(".hero");
    if (!hint || !hero || !hasIO) return;
    new IntersectionObserver(([entry]) => {
      hint.classList.toggle("out", !entry.isIntersecting);
    }, { threshold: 0.15 }).observe(hero);
  }

  /* ======================================================================
     启动
     ====================================================================== */
  function boot() {
    initTheme();
    initNavProgress();
    initSmoothAnchors();
    initSpotlight();
    initNeuralCanvas();
    initMagnetic();
    initProfileTilt();
    initCellSpotlight();
    initNavActive();
    initCounters();
    initCertLightbox();
    initGallery();
    initCopyButton();
    initSyllabusTabs();
    initStackChips();
    initHeroEnter();
    initHeroIntro();
    initReveals();

    if (window.ScrollTrigger) {
      requestAnimationFrame(() => window.ScrollTrigger.refresh());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
