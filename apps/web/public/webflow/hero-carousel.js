(function() {
  'use strict';

  // ─── CONFIG ───
  var INTERVAL    = 6000;   // time between slides
  var REVEAL      = 1400;   // clip-path reveal duration
  var KB_DURATION = 8000;   // Ken Burns drift duration
  var EASE_CINEMATIC = 'cubic-bezier(0.76, 0, 0.24, 1)';
  var EASE_SMOOTH    = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

  // Directional Ken Burns — each slide gets a unique cinematic motion
  var KB_MOVES = [
    { from: 'scale(1)   translate3d(0, 0, 0)',        to: 'scale(1.07) translate3d(-1.5%, -1%, 0)',  origin: '30% 40%' },
    { from: 'scale(1.06) translate3d(-2%, 0, 0)',      to: 'scale(1)    translate3d(1%, 0.5%, 0)',    origin: '70% 30%' },
    { from: 'scale(1)   translate3d(0, 1.5%, 0)',      to: 'scale(1.06) translate3d(0, -1.5%, 0)',    origin: '50% 60%' },
    { from: 'scale(1.05) translate3d(1.5%, 0, 0)',     to: 'scale(1)    translate3d(-1%, 0.8%, 0)',   origin: '25% 50%' },
    { from: 'scale(1)   translate3d(-0.5%, -0.5%, 0)', to: 'scale(1.08) translate3d(1%, -1%, 0)',     origin: '60% 35%' },
  ];

  // ─── CTA per slide — label + href ───
  // Order matches the 5 slides in the Webflow slider
  var CTA_SLIDES = [
    { label: 'Notre équipe',              href: '/equipe' },
    { label: 'Nous contacter',            href: '/contact' },
    { label: 'Actualités',  href: '/actualites' },
    { label: 'Actualités',  href: '/actualites' },
    { label: 'Actualités',  href: '/actualites' },
  ];

  // Clip-path reveal directions — alternating for visual variety
  var REVEALS = [
    { start: 'inset(0 100% 0 0)',  end: 'inset(0 0 0 0)' },   // wipe from left
    { start: 'inset(0 0 0 100%)',  end: 'inset(0 0 0 0)' },   // wipe from right
    { start: 'inset(100% 0 0 0)',  end: 'inset(0 0 0 0)' },   // wipe from top
    { start: 'inset(0 0 100% 0)',  end: 'inset(0 0 0 0)' },   // wipe from bottom
    { start: 'inset(50% 50% 50% 50%)', end: 'inset(0 0 0 0)' }, // expand from center
  ];

  // ─── STYLES ───
  var css = document.createElement('style');
  css.textContent = [
    /* Container */
    '.bt-hero { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: inherit; opacity: 0; transition: opacity 500ms ease; }',
    '.bt-hero.is-ready { opacity: 1; }',
    '.bt-hero * { margin: 0; padding: 0; box-sizing: border-box; }',

    /* Slides */
    '.bt-s { position: absolute; inset: 0; z-index: 1; clip-path: inset(0 0 0 0); will-change: clip-path, transform, filter; backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden; }',
    '.bt-s:not(.is-active) { clip-path: inset(0 100% 0 0); }',

    /* Images */
    '.bt-s img { display: block; width: 100%; height: 100%; object-fit: cover; will-change: transform; backface-visibility: hidden; -webkit-backface-visibility: hidden; }',

    /* Cinematic vignette — subtle gradient overlay */
    '.bt-s::after { content: ""; position: absolute; inset: -5%; background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.12) 100%); pointer-events: none; z-index: 1; }',

    /* Second vignette layer — bottom gradient for depth */
    '.bt-s::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.03) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.18) 100%); pointer-events: none; z-index: 2; }',

    /* Ensure transparent background — nuke every possible grey */
    '.slider-2, .slider-2 *, .background-wrapper-2, .w-slide, .w-slider-mask, .bt-hero, .bt-s { background: transparent !important; background-color: transparent !important; }',

    /* Hide Webflow slider internals */
    '.slider-2 .w-slider-mask, .slider-2 .w-slider-arrow-left, .slider-2 .w-slider-arrow-right, .slider-2 .w-slider-nav { display: none !important; }',
  ].join('\n');
  document.head.appendChild(css);

  // ─── INIT ───
  function init() {
    var slider = document.querySelector('.slider-2.w-slider');
    if (!slider) return;

    var wfSlides = slider.querySelectorAll('.w-slide');
    if (!wfSlides.length) return;

    var images = [];
    wfSlides.forEach(function(slide) {
      var img = slide.querySelector('img');
      if (img) {
        images.push({
          src: img.getAttribute('src') || img.src,
          srcset: img.getAttribute('srcset') || '',
          sizes: img.getAttribute('sizes') || '',
          alt: img.alt || ''
        });
      }
    });
    if (images.length < 2) return;

    // Pick the best URL from a srcset for the current viewport
    function bestSrcFromSrcset(srcset, fallback) {
      if (!srcset) return fallback;
      var vw = window.innerWidth * (window.devicePixelRatio || 1);
      var entries = [];
      srcset.split(',').forEach(function(s) {
        var p = s.trim().split(/\s+/);
        var w = p.length > 1 ? parseInt(p[1]) : 0;
        if (p[0] && w > 0) entries.push({ url: p[0], w: w });
      });
      if (!entries.length) return fallback;
      entries.sort(function(a, b) { return a.w - b.w; });
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].w >= vw) return entries[j].url;
      }
      return entries[entries.length - 1].url; // largest available
    }

    // ─── BUILD DOM ───
    var hero = document.createElement('div');
    hero.className = 'bt-hero';

    images.forEach(function(data, i) {
      var slide = document.createElement('div');
      slide.className = 'bt-s' + (i === 0 ? ' is-active' : '');
      var img = document.createElement('img');
      // First image: resolve the correct high-res src directly — no srcset upgrade jump
      if (i === 0) {
        img.src = bestSrcFromSrcset(data.srcset, data.src);
        img.fetchpriority = 'high';
      } else {
        img.src = data.src;
        if (data.srcset) img.srcset = data.srcset;
        if (data.sizes) img.sizes = data.sizes;
      }
      img.alt = data.alt;
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.draggable = false;
      // Reveal only after first image is fully decoded at the correct resolution
      if (i === 0) {
        img.decode().then(function() {
          hero.classList.add('is-ready');
        }).catch(function() {
          hero.classList.add('is-ready');
        });
      }
      slide.appendChild(img);
      hero.appendChild(slide);
    });

    // Insert into DOM
    var container = slider.querySelector('.background-wrapper-2') || slider;
    var mask = slider.querySelector('.w-slider-mask');
    if (mask) mask.style.display = 'none';
    slider.querySelectorAll('.w-slider-arrow-left, .w-slider-arrow-right, .w-slider-nav')
      .forEach(function(el) { el.style.display = 'none'; });
    container.style.position = 'relative';
    container.appendChild(hero);

    // ─── CAROUSEL ENGINE ───
    var current = 0;
    var slides = hero.querySelectorAll('.bt-s');
    var total = images.length;
    var busy = false;
    var timer = null;

    // Start Ken Burns on first slide
    startKenBurns(slides[0], 0);

    function startKenBurns(slide, index) {
      var img = slide.querySelector('img');
      var kb = KB_MOVES[index % KB_MOVES.length];
      img.style.transformOrigin = kb.origin;
      img.style.transition = 'none';
      img.style.transform = kb.from;
      void img.offsetWidth;
      img.style.transition = 'transform ' + KB_DURATION + 'ms ' + EASE_SMOOTH;
      img.style.transform = kb.to;
    }

    function resetKenBurns(slide) {
      var img = slide.querySelector('img');
      img.style.transition = 'none';
      img.style.transform = 'scale(1) translate3d(0,0,0)';
    }

    // ─── CTA UPDATE ───
    function updateCTA(index) {
      var cta = CTA_SLIDES[index % CTA_SLIDES.length];
      var link = document.querySelector('.hero-link-wrapper .hero-link-3');
      var label = document.querySelector('.hero-link-wrapper .button-text-3');
      if (!link || !label) return;
      // Fade out, swap, fade in
      label.style.transition = 'opacity 250ms ease';
      label.style.opacity = '0';
      setTimeout(function() {
        link.href = cta.href;
        label.textContent = cta.label;
        label.style.opacity = '1';
      }, 260);
    }

    function goTo(next) {
      if (busy || next === current) return;
      busy = true;

      var prevSlide = slides[current];
      var nextSlide = slides[next];
      var reveal = REVEALS[next % REVEALS.length];

      // ── Update CTA ──
      updateCTA(next);

      // ── Prepare incoming slide ──
      nextSlide.style.willChange = 'clip-path';
      nextSlide.style.zIndex = 3;
      nextSlide.style.transition = 'none';
      nextSlide.style.clipPath = reveal.start;
      nextSlide.style.filter = 'brightness(1.08)';
      nextSlide.classList.add('is-active');
      void nextSlide.offsetWidth;

      // Start Ken Burns on incoming slide
      startKenBurns(nextSlide, next);

      // ── Animate incoming: clip-path reveal + brightness settle ──
      nextSlide.style.transition =
        'clip-path ' + REVEAL + 'ms ' + EASE_CINEMATIC + ', ' +
        'filter 800ms ' + EASE_SMOOTH + ' 400ms';
      nextSlide.style.clipPath = reveal.end;
      nextSlide.style.filter = 'brightness(1)';

      // ── Animate outgoing: scale down + blur for depth ──
      prevSlide.style.zIndex = 2;
      prevSlide.style.transition =
        'transform ' + REVEAL + 'ms ' + EASE_CINEMATIC + ', ' +
        'filter ' + (REVEAL * 0.7) + 'ms ' + EASE_SMOOTH;
      prevSlide.style.transform = 'scale(0.94)';
      prevSlide.style.filter = 'blur(6px) brightness(0.7)';

      // ── Cleanup after transition ──
      setTimeout(function() {
        // Reset outgoing slide
        prevSlide.classList.remove('is-active');
        prevSlide.style.transition = 'none';
        prevSlide.style.transform = '';
        prevSlide.style.filter = '';
        prevSlide.style.zIndex = 1;
        prevSlide.style.clipPath = 'inset(0 100% 0 0)';
        prevSlide.style.willChange = 'auto';
        resetKenBurns(prevSlide);

        // Settle incoming
        nextSlide.style.zIndex = 2;
        nextSlide.style.willChange = 'auto';

        busy = false;
      }, REVEAL + 100);

      current = next;
      resetTimer();
    }

    function advance() {
      goTo((current + 1) % total);
    }

    function resetTimer() {
      if (timer) clearInterval(timer);
      timer = setInterval(advance, INTERVAL);
    }

    // ─── PAUSE ON HOVER ───
    hero.addEventListener('mouseenter', function() {
      if (timer) { clearInterval(timer); timer = null; }
    });
    hero.addEventListener('mouseleave', function() {
      resetTimer();
    });

    // ─── TOUCH / SWIPE ───
    var tx = 0;
    hero.addEventListener('touchstart', function(e) {
      tx = e.changedTouches[0].screenX;
    }, { passive: true });
    hero.addEventListener('touchend', function(e) {
      var diff = tx - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) advance();
        else goTo((current - 1 + total) % total);
      }
    }, { passive: true });

    // ─── VISIBILITY ───
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting) {
            if (timer) { clearInterval(timer); timer = null; }
          } else if (!timer) {
            resetTimer();
          }
        });
      }, { threshold: 0.3 });
      obs.observe(hero);
    }

    // Start
    resetTimer();
  }

  // ─── PRELOAD first slide image immediately ───
  (function() {
    var firstImg = document.querySelector('.slider-2 .w-slide img');
    if (!firstImg) return;
    var src = firstImg.getAttribute('src') || firstImg.src;
    if (!src) return;
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  })();

  // ─── BOOT on DOMContentLoaded (much earlier than load) ───
  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
