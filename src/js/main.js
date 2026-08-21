/* Ingrid Ascanio · Miami Mortgage - interactions + GHL wiring (vanilla JS) */
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
      a.setAttribute('href', fb === 'phone' ? 'tel:+17862500922'
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
    // An unchecked checkbox is simply absent from FormData. Consent has to be an explicit
    // yes/no on the record, so write both states rather than letting "no" look like "not asked".
    form.querySelectorAll('input[type="checkbox"][name]').forEach(function (cb) {
      data[cb.name] = cb.checked ? 'yes' : 'no';
    });
    // The GHL workflow maps First name from {{inboundWebhookRequest.name}}. The form now collects
    // first/last separately, so keep sending `name` as well or contact creation silently breaks.
    if (data.first_name || data.last_name) {
      data.name = ((data.first_name || '') + ' ' + (data.last_name || '')).trim();
    }
    return data;
  }
  function wireForm(form, extraType) {
    var status = form.querySelector('.form-status');
    function setStatus(cls, txt) { if (status) { status.className = 'form-status ' + cls; status.textContent = txt || ''; } }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!form.checkValidity()) {
        /* the SMS consent box is the one blocker a visitor can miss without seeing an empty
           field, so it gets a written line of its own on top of the browser's own bubble */
        var smsBox = form.querySelector('input[name="consent_sms"][required]');
        setStatus('err', smsBox && !smsBox.checked ? status.getAttribute('data-consent') : '');
        form.reportValidity();
        return;
      }
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
            data.files_note = pickedFiles.map(function (f) { return f.name; }).join(', ') + ' (files could not be attached, will follow up)';
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

  /* ---------- Roxy - Ingrid's corner shortcuts (a menu, not a chat: no message box, no AI) ---------- */
  var RX = I18N.roxy;
  if (RX && RX.actions) {
    var RIC = {
      calendar: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
      callback: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16.1v2.6a1.9 1.9 0 0 1-2.1 1.9 18.6 18.6 0 0 1-8.1-2.9 18.3 18.3 0 0 1-5.6-5.6A18.6 18.6 0 0 1 2.3 4a1.9 1.9 0 0 1 1.9-2.1h2.6a1.9 1.9 0 0 1 1.9 1.6c.1.9.3 1.8.7 2.6a1.9 1.9 0 0 1-.4 2L7.9 9.2a15 15 0 0 0 5.6 5.6l1.1-1.1a1.9 1.9 0 0 1 2-.4c.8.3 1.7.6 2.6.7a1.9 1.9 0 0 1 1.6 1.9z"/><path d="M15 3.5h5.5V9"/><path d="M20.5 3.5 15 9"/></svg>',
      phone: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16.1v2.6a1.9 1.9 0 0 1-2.1 1.9 18.6 18.6 0 0 1-8.1-2.9 18.3 18.3 0 0 1-5.6-5.6A18.6 18.6 0 0 1 2.3 4a1.9 1.9 0 0 1 1.9-2.1h2.6a1.9 1.9 0 0 1 1.9 1.6c.1.9.3 1.8.7 2.6a1.9 1.9 0 0 1-.4 2L7.9 9.2a15 15 0 0 0 5.6 5.6l1.1-1.1a1.9 1.9 0 0 1 2-.4c.8.3 1.7.6 2.6.7a1.9 1.9 0 0 1 1.6 1.9z"/></svg>',
      loans: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
      person: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></svg>',
      chev: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
      back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>'
    };

    var rxEs = lang === 'es';
    function rxHref(to) {
      switch (to) {
        case 'book': return calendarHref();
        case 'callback': return document.getElementById('contact-form') ? '#contact-form' : contactPath + '#contact-form';
        case 'phone': return I18N.phoneHref || 'tel:+17862500922';
        case 'preapproval': return GHL.formUrl || contactPath;
        case 'loans': return rxEs ? '/es/opciones-de-prestamo/' : '/loan-options/';
        case 'contact': return contactPath;
        case 'about': return rxEs ? '/es/sobre-ingrid/' : '/about/';
        case 'buy': return rxEs ? '/es/comprar/' : '/buy/';
        case 'dscr': return rxEs ? '/es/opciones-de-prestamo/inversionista-dscr/' : '/loan-options/investor-dscr/';
        case 'es': return '/es/';
        case 'en': return '/';
        default: return to || '#';
      }
    }
    function rxExternal(to) { return to === 'book' && !!GHL.calendarUrl; }

    var rxBtn = document.createElement('button');
    rxBtn.className = 'roxy-btn'; rxBtn.type = 'button';
    rxBtn.setAttribute('aria-expanded', 'false');
    rxBtn.innerHTML = '<span class="roxy-ava" aria-hidden="true">' + RX.name.charAt(0) + '</span><span class="roxy-btn-label"></span>';
    rxBtn.querySelector('.roxy-btn-label').textContent = RX.name;
    rxBtn.setAttribute('aria-label', RX.name + ': ' + RX.sub);

    var rxPanel = document.createElement('div');
    rxPanel.className = 'roxy-panel';
    rxPanel.setAttribute('role', 'dialog');
    rxPanel.setAttribute('aria-label', RX.name);
    rxPanel.innerHTML =
      '<div class="roxy-view roxy-view-home">' +
        '<div class="roxy-head">' +
          '<span class="roxy-ava" aria-hidden="true">' + RX.name.charAt(0) + '</span>' +
          '<div class="roxy-head-t"><h2></h2><p></p></div>' +
          '<button type="button" class="roxy-close">&times;</button>' +
        '</div>' +
        '<div class="roxy-body"></div>' +
        '<div class="roxy-foot"><button type="button" class="roxy-faq-link"></button></div>' +
      '</div>' +
      '<div class="roxy-view roxy-view-faq" hidden>' +
        '<div class="roxy-faq-head"><button type="button" class="roxy-back">' + RIC.back + '</button><strong></strong></div>' +
        '<div class="roxy-faq-body"><div class="roxy-faq-list"></div>' +
          '<article class="roxy-article" hidden><h3></h3><p></p><a class="roxy-article-link" hidden></a></article>' +
        '</div>' +
      '</div>';

    rxPanel.querySelector('.roxy-head h2').textContent = RX.greeting;
    rxPanel.querySelector('.roxy-head p').textContent = RX.sub;
    rxPanel.querySelector('.roxy-close').setAttribute('aria-label', RX.close);
    rxPanel.querySelector('.roxy-faq-link').textContent = RX.faqLink;
    rxPanel.querySelector('.roxy-faq-head strong').textContent = RX.faqTitle;
    var rxBack = rxPanel.querySelector('.roxy-back');
    rxBack.setAttribute('aria-label', RX.back);

    /* the 3-5 prominent actions */
    var rxBody = rxPanel.querySelector('.roxy-body');
    RX.actions.forEach(function (act) {
      var a = document.createElement('a');
      a.className = 'roxy-card'; a.href = rxHref(act.to);
      if (rxExternal(act.to)) { a.target = '_blank'; a.rel = 'noopener'; }
      a.innerHTML = '<span class="roxy-ico" aria-hidden="true">' + (RIC[act.icon] || RIC.chev) + '</span>' +
        '<span class="roxy-card-t"><strong></strong><span></span></span>' + RIC.chev;
      a.querySelector('strong').textContent = act.label;
      a.querySelector('.roxy-card-t span').textContent = (act.desc || '').replace('{phone}', I18N.phone || '');
      a.addEventListener('click', function () { rxSet(false); });
      rxBody.appendChild(a);
    });

    document.body.appendChild(rxBtn);
    document.body.appendChild(rxPanel);

    var rxOpen = false;
    function rxSet(open) {
      rxOpen = open;
      rxPanel.classList.toggle('open', open);
      rxBtn.classList.toggle('open', open);
      rxBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) rxShow('home');
    }
    rxBtn.addEventListener('click', function () { rxSet(!rxOpen); });
    rxPanel.querySelector('.roxy-close').addEventListener('click', function () { rxSet(false); rxBtn.focus(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && rxOpen) { rxSet(false); rxBtn.focus(); } });

    var rxViews = { home: rxPanel.querySelector('.roxy-view-home'), faq: rxPanel.querySelector('.roxy-view-faq') };
    function rxShow(v) { Object.keys(rxViews).forEach(function (k) { rxViews[k].hidden = k !== v; }); }

    /* secondary layer: the 8 curated answers, one tap away from the actions */
    var rxList = rxPanel.querySelector('.roxy-faq-list');
    var rxArticle = rxPanel.querySelector('.roxy-article');
    function rxRenderList() {
      rxArticle.hidden = true; rxList.hidden = false;
      rxPanel.querySelector('.roxy-faq-head strong').textContent = RX.faqTitle;
    }
    (RX.articles || []).forEach(function (art) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'roxy-q';
      b.innerHTML = '<span></span>' + RIC.chev;
      b.querySelector('span').textContent = art.q;
      b.addEventListener('click', function () {
        rxList.hidden = true; rxArticle.hidden = false;
        rxArticle.querySelector('h3').textContent = art.q;
        rxArticle.querySelector('p').textContent = art.a;
        var link = rxArticle.querySelector('.roxy-article-link');
        if (art.link && art.link.to) {
          link.hidden = false; link.textContent = art.link.label; link.href = rxHref(art.link.to);
          if (rxExternal(art.link.to)) { link.target = '_blank'; link.rel = 'noopener'; } else { link.removeAttribute('target'); }
        } else { link.hidden = true; }
      });
      rxList.appendChild(b);
    });
    rxPanel.querySelector('.roxy-faq-link').addEventListener('click', function () { rxRenderList(); rxShow('faq'); });
    rxBack.addEventListener('click', function () { if (rxArticle.hidden) { rxShow('home'); } else { rxRenderList(); } });

    /* ---- the attention bubble: once on arrival, then every N minutes ---- */
    var RT = RX.teaser;
    if (RT) {
      var rxTip = document.createElement('div');
      rxTip.className = 'roxy-tip';
      rxTip.setAttribute('role', 'note');
      rxTip.innerHTML =
        '<span class="roxy-ava" aria-hidden="true">' + RX.name.charAt(0) + '</span>' +
        '<span class="roxy-tip-t"><strong></strong><p></p></span>' +
        '<button type="button" class="roxy-tip-x">&times;</button>';
      rxTip.querySelector('strong').textContent = RT.title;
      rxTip.querySelector('p').textContent = RT.body;
      var rxTipX = rxTip.querySelector('.roxy-tip-x');
      rxTipX.setAttribute('aria-label', RT.close || 'Close');
      document.body.appendChild(rxTip);

      var rxTipTimer = null;
      function rxTipHide() {
        rxTip.classList.remove('show');
        rxBtn.classList.remove('nudging');
        if (rxTipTimer) { clearTimeout(rxTipTimer); rxTipTimer = null; }
      }
      function rxTipShow() {
        /* someone already has Roxy open: skip this beat, don't point a bubble at an open panel */
        if (rxOpen) return;
        /* the booking nudge lives in this same corner and sits there until it's dismissed, so it
           has to yield or Roxy's beat would be starved forever. It has had the corner since the
           16-second mark and its one CTA is now Roxy's first row, so nothing is lost by retiring it. */
        var booking = document.querySelector('.nudge.show');
        if (booking) { booking.classList.remove('show'); sessionStorage.setItem('nudged', '1'); }
        rxTip.classList.add('show');
        rxBtn.classList.add('nudging');
        rxTipTimer = setTimeout(rxTipHide, 10000);
      }
      rxTip.addEventListener('click', function (e) {
        if (e.target === rxTipX) return;
        rxTipHide(); rxSet(true);
      });
      rxTipX.addEventListener('click', rxTipHide);
      rxBtn.addEventListener('click', rxTipHide);

      setTimeout(rxTipShow, 4000);
      setInterval(rxTipShow, Math.max(1, RT.everyMinutes || 5) * 60 * 1000);
    }
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
