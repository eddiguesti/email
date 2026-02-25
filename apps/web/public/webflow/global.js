(function () {
  'use strict';



  // ─── COOKIE CONSENT ───
  // GDPR-compliant (CNIL), French, stores choice for 180 days.
  // Exposes window.cookieConsent = { necessary, analytics, marketing }
  // Fires 'cookieConsentUpdate' CustomEvent on document.
  // Supports Google Consent Mode v2 if window.gtag is present.
  (function () {

    var KEY  = 'bt_cc';
    var DAYS = 180;

    function loadStored() {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return null;
        var obj = JSON.parse(raw);
        if (!obj || Date.now() > obj.exp) { localStorage.removeItem(KEY); return null; }
        return obj.c;
      } catch (e) { return null; }
    }

    function saveChoices(c) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ c: c, exp: Date.now() + DAYS * 864e5, v: 1 }));
      } catch (e) {}
      window.cookieConsent = c;
      // Google Consent Mode v2
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          analytics_storage:   c.analytics  ? 'granted' : 'denied',
          ad_storage:          c.marketing  ? 'granted' : 'denied',
          ad_user_data:        c.marketing  ? 'granted' : 'denied',
          ad_personalization:  c.marketing  ? 'granted' : 'denied',
        });
      }
      try { document.dispatchEvent(new CustomEvent('cookieConsentUpdate', { detail: c })); } catch (e) {}
    }

    // Already decided — set global and exit
    var stored = loadStored();
    if (stored) { window.cookieConsent = stored; return; }

    // ── CSS ──
    var css = document.createElement('style');
    css.textContent = [

      /* ── Banner card ── */
      '#btcc { position: fixed; bottom: 24px; left: 24px; z-index: 99998; width: 340px; max-width: calc(100vw - 32px); }',
      '#btcc * { box-sizing: border-box; font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; }',
      '#btcc-card { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; box-shadow: 0 12px 48px rgba(0,0,0,0.14); padding: 20px; opacity: 0; transform: translateY(16px); transition: opacity 500ms ease, transform 500ms cubic-bezier(0.25,0.1,0.25,1); }',
      '#btcc-card.is-in { opacity: 1; transform: translateY(0); }',

      /* Header */
      '#btcc-head { display: flex; align-items: center; gap: 9px; margin-bottom: 9px; }',
      '#btcc-title { font-size: 14px; font-weight: 600; color: #1d1d1f; line-height: 1; }',

      /* Body text */
      '#btcc-body { font-size: 12px; color: #6e6e73; line-height: 1.55; margin-bottom: 16px; }',
      '#btcc-body a { color: #1d1d1f; text-decoration: underline; text-underline-offset: 2px; }',

      /* Action buttons */
      '#btcc-actions { display: flex; gap: 6px; }',
      '.btcc-btn { flex: 1; height: 34px; border-radius: 9px; font-size: 12px; font-weight: 500; cursor: pointer; border: none; outline: none; transition: background 160ms ease, color 160ms ease; }',
      '#btcc-reject  { background: #f2f2f2; color: #1d1d1f; }',
      '#btcc-reject:hover  { background: #e5e5ea; }',
      '#btcc-prefs   { background: #f2f2f2; color: #6e6e73; flex: 0.65; font-size: 11px; }',
      '#btcc-prefs:hover   { background: #e5e5ea; color: #1d1d1f; }',
      '#btcc-accept  { background: #1d1d1f; color: #fff; }',
      '#btcc-accept:hover  { background: #3a3a3c; }',

      /* ── Preferences overlay ── */
      '#btcc-overlay { position: fixed; inset: 0; z-index: 99999; display: flex; align-items: flex-end; justify-content: center; background: rgba(0,0,0,0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); pointer-events: none; transition: background 350ms ease, backdrop-filter 350ms ease; }',
      '#btcc-overlay.is-open { background: rgba(0,0,0,0.38); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); pointer-events: all; }',
      '#btcc-modal { background: #fff; border-radius: 22px 22px 0 0; padding: 28px 24px 36px; width: 100%; max-width: 480px; box-shadow: 0 -24px 60px rgba(0,0,0,0.18); transform: translateY(100%); transition: transform 400ms cubic-bezier(0.25,0.1,0.25,1); }',
      '#btcc-overlay.is-open #btcc-modal { transform: translateY(0); }',

      '#btcc-modal * { box-sizing: border-box; font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; }',
      '#btcc-m-title { font-size: 17px; font-weight: 600; color: #1d1d1f; margin-bottom: 6px; }',
      '#btcc-m-sub   { font-size: 13px; color: #6e6e73; line-height: 1.5; margin-bottom: 20px; }',

      /* Toggle rows */
      '.btcc-row { border-top: 1px solid #f0f0f0; padding: 14px 0; display: flex; align-items: flex-start; gap: 14px; }',
      '.btcc-row-name { font-size: 13px; font-weight: 600; color: #1d1d1f; margin-bottom: 3px; }',
      '.btcc-row-desc { font-size: 12px; color: #86868b; line-height: 1.4; }',
      '.btcc-row-info { flex: 1; }',

      /* Toggle switch */
      '.btcc-tog { position: relative; width: 42px; height: 24px; flex-shrink: 0; margin-top: 3px; }',
      '.btcc-tog input { position: absolute; opacity: 0; width: 0; height: 0; }',
      '.btcc-tog-track { position: absolute; inset: 0; border-radius: 12px; background: #d1d1d6; cursor: pointer; transition: background 200ms ease; }',
      '.btcc-tog input:checked + .btcc-tog-track { background: #1d1d1f; }',
      '.btcc-tog-track::after { content: ""; position: absolute; width: 18px; height: 18px; background: #fff; border-radius: 50%; top: 3px; left: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform 200ms ease; }',
      '.btcc-tog input:checked + .btcc-tog-track::after { transform: translateX(18px); }',
      '.btcc-tog input:disabled + .btcc-tog-track { opacity: 0.45; cursor: not-allowed; }',

      /* Modal footer */
      '#btcc-m-footer { margin-top: 22px; display: flex; gap: 8px; justify-content: flex-end; }',
      '.btcc-mbtn { height: 38px; padding: 0 18px; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; outline: none; transition: background 160ms ease; }',
      '#btcc-m-reject { background: #f2f2f2; color: #1d1d1f; }',
      '#btcc-m-reject:hover { background: #e5e5ea; }',
      '#btcc-m-save   { background: #1d1d1f; color: #fff; }',
      '#btcc-m-save:hover   { background: #3a3a3c; }',

      /* Mobile */
      '@media (max-width: 480px) {',
      '  #btcc { left: 16px; right: 16px; bottom: 16px; width: auto; }',
      '  #btcc-actions { flex-wrap: wrap; }',
      '  #btcc-prefs { flex: 1 1 100%; order: 3; }',
      '}',

    ].join('\n');
    document.head.appendChild(css);

    // ── DOM ──
    var wrap = document.createElement('div');
    wrap.id = 'btcc';
    wrap.innerHTML = [
      '<div id="btcc-card">',
        '<div id="btcc-head">',
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
            '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
          '</svg>',
          '<p id="btcc-title">Cookies &amp; confidentialité</p>',
        '</div>',
        '<p id="btcc-body">',
          'Nous utilisons des cookies pour analyser notre trafic et améliorer votre expérience.',
          ' <a href="/mentions-legales" target="_blank" rel="noopener">En savoir plus</a>',
        '</p>',
        '<div id="btcc-actions">',
          '<button class="btcc-btn" id="btcc-reject">Refuser</button>',
          '<button class="btcc-btn" id="btcc-prefs">Personnaliser</button>',
          '<button class="btcc-btn" id="btcc-accept">Tout accepter</button>',
        '</div>',
      '</div>',
    ].join('');

    var overlay = document.createElement('div');
    overlay.id = 'btcc-overlay';
    overlay.innerHTML = [
      '<div id="btcc-modal">',
        '<p id="btcc-m-title">Mes préférences cookies</p>',
        '<p id="btcc-m-sub">Personnalisez les catégories de cookies autorisées. Les cookies nécessaires ne peuvent pas être désactivés.</p>',

        /* Nécessaires — always on */
        '<div class="btcc-row">',
          '<div class="btcc-row-info">',
            '<p class="btcc-row-name">Nécessaires</p>',
            '<p class="btcc-row-desc">Indispensables au fonctionnement du site (session, sécurité). Toujours actifs.</p>',
          '</div>',
          '<label class="btcc-tog" aria-label="Nécessaires">',
            '<input type="checkbox" checked disabled>',
            '<span class="btcc-tog-track"></span>',
          '</label>',
        '</div>',

        /* Analytiques */
        '<div class="btcc-row">',
          '<div class="btcc-row-info">',
            '<p class="btcc-row-name">Analytiques</p>',
            '<p class="btcc-row-desc">Mesure d\'audience anonymisée pour comprendre l\'utilisation du site (ex. Google Analytics).</p>',
          '</div>',
          '<label class="btcc-tog" aria-label="Analytiques">',
            '<input type="checkbox" id="btcc-t-analytics">',
            '<span class="btcc-tog-track"></span>',
          '</label>',
        '</div>',

        /* Marketing */
        '<div class="btcc-row">',
          '<div class="btcc-row-info">',
            '<p class="btcc-row-name">Marketing</p>',
            '<p class="btcc-row-desc">Publicités personnalisées et suivi de campagnes selon vos centres d\'intérêt.</p>',
          '</div>',
          '<label class="btcc-tog" aria-label="Marketing">',
            '<input type="checkbox" id="btcc-t-marketing">',
            '<span class="btcc-tog-track"></span>',
          '</label>',
        '</div>',

        '<div id="btcc-m-footer">',
          '<button class="btcc-mbtn" id="btcc-m-reject">Tout refuser</button>',
          '<button class="btcc-mbtn" id="btcc-m-save">Enregistrer mes choix</button>',
        '</div>',
      '</div>',
    ].join('');

    // Clicking the backdrop dismisses without saving
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.classList.remove('is-open');
    });

    document.body.appendChild(wrap);
    document.body.appendChild(overlay);

    // Slide card in after a short delay
    setTimeout(function () {
      var card = document.getElementById('btcc-card');
      if (card) card.classList.add('is-in');
    }, 800);

    function hideBanner() {
      var card = document.getElementById('btcc-card');
      if (!card) return;
      card.style.transition = 'opacity 350ms ease, transform 350ms cubic-bezier(0.25,0.1,0.25,1)';
      card.style.opacity = '0';
      card.style.transform = 'translateY(16px)';
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 380);
    }

    // ── Event wiring ──
    document.getElementById('btcc-accept').addEventListener('click', function () {
      saveChoices({ necessary: true, analytics: true, marketing: true });
      hideBanner();
    });

    document.getElementById('btcc-reject').addEventListener('click', function () {
      saveChoices({ necessary: true, analytics: false, marketing: false });
      hideBanner();
    });

    document.getElementById('btcc-prefs').addEventListener('click', function () {
      overlay.classList.add('is-open');
    });

    document.getElementById('btcc-m-reject').addEventListener('click', function () {
      saveChoices({ necessary: true, analytics: false, marketing: false });
      overlay.classList.remove('is-open');
      hideBanner();
    });

    document.getElementById('btcc-m-save').addEventListener('click', function () {
      saveChoices({
        necessary: true,
        analytics:  document.getElementById('btcc-t-analytics').checked,
        marketing:  document.getElementById('btcc-t-marketing').checked,
      });
      overlay.classList.remove('is-open');
      hideBanner();
    });

  })();

})();
