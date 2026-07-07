/* Formulaire d'audit (silo SEO) → /api/contact (Resend).
   Amélioration progressive : si JS indisponible, le <form> poste normalement. */
(function () {
  function init(form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var fd = new FormData(form);
      var get = function (n) { var v = fd.get(n); return v == null ? '' : String(v).trim(); };

      var email = get('email');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus(form, 'err', 'Merci d’indiquer une adresse e-mail valide.');
        return;
      }

      var payload = {
        type: 'audit',
        prenom: get('prenom'),
        tel: get('telephone'),
        email: email,
        ville: get('ville'),
        typeBien: get('type'),
        message: get('message'),
        page: get('page')
      };

      var original = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Envoi en cours…'; }
      setStatus(form, '', '');

      try {
        var res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        var data = {};
        try { data = await res.json(); } catch (_) {}
        if (res.ok && data.ok) {
          form.reset();
          setStatus(form, 'ok', 'Merci ! Votre demande d’audit a bien été envoyée. Nous vous recontactons très vite.');
        } else {
          setStatus(form, 'err', (data && data.error) || 'Une erreur est survenue. Réessayez ou appelez-nous au +33 7 49 54 83 55.');
        }
      } catch (_) {
        setStatus(form, 'err', 'Connexion impossible. Réessayez ou appelez-nous au +33 7 49 54 83 55.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = original; }
      }
    });
  }

  function setStatus(form, kind, msg) {
    var el = form.querySelector('.formstatus');
    if (!el) {
      el = document.createElement('p');
      el.className = 'formstatus';
      el.setAttribute('role', 'status');
      el.style.margin = '12px 0 0';
      el.style.fontWeight = '600';
      el.style.fontSize = '.95rem';
      form.appendChild(el);
    }
    el.textContent = msg || '';
    el.style.color = kind === 'ok' ? '#7C561D' : kind === 'err' ? '#b00020' : 'inherit';
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form.auditform').forEach(init);
  });
})();
