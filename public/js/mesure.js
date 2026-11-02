/* Mesure d'audience Label Maison — Google Analytics 4.
 *
 * Règles :
 *  - rien n'est chargé tant que le visiteur n'a pas accepté (CNIL : Google
 *    Analytics n'est pas exempté de consentement) ; le refus est mémorisé ;
 *  - le choix est gardé dans localStorage, jamais envoyé ailleurs ;
 *  - les formulaires émettent l'événement « lm:lead » quand l'envoi réussit :
 *    il devient une conversion « generate_lead » dans GA4, avec la page d'origine.
 *
 * Réglage : l'identifiant de mesure de la propriété GA4 (Administration →
 * Flux de données → Identifiant de mesure, de la forme G-XXXXXXXXXX).
 */
(function () {
  var ID_GA4 = ''; // ex. 'G-AB12CD34EF' — vide tant que la propriété GA4 n'est pas créée
  var CLE = 'lm-consentement'; // 'oui' | 'non'
  if (!/^G-[A-Z0-9]{6,}$/.test(ID_GA4) || /X{4,}/.test(ID_GA4)) return; // pas configuré : rien ne se charge, pas de bandeau

  var choix = null;
  try { choix = localStorage.getItem(CLE); } catch (e) { /* navigation privée */ }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('consent', 'default', {
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied'
  });

  function vue() {
    gtag('event', 'page_view', { page_location: location.href, page_path: location.pathname, page_title: document.title });
  }

  function charger() {
    if (window.__lmGa4) return;
    window.__lmGa4 = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID_GA4;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', ID_GA4, { send_page_view: true });
    // Site React : une vue par changement d'adresse.
    var push = history.pushState;
    history.pushState = function () {
      var r = push.apply(this, arguments);
      setTimeout(vue, 0);
      return r;
    };
    window.addEventListener('popstate', function () { setTimeout(vue, 0); });
  }

  window.addEventListener('lm:lead', function (e) {
    if (!window.__lmGa4) return;
    var d = (e && e.detail) || {};
    gtag('event', 'generate_lead', {
      lead_type: d.type || 'formulaire',
      page_path: location.pathname
    });
  });

  function memoriser(v) {
    try { localStorage.setItem(CLE, v); } catch (e) { /* ignoré */ }
  }

  function bandeau() {
    if (document.getElementById('lm-consent')) return;
    var style = document.createElement('style');
    style.textContent =
      '#lm-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;margin:0 auto;max-width:560px;' +
      'background:#FBF9F4;color:#2C2418;border:1px solid rgba(44,36,24,.12);border-radius:14px;' +
      'box-shadow:0 12px 40px rgba(20,14,6,.14);padding:16px 18px;font:14px/1.5 Figtree,ui-sans-serif,system-ui,-apple-system,sans-serif}' +
      '#lm-consent p{margin:0 0 12px}#lm-consent a{color:#7C561D;text-decoration:underline}' +
      '#lm-consent .lm-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}' +
      '#lm-consent button{font:inherit;font-weight:600;border-radius:999px;padding:9px 16px;cursor:pointer;border:1px solid transparent}' +
      '#lm-consent .lm-oui{background:#A97C30;color:#fff}#lm-consent .lm-oui:hover{background:#8a6424}' +
      '#lm-consent .lm-non{background:transparent;color:#2C2418;border-color:rgba(44,36,24,.25)}#lm-consent .lm-non:hover{background:rgba(44,36,24,.06)}';
    document.head.appendChild(style);

    var box = document.createElement('div');
    box.id = 'lm-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('aria-label', 'Mesure d’audience');
    box.innerHTML =
      '<p>Nous mesurons l’audience du site avec Google Analytics pour savoir quelles pages aident ' +
      'vraiment les propriétaires. Aucune publicité, aucune revente de données. ' +
      '<a href="/politique-de-confidentialite#cookies">En savoir plus</a></p>' +
      '<div class="lm-actions"><button type="button" class="lm-oui">Accepter</button>' +
      '<button type="button" class="lm-non">Refuser</button></div>';
    document.body.appendChild(box);
    box.querySelector('.lm-oui').addEventListener('click', function () {
      memoriser('oui'); box.remove(); charger();
    });
    box.querySelector('.lm-non').addEventListener('click', function () {
      memoriser('non'); box.remove();
    });
  }

  if (choix === 'oui') { charger(); return; }
  if (choix === 'non') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bandeau);
  else bandeau();
})();
