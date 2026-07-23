/* Ingrid Ascanio · Miami Mortgage — interactions + GHL wiring (vanilla JS) */
(function () {
  'use strict';
  var GHL = window.GHL || {};
  var I18N = window.SITE_I18N || {};
  document.documentElement.classList.add('js');

  var lang = document.documentElement.lang === 'es' ? 'es' : 'en';
  var contactPath = lang === 'es' ? '/es/contacto/' : '/contact/';

  /* ---------- menu dropdown panel (anchored to the Menu button) ---------- */
  var menuBtn = document.querySelector('.menu-btn');
  var menu = document.getElementById('menu-overlay');
  var scrim = document.querySelector('.menu-scrim');
  if (menuBtn && menu && scrim) {
    function setMenu(open) {
      if (open) {
        var r = menuBtn.getBoundingClientRect();
        menu.style.top = (r.bottom + 10) + 'px';
        menu.hidden = false; scrim.hidden = false;
      }
      requestAnimationFrame(function () {
        menu.classList.toggle('open', open);
        scrim.classList.toggle('open', open);
      });
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) setTimeout(function () { menu.hidden = true; scrim.hidden = true; }, 280);
    }
    menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
    menu.querySelector('.menu-close').addEventListener('click', function () { setMenu(false); });
    scrim.addEventListener('click', function () { setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
    window.addEventListener('scroll', function () { if (!menu.hidden) setMenu(false); }, { passive: true });
  }

  /* ---------- scroll reveals ---------- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
    var path = document.getElementById('path');
    if (path) {
      var pio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { path.classList.add('drawn'); pio.disconnect(); }
        });
      }, { rootMargin: '0px 0px -15% 0px' });
      pio.observe(path);
    }
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    var p2 = document.getElementById('path');
    if (p2) p2.classList.add('drawn');
  }

  /* ---------- GHL CTA routing ---------- */
  document.querySelectorAll('[data-ghl]').forEach(function (a) {
    var kind = a.getAttribute('data-ghl');
    var url = kind === 'form' ? GHL.formUrl : kind === 'calendar' ? GHL.calendarUrl : '';
    if (url) {
      a.setAttribute('href', url);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    } else if (a.getAttribute('href') === '#' || !a.getAttribute('href')) {
      var fb = a.getAttribute('data-fallback');
      a.setAttribute('href', fb === 'phone' ? 'tel:+17865548830'
        : (document.getElementById('contact-form') ? '#contact-form' : contactPath));
    }
  });
  function calendarHref() {
    return GHL.calendarUrl || (document.getElementById('contact-form') ? '#contact-form' : contactPath);
  }

  /* ---------- GHL upload form embed swap ---------- */
  var uploadSlot = document.querySelector('[data-ghl-upload-slot]');
  var uploadNative = document.querySelector('[data-ghl-upload-native]');
  if (uploadSlot && GHL.uploadFormEmbedUrl) {
    var iframe = document.createElement('iframe');
    iframe.src = GHL.uploadFormEmbedUrl;
    iframe.style.cssText = 'width:100%;min-height:640px;border:0;';
    iframe.title = 'Document upload';
    uploadSlot.appendChild(iframe);
    uploadSlot.hidden = false;
    if (uploadNative) uploadNative.hidden = true;
  }

  /* ---------- dropzone (upload page) ---------- */
  var dz = document.getElementById('dropzone');
  var fileInput = document.getElementById('file-input');
  var fileList = document.getElementById('file-list');
  var pickedFiles = [];
  var MAX_TOTAL = 20 * 1024 * 1024;
  function renderFiles() {
    if (!fileList) return;
    fileList.innerHTML = '';
    pickedFiles.forEach(function (f, i) {
      var li = document.createElement('li');
      var name = document.createElement('span');
      name.textContent = f.name + ' (' + (f.size / 1048576).toFixed(1) + ' MB)';
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = dz.getAttribute('data-remove');
      rm.addEventListener('click', function () { pickedFiles.splice(i, 1); renderFiles(); });
      li.appendChild(name); li.appendChild(rm);
      fileList.appendChild(li);
    });
  }
  function addFiles(list) {
    for (var i = 0; i < list.length; i++) pickedFiles.push(list[i]);
    var total = pickedFiles.reduce(function (s, f) { return s + f.size; }, 0);
    if (total > MAX_TOTAL) {
      alert(dz.getAttribute('data-too-big'));
      while (pickedFiles.reduce(function (s, f) { return s + f.size; }, 0) > MAX_TOTAL) pickedFiles.pop();
    }
    renderFiles();
  }
  if (dz && fileInput) {
    fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });
    ['dragover', 'dragenter'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); });
    });
    dz.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
  }

  /* ---------- form submissions ---------- */
  function collect(form, extraType) {
    var data = { type: extraType, page: location.pathname, language: lang, submitted_at: new Date().toISOString() };
    new FormData(form).forEach(function (v, k) { if (k !== 'company' && k !== 'files') data[k] = v; });
    return data;
  }
  function wireForm(form, extraType) {
    var status = form.querySelector('.form-status');
    function setStatus(cls, txt) { if (status) { status.className = 'form-status ' + cls; status.textContent = txt || ''; } }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (form.querySelector('.hp') && form.querySelector('.hp').value) return;
      var data = collect(form, extraType);
      var btn = form.querySelector('[type="submit"]');
      var isUpload = extraType === 'document-upload';

      if (isUpload && !pickedFiles.length && !data.docs_link) {
        setStatus('err', status.getAttribute('data-need')); return;
      }
      if (btn) btn.disabled = true;
      setStatus('', status.getAttribute('data-loading'));
      function done(ok) {
        if (btn) btn.disabled = false;
        if (ok) { form.reset(); pickedFiles = []; renderFiles(); }
        setStatus(ok ? 'ok' : 'err', status.getAttribute(ok ? 'data-success' : 'data-error'));
      }

      // Upload with attached files → serverless relay (stores files, forwards links to GHL)
      if (isUpload && pickedFiles.length) {
        var fd = new FormData();
        Object.keys(data).forEach(function (k) { fd.append(k, data[k]); });
        pickedFiles.forEach(function (f) { fd.append('files', f, f.name); });
        fetch('/api/upload', { method: 'POST', body: fd })
          .then(function (r) { if (!r.ok) throw 0; done(true); })
          .catch(function () {
            // relay unavailable (static host / Blob not set up) → fall back to webhook or email with metadata
            data.files_note = pickedFiles.map(function (f) { return f.name; }).join(', ') + ' (files could not be attached — will follow up)';
            sendJson(data, done);
          });
        return;
      }
      sendJson(data, done);
    });
    function sendJson(data, done) {
      if (!GHL.webhookUrl) {
        var body = Object.keys(data).map(function (k) { return k + ': ' + data[k]; }).join('\n');
        location.href = 'mailto:ingrid.ascanio@pmfmortgage.com?subject=' +
          encodeURIComponent('[Website] ' + data.type) + '&body=' + encodeURIComponent(body);
        done(true); return;
      }
      fetch(GHL.webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      }).then(function (r) { if (!r.ok) throw 0; done(true); })
        .catch(function () { done(false); });
    }
  }
  document.querySelectorAll('[data-ghl-contact]').forEach(function (f) { wireForm(f, 'contact'); });
  document.querySelectorAll('[data-ghl-upload]').forEach(function (f) { wireForm(f, 'document-upload'); });
  document.querySelectorAll('[data-ghl-newsletter]').forEach(function (f) { wireForm(f, 'newsletter'); });

  /* ---------- booking nudge (one per session, dismissible) ---------- */
  var N = I18N.nudge;
  if (N && N.byPage && N.byPage[N.page] && !sessionStorage.getItem('nudged') && location.pathname.indexOf('contact') === -1) {
    var nd = N.byPage[N.page];
    var nudge = document.createElement('aside');
    nudge.className = 'nudge';
    nudge.setAttribute('role', 'dialog');
    nudge.innerHTML = '<button class="nudge-close" aria-label="Close">×</button><h3></h3><p></p>' +
      '<div class="nudge-actions"><a class="btn btn-gold btn-sm nudge-cta"></a><button class="nudge-dismiss"></button></div>';
    nudge.querySelector('h3').textContent = nd.title;
    nudge.querySelector('p').textContent = nd.body;
    var cta = nudge.querySelector('.nudge-cta');
    cta.textContent = N.cta; cta.href = calendarHref();
    if (GHL.calendarUrl) { cta.target = '_blank'; cta.rel = 'noopener'; }
    nudge.querySelector('.nudge-dismiss').textContent = N.dismiss;
    document.body.appendChild(nudge);
    function hideNudge() { nudge.classList.remove('show'); sessionStorage.setItem('nudged', '1'); }
    nudge.querySelector('.nudge-close').addEventListener('click', hideNudge);
    nudge.querySelector('.nudge-dismiss').addEventListener('click', hideNudge);
    cta.addEventListener('click', function () { sessionStorage.setItem('nudged', '1'); nudge.classList.remove('show'); });
    setTimeout(function () {
      nudge.classList.add('show');
    }, (N.delaySeconds || 16) * 1000);
  }

  /* ---------- tracking ---------- */
  if (GHL.ga4Id) {
    var g = document.createElement('script');
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GHL.ga4Id;
    g.async = true; document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('js', new Date()); gtag('config', GHL.ga4Id);
  }
  if (GHL.gtmId) {
    (function (w, d, s2, l, i) {
      w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s2)[0], j = d.createElement(s2);
      j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', GHL.gtmId);
  }
  if (GHL.metaPixelId) {
    !function (f, b, e, v, n, t, s3) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s3 = b.getElementsByTagName(e)[0]; s3.parentNode.insertBefore(t, s3);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', GHL.metaPixelId);
    window.fbq('track', 'PageView');
  }
})();
