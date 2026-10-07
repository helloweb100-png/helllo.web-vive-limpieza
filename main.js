/* ==========================================================================
   VIVE-LIMPIEZA — main.js
   JavaScript nativo (sin librerías). Módulos independientes y comentados.

   01. Utilidades
   02. Loader (spinner de carga)
   03. Header, menú móvil y progreso de lectura
   04. Burbujas (canvas) — hero y contacto
   05. Hero: parallax orbital + palabras rotativas
   06. Efectos de scroll (reveal, parallax, manifiesto, proceso, contadores)
   07. Interacciones (tilt, botones magnéticos, foco de cursor)
   08. Demo "limpia la tela"
   09. Preguntas frecuentes
   10. Formulario → WhatsApp
   11. WhatsApp flotante, imágenes de respaldo y extras
   ========================================================================== */
(() => {
    'use strict';

    /* ======================================================================
       01. UTILIDADES
       ====================================================================== */
    const doc = document.documentElement;
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    const lerp = (a, b, t) => a + (b - a) * t;
    const rand = (min, max) => min + Math.random() * (max - min);
    const TAU = Math.PI * 2;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const desktopMQ = window.matchMedia('(min-width: 900px)');

    /** Número de WhatsApp del negocio (formato internacional, sin +) */
    const WA_NUMBER = '526672445395';

    /** Generador pseudoaleatorio con semilla (la mugre siempre se ve igual) */
    function mulberry32(seed) {
        return () => {
            seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /** Ejecuta fn cuando el elemento entra a pantalla (o de inmediato si no hay IntersectionObserver) */
    function onVisible(el, fn, options = { threshold: 0.3 }) {
        if (!('IntersectionObserver' in window)) { fn(); return; }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) { fn(entry); io.unobserve(entry.target); }
            });
        }, options);
        io.observe(el);
    }

    // Estado de visibilidad de pestaña: pausa animaciones pesadas
    let tabHidden = document.hidden;
    const visibilityListeners = [];
    document.addEventListener('visibilitychange', () => {
        tabHidden = document.hidden;
        visibilityListeners.forEach((fn) => fn(tabHidden));
    });


    /* ======================================================================
       02. LOADER — progreso simulado + espera real de carga y fuentes
       ====================================================================== */
    function initLoader() {
        const loader = $('#loader');
        if (!loader) { doc.classList.add('is-ready'); onSiteReady(); return; }

        doc.classList.add('is-loading');

        const ring = $('.loader__progress', loader);
        const liquid = $('.loader__liquid', loader);
        const pctEl = $('#loader-pct');
        const statusEl = $('#loader-status');
        const CIRC = 565.49;
        const MIN_TIME = reduceMotion ? 350 : 2400;      // duración mínima visible
        const MAX_TIME = 9000;                           // tope de seguridad

        const messages = [
            [0, 'Preparando tu espacio…'],
            [28, 'Quitando manchas…'],
            [56, 'Sacando brillo…'],
            [82, 'Dejando todo impecable…'],
            [100, '¡Listo!'],
        ];

        let progress = 0;
        let pageLoaded = false;
        let fontsReady = false;
        let finished = false;
        let lastMsg = -1;
        const t0 = performance.now();

        // Esperas reales: evento load + fuentes web
        if (document.readyState === 'complete') pageLoaded = true;
        else window.addEventListener('load', () => { pageLoaded = true; }, { once: true });

        if (document.fonts && document.fonts.ready) {
            Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2800))]).then(() => { fontsReady = true; });
        } else {
            fontsReady = true;
        }

        function render(p) {
            const n = clamp(p, 0, 100);
            ring.style.strokeDashoffset = String(CIRC * (1 - n / 100));
            liquid.style.transform = `translateY(${46 * (1 - n / 100)}px)`;
            pctEl.textContent = String(Math.round(n));
            let idx = 0;
            for (let i = 0; i < messages.length; i++) if (n >= messages[i][0]) idx = i;
            if (idx !== lastMsg) { lastMsg = idx; statusEl.textContent = messages[idx][1]; }
        }

        function finish() {
            if (finished) return;
            finished = true;
            render(100);
            loader.classList.add('is-full');
            setTimeout(() => {
                loader.classList.add('is-done');
                doc.classList.remove('is-loading');
                setTimeout(() => doc.classList.add('is-ready'), 380);   // el hero entra mientras se abre la cortina
                setTimeout(() => { loader.remove(); }, 1700);
                onSiteReady();
            }, reduceMotion ? 100 : 650);
        }

        function tick(now) {
            if (finished) return;
            const elapsed = now - t0;
            const ready = (pageLoaded && fontsReady) || elapsed > MAX_TIME;
            const timeP = clamp(elapsed / MIN_TIME, 0, 1);
            const eased = 1 - Math.pow(1 - timeP, 2.2);
            // Mientras no cargue todo, el avance se detiene en 92 %
            const target = ready ? eased * 100 : Math.min(eased * 100, 92);
            progress = lerp(progress, target, 0.12);
            render(progress);
            if (ready && timeP >= 1 && progress > 99.4) { finish(); return; }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }


    /* ======================================================================
       03. HEADER, MENÚ MÓVIL, ENLACE ACTIVO
       ====================================================================== */
    function initHeader() {
        const header = $('.header');
        const toggle = $('#menu-toggle');
        const nav = $('#primary-nav');
        if (!header || !toggle || !nav) return;

        const setMenu = (open) => {
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            nav.classList.toggle('is-open', open);
            doc.classList.toggle('is-locked', open);
        };

        toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
        $$('a', nav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
        desktopMQ.addEventListener('change', (e) => { if (e.matches) setMenu(false); });

        // Enlace activo según la sección en pantalla
        if ('IntersectionObserver' in window) {
            const links = $$('.nav__link', nav);
            const byId = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    links.forEach((l) => l.classList.remove('is-active'));
                    const link = byId.get(entry.target.id);
                    if (link) link.classList.add('is-active');
                });
            }, { rootMargin: '-45% 0px -50% 0px' });
            ['inicio', 'servicios', 'nosotros', 'demo', 'proceso', 'faq', 'contacto'].forEach((id) => {
                const sec = document.getElementById(id);
                if (sec) io.observe(sec);
            });
        }
    }


    /* ======================================================================
       04. BURBUJAS (canvas) — constantes, reaccionan al cursor y se revientan
       ====================================================================== */
    function createBubbles(canvas, { density = 1, pop = true } = {}) {
        const ctx = canvas && canvas.getContext && canvas.getContext('2d');
        if (!ctx) return null;
        const host = canvas.parentElement;

        let w = 0, h = 0, dpr = 1;
        let bubbles = [], stars = [], bursts = [], rings = [];
        let raf = 0, last = 0, visible = false, running = false;
        const pointer = { x: -999, y: -999, on: false };

        function makeBubble(initial) {
            const big = Math.pow(Math.random(), 3);
            const r = rand(3, 9) + big * 24;
            return {
                x: rand(0, w), y: initial ? rand(0, h) : h + r + rand(0, 120), r,
                vy: 0.22 + r * 0.016 + rand(0, 0.22), vx: 0,
                phase: rand(0, TAU), freq: rand(0.0006, 0.0016), a: rand(0.4, 0.85),
            };
        }
        function makeStar() {
            return { x: rand(0, w), y: rand(0, h), s: rand(4, 9), phase: rand(0, TAU), speed: rand(0.0008, 0.002), c: Math.random() > 0.55 ? '#d4ff6a' : '#ffffff' };
        }

        function resize() {
            const rect = host.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            w = rect.width; h = rect.height;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = Math.round(clamp(w / 30, 14, 46) * density);
            while (bubbles.length < count) bubbles.push(makeBubble(true));
            bubbles.length = Math.min(bubbles.length, count);
            const starCount = Math.round(clamp(w / 90, 6, 16) * density);
            while (stars.length < starCount) stars.push(makeStar());
            stars.length = Math.min(stars.length, starCount);
            if (!running) draw(performance.now());      // fotograma estático (p. ej. movimiento reducido)
        }

        function drawBubble(b) {
            const { x, y, r, a } = b;
            const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
            g.addColorStop(0, `rgba(255,255,255,${0.5 * a})`);
            g.addColorStop(0.45, `rgba(120,235,235,${0.07 * a})`);
            g.addColorStop(1, `rgba(47,227,212,${0.26 * a})`);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
            ctx.lineWidth = 1; ctx.strokeStyle = `rgba(200,250,250,${0.38 * a})`; ctx.stroke();
            if (r > 7) {                                  // reflejo curvo
                ctx.beginPath(); ctx.arc(x, y, r * 0.72, Math.PI * 1.1, Math.PI * 1.42);
                ctx.strokeStyle = `rgba(255,255,255,${0.6 * a})`; ctx.lineWidth = Math.max(1, r * 0.09); ctx.lineCap = 'round'; ctx.stroke();
            }
        }

        function drawStar(s, alpha) {
            ctx.save(); ctx.translate(s.x, s.y); ctx.globalAlpha = alpha; ctx.fillStyle = s.c;
            ctx.shadowColor = s.c; ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(0, -s.s); ctx.quadraticCurveTo(0, 0, s.s, 0); ctx.quadraticCurveTo(0, 0, 0, s.s);
            ctx.quadraticCurveTo(0, 0, -s.s, 0); ctx.quadraticCurveTo(0, 0, 0, -s.s);
            ctx.fill(); ctx.restore();
        }

        function popAt(x, y) {
            if (reduceMotion) return;
            for (let i = 0; i < 9; i++) {
                const ang = (i / 9) * TAU + rand(-0.3, 0.3), sp = rand(1.2, 3.2);
                bursts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.6, r: rand(1.2, 3), life: 0, max: rand(26, 44) });
            }
            rings.push({ x, y, r: 4, life: 0, max: 22 });
        }

        function draw(now) {
            const dt = clamp((now - last) / 16.67, 0.2, 3);
            last = now;
            ctx.clearRect(0, 0, w, h);

            // Destellos
            for (const s of stars) {
                const v = Math.sin(now * s.speed + s.phase);
                if (v > 0) drawStar(s, Math.pow(v, 3) * 0.9);
            }

            // Burbujas
            for (let i = 0; i < bubbles.length; i++) {
                const b = bubbles[i];
                if (running) {
                    b.y -= b.vy * dt;
                    b.vx *= 0.95;
                    b.x += (Math.sin(now * b.freq + b.phase) * 0.28 + b.vx) * dt;
                    if (pointer.on) {
                        const dx = b.x - pointer.x, dy = b.y - pointer.y, R = 110 + b.r, d2 = dx * dx + dy * dy;
                        if (d2 < R * R && d2 > 1) {
                            const d = Math.sqrt(d2), f = (1 - d / R) * 0.9;
                            b.vx += (dx / d) * f; b.y += (dy / d) * f * 0.6;
                        }
                    }
                    if (b.y < -b.r - 12) bubbles[i] = makeBubble(false);
                }
                drawBubble(b);
            }

            // Gotas de explosión y anillos
            for (let i = bursts.length - 1; i >= 0; i--) {
                const p = bursts[i];
                p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.07 * dt; p.vx *= 0.985; p.life += dt;
                const k = 1 - p.life / p.max;
                if (k <= 0) { bursts.splice(i, 1); continue; }
                ctx.fillStyle = `rgba(190,250,250,${k * 0.9})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + k * 0.5), 0, TAU); ctx.fill();
            }
            for (let i = rings.length - 1; i >= 0; i--) {
                const g = rings[i]; g.life += dt; g.r += 1.6 * dt;
                const k = 1 - g.life / g.max;
                if (k <= 0) { rings.splice(i, 1); continue; }
                ctx.strokeStyle = `rgba(212,255,106,${k * 0.8})`; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, TAU); ctx.stroke();
            }
        }

        function loop(now) {
            if (!running) return;
            raf = requestAnimationFrame(loop);
            draw(now);
        }
        function sync() {
            const shouldRun = visible && !tabHidden && !reduceMotion;
            if (shouldRun && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
            else if (!shouldRun && running) { running = false; cancelAnimationFrame(raf); }
        }

        // Entrada del puntero
        const toLocal = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
        host.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            const p = toLocal(e); pointer.x = p.x; pointer.y = p.y; pointer.on = true;
        }, { passive: true });
        host.addEventListener('pointerleave', () => { pointer.on = false; }, { passive: true });
        if (pop) {
            host.addEventListener('pointerdown', (e) => {
                if (e.target.closest('a, button, input, select, textarea, label, form')) return;
                const p = toLocal(e);
                for (let i = 0; i < bubbles.length; i++) {
                    const b = bubbles[i], dx = b.x - p.x, dy = b.y - p.y, R = b.r + 16;
                    if (dx * dx + dy * dy < R * R) { popAt(b.x, b.y); bubbles[i] = makeBubble(false); break; }
                }
            }, { passive: true });
        }

        // Visibilidad y tamaño
        if ('IntersectionObserver' in window) {
            new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0 }).observe(host);
        } else { visible = true; }
        if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host);
        else window.addEventListener('resize', resize);
        visibilityListeners.push(sync);

        resize();
        sync();
        return { resize };
    }

    function initBubbles() {
        createBubbles($('#bubbles'), { density: 1, pop: true });
        createBubbles($('#bubbles-2'), { density: 0.7, pop: true });
    }


    /* ======================================================================
       05. HERO — parallax orbital con el cursor + palabras rotativas
       ====================================================================== */
    function initHeroOrbit() {
        const hero = $('#inicio');
        const orbit = $('#orbit');
        if (!hero || !orbit || reduceMotion || !finePointer) return;

        let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
        const step = () => {
            cx = lerp(cx, tx, 0.08); cy = lerp(cy, ty, 0.08);
            orbit.style.setProperty('--px', cx.toFixed(3));
            orbit.style.setProperty('--py', cy.toFixed(3));
            if (Math.abs(cx - tx) > 0.002 || Math.abs(cy - ty) > 0.002) raf = requestAnimationFrame(step); else raf = 0;
        };
        const kick = () => { if (!raf) raf = requestAnimationFrame(step); };

        hero.addEventListener('pointermove', (e) => {
            const r = hero.getBoundingClientRect();
            tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
            ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
            kick();
        }, { passive: true });
        hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); }, { passive: true });
    }

    function initRotator() {
        const el = $('#rotator');
        if (!el || reduceMotion || !el.animate) return;
        const words = ['tu sala', 'tus tapetes', 'tu colchón', 'el interior de tu auto', 'tu casa después de la obra', 'tus cortinas'];
        let i = 0;
        const out = [{ transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' }, { transform: 'translateY(-55%)', opacity: 0, filter: 'blur(4px)' }];
        const inn = [{ transform: 'translateY(55%)', opacity: 0, filter: 'blur(4px)' }, { transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' }];
        const opts = { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' };

        const next = () => {
            if (tabHidden) return;
            el.animate(out, opts).onfinish = () => {
                i = (i + 1) % words.length;
                el.textContent = words[i];
                el.animate(inn, opts);
            };
        };
        setInterval(next, 2700);
    }


    /* ======================================================================
       06. EFECTOS DE SCROLL
       ====================================================================== */
    function initReveal() {
        // Escalonado (stagger) para hijos de contenedores [data-stagger]
        $$('[data-stagger]').forEach((group) => {
            $$(':scope > [data-reveal]', group).forEach((el, i) => el.style.setProperty('--rd', String(i)));
        });
        const items = $$('[data-reveal]');
        if (reduceMotion || !('IntersectionObserver' in window)) {
            items.forEach((el) => el.classList.add('is-in'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        items.forEach((el) => io.observe(el));
    }

    /** Contadores animados (0 → n) */
    function initCounters() {
        $$('.count').forEach((el) => {
            const target = Number(el.dataset.count) || 0;
            if (reduceMotion) { el.textContent = String(target); return; }
            onVisible(el, () => {
                const dur = 1700, t0 = performance.now();
                const tick = (now) => {
                    const p = clamp((now - t0) / dur, 0, 1);
                    el.textContent = String(Math.round((1 - Math.pow(1 - p, 4)) * target));
                    if (p < 1) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            }, { threshold: 0.6 });
        });
    }

    /** Un solo ciclo de scroll para: header, progreso, parallax, manifiesto y proceso */
    function initScrollEffects() {
        const header = $('.header');
        const bar = $('#scroll-progress');
        const parallaxImgs = $$('[data-parallax-img]');
        const manifesto = $('#manifesto');
        const steps = $('#steps');
        const stepItems = steps ? $$('.step', steps) : [];

        // Divide el manifiesto en palabras para encenderlas con el scroll
        let words = [];
        if (manifesto) {
            const accent = new Set(['fondo', 'nuevo']);
            const text = manifesto.textContent.trim().replace(/\s+/g, ' ');
            manifesto.innerHTML = text.split(' ').map((word) => {
                const clean = word.toLowerCase().replace(/[.,;:!?¿¡]/g, '');
                return `<span class="mw${accent.has(clean) ? ' mw--accent' : ''}">${word}</span>`;
            }).join(' ');
            words = $$('.mw', manifesto);
            if (reduceMotion) words.forEach((w) => w.classList.add('is-lit'));
        }

        let litCount = 0;
        let ticking = false;

        function update() {
            ticking = false;
            const y = window.scrollY || doc.scrollTop;
            const vh = window.innerHeight;

            // --- lecturas (se agrupan para evitar relayouts) ---
            const max = Math.max(1, doc.scrollHeight - vh);
            const mRect = manifesto && !reduceMotion ? manifesto.getBoundingClientRect() : null;
            const sRect = steps ? steps.getBoundingClientRect() : null;
            const pRects = reduceMotion ? [] : parallaxImgs.map((img) => img.parentElement.getBoundingClientRect());

            // --- escrituras ---
            if (header) header.classList.toggle('is-scrolled', y > 24);
            if (bar) bar.style.transform = `scaleX(${clamp(y / max, 0, 1).toFixed(4)})`;

            // Parallax suave en fotos de servicios
            pRects.forEach((r, i) => {
                if (r.bottom < -100 || r.top > vh + 100) return;
                const k = clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
                parallaxImgs[i].style.translate = `0 ${(-k * r.height * 0.07).toFixed(1)}px`;
            });

            // Manifiesto: palabras que se encienden al avanzar
            if (mRect && words.length) {
                const start = vh * 0.88;
                const end = vh * 0.5 - mRect.height;
                const p = clamp((start - mRect.top) / (start - end), 0, 1);
                const count = Math.round(p * words.length);
                if (count !== litCount) {
                    const from = Math.min(count, litCount), to = Math.max(count, litCount);
                    for (let i = from; i < to; i++) words[i].classList.toggle('is-lit', i < count);
                    litCount = count;
                }
            }

            // Proceso: línea que se llena y pasos que se activan
            if (sRect && stepItems.length) {
                const anchor = vh * 0.62;
                const p = clamp((anchor - sRect.top) / (sRect.height + vh * 0.12), 0, 1);
                steps.style.setProperty('--prog', p.toFixed(4));
                const n = stepItems.length;
                if (desktopMQ.matches) {
                    stepItems.forEach((s, i) => s.classList.toggle('is-active', p >= i / n + 0.03));
                } else {
                    stepItems.forEach((s) => {
                        const top = s.getBoundingClientRect().top - sRect.top + 34;
                        s.classList.toggle('is-active', top <= p * sRect.height);
                    });
                }
            }
        }

        const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
        window.addEventListener('scroll', request, { passive: true });
        window.addEventListener('resize', request, { passive: true });
        update();
    }


    /* ======================================================================
       07. INTERACCIONES — tilt 3D, botones magnéticos, foco de cursor
       ====================================================================== */
    function initTilt() {
        if (!finePointer || reduceMotion) return;
        $$('[data-tilt]').forEach((card) => {
            let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
            const MAX = 5;
            const step = () => {
                cx = lerp(cx, tx, 0.12); cy = lerp(cy, ty, 0.12);
                card.style.setProperty('--rx', `${cx.toFixed(2)}deg`);
                card.style.setProperty('--ry', `${cy.toFixed(2)}deg`);
                raf = (Math.abs(cx - tx) > 0.01 || Math.abs(cy - ty) > 0.01) ? requestAnimationFrame(step) : 0;
            };
            card.addEventListener('pointermove', (e) => {
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
                tx = (0.5 - y) * MAX * 2; ty = (x - 0.5) * MAX * 2;
                card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
                card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
                if (!raf) raf = requestAnimationFrame(step);
            }, { passive: true });
            card.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); }, { passive: true });
        });
    }

    function initMagnetic() {
        if (!finePointer || reduceMotion) return;
        $$('[data-magnetic]').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                const x = (e.clientX - (r.left + r.width / 2)) * 0.22;
                const y = (e.clientY - (r.top + r.height / 2)) * 0.32;
                el.style.setProperty('--tx', `${clamp(x, -10, 10).toFixed(1)}px`);
                el.style.setProperty('--ty', `${clamp(y, -8, 8).toFixed(1)}px`);
            }, { passive: true });
            el.addEventListener('pointerleave', () => { el.style.setProperty('--tx', '0px'); el.style.setProperty('--ty', '0px'); }, { passive: true });
        });
    }

    /** Foco luminoso que sigue al cursor en secciones oscuras */
    function initSpotlight() {
        if (!finePointer) return;
        $$('[data-spot]').forEach((sec) => {
            let raf = 0, ex = 0, ey = 0;
            sec.addEventListener('pointermove', (e) => {
                const r = sec.getBoundingClientRect();
                ex = e.clientX - r.left; ey = e.clientY - r.top;
                if (!raf) raf = requestAnimationFrame(() => {
                    sec.style.setProperty('--mx', `${ex}px`); sec.style.setProperty('--my', `${ey}px`); raf = 0;
                });
            }, { passive: true });
        });
    }


    /* ======================================================================
       08. DEMO "LIMPIA LA TELA"
       Canvas con mugre que se borra con el cursor/dedo, espuma, progreso real
       y recompensa (CTA) al terminar. También hay botón de limpieza automática.
       ====================================================================== */
    function initWipe() {
        const root = $('#wipe');
        const surface = $('#wipe-surface');
        const canvas = $('#wipe-canvas');
        const fx = $('#wipe-fx');
        if (!root || !surface || !canvas || !fx) return;

        const ctx = canvas.getContext('2d');
        const fctx = fx.getContext('2d');
        const pctEl = $('#wipe-pct');
        const doneEl = $('#wipe-done');
        const liveEl = $('#wipe-live');
        const btnAuto = $('#wipe-auto');
        const btnReset = $('#wipe-reset');

        const mask = document.createElement('canvas');
        const mctx = mask.getContext('2d', { willReadFrequently: true });
        const MW = 72;
        let MH = 54;

        let w = 0, h = 0, dpr = 1, brush = 44;
        let started = false, done = false, pressed = false, last = null;
        let foam = [], fxRaf = 0, autoRaf = 0, lastCheck = 0, shownPct = 0;

        /* ---- Pintar la mugre (determinista) ---- */
        function paintDirt() {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, w, h);
            const rnd = mulberry32(20241);

            ctx.fillStyle = 'rgba(88,68,46,0.55)';
            ctx.fillRect(0, 0, w, h);

            // Manchones de tono
            for (let i = 0; i < 18; i++) {
                const x = rnd() * w, y = rnd() * h, r = (0.12 + rnd() * 0.24) * Math.min(w, h) * 1.3;
                const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                const dark = rnd() > 0.35;
                g.addColorStop(0, dark ? 'rgba(52,34,18,0.55)' : 'rgba(122,98,66,0.38)');
                g.addColorStop(1, 'rgba(52,34,18,0)');
                ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
            }
            // Manchas de café (anillos)
            for (let i = 0; i < 5; i++) {
                const x = (0.12 + rnd() * 0.76) * w, y = (0.12 + rnd() * 0.76) * h, r = (0.035 + rnd() * 0.05) * w;
                const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
                g.addColorStop(0, 'rgba(128,84,40,0.3)'); g.addColorStop(1, 'rgba(100,64,30,0.1)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
                ctx.lineWidth = 2 + rnd() * 4; ctx.strokeStyle = 'rgba(58,36,16,0.6)';
                ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
            }
            // Polvo y motas
            const specks = Math.round((w * h) / 240);
            for (let i = 0; i < specks; i++) {
                ctx.fillStyle = `rgba(${40 + (rnd() * 40 | 0)},${28 + (rnd() * 26 | 0)},18,${0.1 + rnd() * 0.38})`;
                ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.4, 1 + rnd() * 2.4);
            }
            // Mugre en los bordes
            const eg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
            eg.addColorStop(0, 'rgba(30,20,10,0)'); eg.addColorStop(1, 'rgba(30,20,10,0.5)');
            ctx.fillStyle = eg; ctx.fillRect(0, 0, w, h);
        }

        function setup() {
            const rect = surface.getBoundingClientRect();
            if (!rect.width || !rect.height) return false;
            w = rect.width; h = rect.height;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            [canvas, fx].forEach((c) => { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); });
            fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            MH = Math.max(8, Math.round(MW * h / w));
            mask.width = MW; mask.height = MH;
            brush = clamp(w * 0.085, 34, 70);
            return true;
        }

        function resetState() {
            started = false; done = false; pressed = false; last = null; shownPct = 0; foam = [];
            cancelAnimationFrame(autoRaf); autoRaf = 0;
            mctx.clearRect(0, 0, MW, MH);
            root.classList.remove('is-started', 'is-done');
            doneEl.hidden = true;
            pctEl.textContent = '0%';
            btnAuto.disabled = false;
            paintDirt();
        }

        /* ---- Borrado ---- */
        function stamp(x, y) {
            ctx.globalCompositeOperation = 'destination-out';
            const g = ctx.createRadialGradient(x, y, brush * 0.3, x, y, brush);
            g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, brush, 0, TAU); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            mctx.fillStyle = '#fff'; mctx.beginPath();
            mctx.arc(x * (MW / w), y * (MH / h), brush * 0.72 * (MW / w), 0, TAU); mctx.fill();
        }

        function wipeTo(x, y) {
            if (done) return;
            if (!started) { started = true; root.classList.add('is-started'); }
            if (last) {
                const dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy);
                const steps = Math.max(1, Math.ceil(dist / (brush * 0.28)));
                for (let i = 1; i <= steps; i++) stamp(last.x + (dx * i) / steps, last.y + (dy * i) / steps);
                if (dist > 4) spawnFoam(x, y, Math.min(3, Math.ceil(dist / 22)));
            } else {
                stamp(x, y);
            }
            last = { x, y };
            const now = performance.now();
            if (now - lastCheck > 110) { lastCheck = now; measure(); }
        }

        function measure() {
            const data = mctx.getImageData(0, 0, MW, MH).data;
            let covered = 0;
            for (let i = 3; i < data.length; i += 4) if (data[i] > 110) covered++;
            const cov = covered / (MW * MH);
            const pct = clamp(Math.round((cov / 0.86) * 100), 0, 100);
            if (pct !== shownPct) { shownPct = pct; pctEl.textContent = `${pct}%`; }
            if (pct >= 100) finish();
        }

        function finish() {
            if (done) return;
            done = true; pressed = false; last = null;
            cancelAnimationFrame(autoRaf); autoRaf = 0;
            pctEl.textContent = '100%';
            btnAuto.disabled = true;
            doneEl.hidden = false;
            requestAnimationFrame(() => root.classList.add('is-done'));
            if (liveEl) liveEl.textContent = 'Limpieza completa. Pide tu cotización por WhatsApp.';
            if (!reduceMotion) celebrate();
        }

        /* ---- Espuma y destellos ---- */
        function spawnFoam(x, y, n) {
            if (reduceMotion) return;
            for (let i = 0; i < n && foam.length < 110; i++) {
                foam.push({ x: x + rand(-brush * 0.5, brush * 0.5), y: y + rand(-brush * 0.5, brush * 0.5), vx: rand(-0.3, 0.3), vy: rand(-0.7, -0.15), r: rand(2, 7), life: 0, max: rand(28, 60) });
            }
            startFx();
        }
        function celebrate() {
            for (let i = 0; i < 60; i++) {
                foam.push({ x: rand(0, w), y: rand(h * 0.3, h), vx: rand(-0.6, 0.6), vy: rand(-2.2, -0.6), r: rand(2, 9), life: 0, max: rand(50, 100), star: Math.random() > 0.6 });
            }
            startFx();
        }
        function startFx() { if (!fxRaf) fxRaf = requestAnimationFrame(fxLoop); }
        function fxLoop() {
            fctx.clearRect(0, 0, w, h);
            for (let i = foam.length - 1; i >= 0; i--) {
                const p = foam[i];
                p.x += p.vx; p.y += p.vy; p.life++;
                const k = 1 - p.life / p.max;
                if (k <= 0) { foam.splice(i, 1); continue; }
                if (p.star) {
                    fctx.save(); fctx.translate(p.x, p.y); fctx.globalAlpha = k; fctx.fillStyle = '#d4ff6a';
                    fctx.beginPath(); fctx.moveTo(0, -p.r); fctx.quadraticCurveTo(0, 0, p.r, 0); fctx.quadraticCurveTo(0, 0, 0, p.r);
                    fctx.quadraticCurveTo(0, 0, -p.r, 0); fctx.quadraticCurveTo(0, 0, 0, -p.r); fctx.fill(); fctx.restore();
                } else {
                    const g = fctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.1, p.x, p.y, p.r);
                    g.addColorStop(0, `rgba(255,255,255,${0.85 * k})`); g.addColorStop(1, `rgba(190,250,250,${0.25 * k})`);
                    fctx.fillStyle = g; fctx.beginPath(); fctx.arc(p.x, p.y, p.r, 0, TAU); fctx.fill();
                    fctx.strokeStyle = `rgba(255,255,255,${0.7 * k})`; fctx.lineWidth = 1; fctx.stroke();
                }
            }
            fxRaf = foam.length ? requestAnimationFrame(fxLoop) : 0;
            if (!foam.length) fctx.clearRect(0, 0, w, h);
        }

        /* ---- Limpieza automática (zig-zag) ---- */
        function autoClean() {
            if (done || autoRaf) return;
            const rowH = brush * 0.8;
            const rows = Math.max(2, Math.ceil(h / rowH));
            const dur = reduceMotion ? 500 : 2600;
            const t0 = performance.now();
            let prevS = 0;
            last = null;
            const point = (s) => {
                const row = Math.min(rows - 1, Math.floor(s)), frac = s - row;
                return { x: (row % 2 === 0 ? frac : 1 - frac) * w, y: Math.min(h, (row + 0.5) * (h / rows)) };
            };
            const tick = (now) => {
                const s = clamp((now - t0) / dur, 0, 1) * rows;
                for (let q = prevS; q < s; q += 0.02) { const p = point(q); wipeTo(p.x, p.y); }
                const p = point(s); wipeTo(p.x, p.y);
                prevS = s;
                if (s < rows && !done) autoRaf = requestAnimationFrame(tick);
                else { autoRaf = 0; if (!done) { mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, MW, MH); measure(); } }
            };
            autoRaf = requestAnimationFrame(tick);
        }

        /* ---- Eventos del puntero ---- */
        const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
        canvas.addEventListener('pointerdown', (e) => {
            pressed = true; last = null;
            try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* no-op */ }
            const p = local(e); wipeTo(p.x, p.y);
        });
        canvas.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse' && !pressed) return;      // con mouse basta pasar el cursor
            if (autoRaf) return;
            const p = local(e); wipeTo(p.x, p.y);
        });
        const endStroke = () => { pressed = false; last = null; };
        canvas.addEventListener('pointerup', endStroke);
        canvas.addEventListener('pointercancel', endStroke);
        canvas.addEventListener('pointerleave', endStroke);

        btnAuto.addEventListener('click', autoClean);
        btnReset.addEventListener('click', () => { if (setup()) resetState(); });

        /* ---- Tamaño ---- */
        let lastW = 0;
        const onResize = () => {
            const rect = surface.getBoundingClientRect();
            if (!rect.width || Math.abs(rect.width - lastW) < 2) return;
            lastW = rect.width;
            if (!setup()) return;
            if (done) { fctx.clearRect(0, 0, w, h); return; }
            resetState();
        };
        if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(surface);
        else window.addEventListener('resize', onResize);
        onResize();
        if (!lastW) { setup(); resetState(); }
    }


    /* ======================================================================
       09. PREGUNTAS FRECUENTES (acordeón accesible)
       ====================================================================== */
    function initAccordion() {
        const items = $$('.acc');
        items.forEach((item) => {
            const btn = $('.acc__btn', item);
            btn.addEventListener('click', () => {
                const open = btn.getAttribute('aria-expanded') === 'true';
                items.forEach((other) => {
                    const b = $('.acc__btn', other);
                    const isThis = other === item;
                    const next = isThis ? !open : false;
                    b.setAttribute('aria-expanded', String(next));
                    other.classList.toggle('is-open', next);
                });
            });
        });
    }


    /* ======================================================================
       10. FORMULARIO → WHATSAPP
       ====================================================================== */
    function initForm() {
        const form = $('#contact-form');
        if (!form) return;
        const nombre = $('#f-nombre');
        const servicio = $('#f-servicio');
        const detalles = $('#f-detalles');
        const status = $('#form-status');
        const submit = $('#form-submit');

        const setError = (input, errId, msg) => {
            const field = input.closest('.field');
            field.classList.toggle('has-error', Boolean(msg));
            $(errId).textContent = msg || '';
            input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        };
        [nombre, servicio].forEach((el) => el.addEventListener('input', () => setError(el, `#err-${el.name}`, '')));
        servicio.addEventListener('change', () => setError(servicio, '#err-servicio', ''));

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nombre.value.trim();
            const service = servicio.value;
            let firstInvalid = null;

            if (name.length < 2) { setError(nombre, '#err-nombre', 'Escribe tu nombre para saber cómo llamarte.'); firstInvalid = firstInvalid || nombre; }
            else setError(nombre, '#err-nombre', '');
            if (!service) { setError(servicio, '#err-servicio', 'Elige qué quieres limpiar.'); firstInvalid = firstInvalid || servicio; }
            else setError(servicio, '#err-servicio', '');

            if (firstInvalid) {
                status.textContent = '';
                firstInvalid.focus();
                form.classList.remove('is-shaking'); void form.offsetWidth; form.classList.add('is-shaking');
                return;
            }

            let text = `Hola VIVE-LIMPIEZA, soy ${name}.\nQuiero cotizar: ${service}.`;
            const extra = detalles.value.trim();
            if (extra) text += `\nDetalles: ${extra}`;
            text += '\n(Enviado desde su página web)';
            const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

            const win = window.open(url, '_blank');
            if (win) win.opener = null;
            status.innerHTML = win
                ? '¡Listo! Abrimos WhatsApp con tu mensaje.'
                : `Toca aquí si WhatsApp no se abrió: <a href="${url}" target="_blank" rel="noopener">abrir WhatsApp</a>`;
            submit.disabled = true;
            setTimeout(() => { submit.disabled = false; form.reset(); }, 4000);
        });
    }


    /* ======================================================================
       11. EXTRAS — WhatsApp flotante, imágenes de respaldo, año
       ====================================================================== */
    function initFab() {
        const fab = $('#wa-fab');
        if (!fab) return;
        setTimeout(() => fab.classList.add('is-visible'), 900);
        // Globo invitando a escribir (una sola vez)
        setTimeout(() => {
            if (tabHidden) return;
            fab.classList.add('show-bubble');
            setTimeout(() => fab.classList.remove('show-bubble'), 5200);
        }, 8000);
    }

    function initImageFallbacks() {
        $$('img').forEach((img) => {
            const bad = () => img.classList.add('is-broken');
            if (img.complete && img.naturalWidth === 0 && img.currentSrc) bad();
            img.addEventListener('error', bad, { once: true });
        });
    }

    function initYear() {
        const y = $('#year');
        if (y) y.textContent = String(new Date().getFullYear());
    }


    /* ======================================================================
       ARRANQUE
       ====================================================================== */
    /** Se ejecuta cuando el loader termina (el sitio ya es visible) */
    function onSiteReady() {
        initBubbles();
        initFab();
        setTimeout(initRotator, 1800);
    }

    function init() {
        initHeader();
        initReveal();
        initCounters();
        initScrollEffects();
        initHeroOrbit();
        initTilt();
        initMagnetic();
        initSpotlight();
        initWipe();
        initAccordion();
        initForm();
        initImageFallbacks();
        initYear();
        initLoader();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
