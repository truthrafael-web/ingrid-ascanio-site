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
      var t = document.querySelector('.roxy-teaser');
      if (t) t.classList.remove('show');
    }, (N.delaySeconds || 16) * 1000);
  }

  /* ---------- Roxy — Intercom-style messenger (Home · Messages · Help) ---------- */
  var R = I18N.roxy;
  var externalChat = !!GHL.chatWidgetSrc;
  if (R && !externalChat) {
    var loansPath = lang === 'es' ? '/es/opciones-de-prestamo/' : '/loan-options/';
    function articleHref(key) { return key === 'upload' ? I18N.uploadPath : key === 'loans' ? loansPath : null; }
    var ICONS = {
      chat: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1L3 20l1.1-4.3A8.5 8.5 0 1 1 21 11.5z"/></svg>',
      close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
      home: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
      msg: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1L3 20l1.1-4.3A8.5 8.5 0 1 1 21 11.5z"/></svg>',
      help: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.5 2.5 0 1 1 3.4 2.4c-.8.3-.9 1-.9 1.6"/><circle cx="12" cy="16.8" r=".4" fill="currentColor"/></svg>',
      arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
      chev: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
      search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/></svg>',
      send: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>',
      back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>'
    };
    var AVATAR = '<span class="roxy-avatar" aria-hidden="true">R</span>';

    var rBtn = document.createElement('button');
    rBtn.className = 'roxy-btn';
    rBtn.setAttribute('aria-label', R.buttonLabel);
    rBtn.innerHTML = '<span class="roxy-btn-open">' + ICONS.chat + '</span><span class="roxy-btn-close">' + ICONS.close + '</span>';
    var teaser = document.createElement('div');
    teaser.className = 'roxy-teaser';
    teaser.setAttribute('role', 'status');
    teaser.innerHTML = '<button type="button" class="roxy-teaser-x" aria-label="Close">×</button>' +
      AVATAR + '<p></p>';
    teaser.querySelector('p').textContent = R.teaser;

    var panel = document.createElement('div');
    panel.className = 'roxy-panel';
    panel.innerHTML =
      /* HOME */
      '<div class="roxy-view roxy-view-home">' +
        '<div class="roxy-home-hero">' +
          '<div class="roxy-home-brand"><img src="/assets/img/pmf-logo-transparent.png" alt="Pioneer Mortgage Funding" width="120"></div>' +
          '<h2></h2>' +
        '</div>' +
        '<div class="roxy-home-cards">' +
          '<button type="button" class="roxy-card roxy-card-send"><span class="roxy-card-text"><strong></strong><small></small></span>' + ICONS.arrow + '</button>' +
          '<a class="roxy-card roxy-card-book" href="#"><span class="roxy-card-text"><strong></strong></span>' + ICONS.chev + '</a>' +
          '<a class="roxy-card roxy-card-upload" href="#"><span class="roxy-card-text"><strong></strong></span>' + ICONS.chev + '</a>' +
          '<div class="roxy-card roxy-card-search">' +
            '<label class="roxy-search">' + ICONS.search + '<input type="text"></label>' +
            '<div class="roxy-home-articles"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      /* MESSAGES */
      '<div class="roxy-view roxy-view-chat" hidden>' +
        '<div class="roxy-chat-head">' + AVATAR + '<span class="roxy-chat-id"><strong></strong><small></small></span></div>' +
        '<div class="roxy-msgs"></div><div class="roxy-chips"></div>' +
        '<form class="roxy-input"><input type="text" autocomplete="off"><button type="submit" aria-label="Send">' + ICONS.send + '</button></form>' +
      '</div>' +
      /* HELP */
      '<div class="roxy-view roxy-view-help" hidden>' +
        '<div class="roxy-help-head"><button type="button" class="roxy-help-back" hidden>' + ICONS.back + '</button><strong></strong></div>' +
        '<div class="roxy-help-body">' +
          '<label class="roxy-search">' + ICONS.search + '<input type="text"></label>' +
          '<div class="roxy-help-list"></div>' +
          '<article class="roxy-article" hidden><h3></h3><p></p><a class="roxy-book roxy-article-link" hidden></a>' +
            '<div class="roxy-article-more"><span></span><a class="roxy-book" href="#"></a></div></article>' +
        '</div>' +
      '</div>' +
      /* TABS */
      '<nav class="roxy-tabs">' +
        '<button type="button" data-view="home" class="on">' + ICONS.home + '<span></span></button>' +
        '<button type="button" data-view="chat">' + ICONS.msg + '<span></span></button>' +
        '<button type="button" data-view="help">' + ICONS.help + '<span></span></button>' +
      '</nav>';

    /* fill i18n text */
    panel.querySelector('.roxy-home-hero h2').textContent = R.home.hi;
    var sendCard = panel.querySelector('.roxy-card-send');
    sendCard.querySelector('strong').textContent = R.home.sendTitle;
    sendCard.querySelector('small').textContent = R.home.sendSub;
    var bookCard = panel.querySelector('.roxy-card-book');
    bookCard.querySelector('strong').textContent = R.home.bookRow;
    bookCard.href = calendarHref();
    if (GHL.calendarUrl) { bookCard.target = '_blank'; bookCard.rel = 'noopener'; }
    var upCard = panel.querySelector('.roxy-card-upload');
    upCard.querySelector('strong').textContent = R.home.uploadRow;
    upCard.href = I18N.uploadPath;
    panel.querySelector('.roxy-chat-id strong').textContent = R.name;
    panel.querySelector('.roxy-chat-id small').textContent = R.agentTag;
    panel.querySelector('.roxy-help-head strong').textContent = R.helpTitle;
    panel.querySelectorAll('.roxy-search input').forEach(function (i) { i.placeholder = R.home.searchPh; });
    panel.querySelector('.roxy-input input').placeholder = R.placeholder;
    var tabBtns = panel.querySelectorAll('.roxy-tabs button');
    tabBtns[0].querySelector('span').textContent = R.tabs.home;
    tabBtns[1].querySelector('span').textContent = R.tabs.messages;
    tabBtns[2].querySelector('span').textContent = R.tabs.help;
    var moreBox = panel.querySelector('.roxy-article-more');
    moreBox.querySelector('span').textContent = R.helpMore;
    var moreBtn = moreBox.querySelector('a');
    moreBtn.textContent = R.bookCta; moreBtn.href = calendarHref();
    if (GHL.calendarUrl) { moreBtn.target = '_blank'; moreBtn.rel = 'noopener'; }

    document.body.appendChild(teaser);
    document.body.appendChild(rBtn);
    document.body.appendChild(panel);

    /* view switching */
    var views = { home: panel.querySelector('.roxy-view-home'), chat: panel.querySelector('.roxy-view-chat'), help: panel.querySelector('.roxy-view-help') };
    function show(v) {
      Object.keys(views).forEach(function (k) { views[k].hidden = k !== v; });
      tabBtns.forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === v); });
      if (v === 'chat') { startChat(); }
    }
    tabBtns.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-view')); }); });
    sendCard.addEventListener('click', function () { show('chat'); });

    /* help articles (list + search + article view) */
    var helpList = panel.querySelector('.roxy-help-list');
    var homeArticles = panel.querySelector('.roxy-home-articles');
    var articleView = panel.querySelector('.roxy-article');
    var backBtn = panel.querySelector('.roxy-help-back');
    function openArticle(art) {
      show('help');
      helpList.hidden = true; backBtn.hidden = false; articleView.hidden = false;
      articleView.querySelector('h3').textContent = art.q;
      articleView.querySelector('p').textContent = art.a;
      var al = articleView.querySelector('.roxy-article-link');
      var href = art.link ? articleHref(art.link) : null;
      if (href) { al.hidden = false; al.href = href; al.textContent = art.linkLabel; } else { al.hidden = true; }
    }
    function closeArticle() { helpList.hidden = false; backBtn.hidden = true; articleView.hidden = true; }
    backBtn.addEventListener('click', closeArticle);
    function articleRow(art) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'roxy-art-row';
      b.innerHTML = '<span></span>' + ICONS.chev;
      b.querySelector('span').textContent = art.q;
      b.addEventListener('click', function () { openArticle(art); });
      return b;
    }
    function renderList(box, filter, max) {
      box.innerHTML = '';
      var q = (filter || '').toLowerCase();
      var shown = 0;
      (R.articles || []).forEach(function (art) {
        if (max && shown >= max) return;
        if (q && (art.q + ' ' + art.a).toLowerCase().indexOf(q) === -1) return;
        box.appendChild(articleRow(art)); shown++;
      });
    }
    renderList(homeArticles, '', 4);
    renderList(helpList, '');
    panel.querySelector('.roxy-card-search input').addEventListener('input', function () { renderList(homeArticles, this.value, this.value ? 0 : 4); });
    panel.querySelector('.roxy-help-body .roxy-search input').addEventListener('input', function () { closeArticle(); renderList(helpList, this.value); });

    /* chat */
    var msgs = panel.querySelector('.roxy-msgs');
    var chipsBox = panel.querySelector('.roxy-chips');
    var input = panel.querySelector('.roxy-input input');
    var opened = false;

    function meta() {
      var d = document.createElement('div');
      d.className = 'roxy-meta';
      d.textContent = R.meta;
      msgs.appendChild(d);
    }
    function bubble(text, who) {
      var m = document.createElement('div');
      m.className = 'roxy-msg ' + who;
      m.textContent = text;
      msgs.appendChild(m);
      msgs.scrollTop = msgs.scrollHeight;
      return m;
    }
    function typing(cb, delay) {
      var t = document.createElement('div');
      t.className = 'roxy-msg bot roxy-typing';
      t.innerHTML = '<span></span><span></span><span></span>';
      msgs.appendChild(t);
      msgs.scrollTop = msgs.scrollHeight;
      setTimeout(function () { t.remove(); cb(); }, delay || 900);
    }
    function say(text, who, withBook, linkHref, linkLabel) {
      if (who !== 'bot') { bubble(text, who); return; }
      typing(function () {
        var m = bubble(text, 'bot');
        if (withBook) {
          var a = document.createElement('a');
          a.className = 'roxy-book';
          a.textContent = R.bookCta;
          a.href = calendarHref();
          if (GHL.calendarUrl) { a.target = '_blank'; a.rel = 'noopener'; }
          m.appendChild(document.createElement('br'));
          m.appendChild(a);
        }
        if (linkHref) {
          var l = document.createElement('a');
          l.className = 'roxy-book'; l.href = linkHref; l.textContent = linkLabel;
          m.appendChild(document.createElement('br'));
          m.appendChild(l);
        }
        meta();
        msgs.scrollTop = msgs.scrollHeight;
      });
    }
    function answer(q) {
      var t = q.toLowerCase();
      var best = null, bestScore = 0;
      (R.kb || []).forEach(function (item) {
        var score = 0;
        item.k.forEach(function (kw) { if (t.indexOf(kw) !== -1) score += kw.length; });
        if (score > bestScore) { bestScore = score; best = item; }
      });
      if (best) {
        var wantsBook = /book|call|schedul|agend|llamada|cita|reserv/.test(best.k.join(' ')) || /rate|tasa|book|call|agend|llamada/.test(t);
        say(best.a, 'bot', wantsBook);
      } else {
        say(R.fallback, 'bot', true);
      }
    }
    var ACTIONS = {
      book: function () { say(R.kb[0].a, 'bot', true); },
      preapproval: function () { answer('pre-approval preaprob'); },
      documents: function () { answer('documents documento'); },
      loans: function () {
        say(lang === 'es' ? 'Aquí tienes todos los programas:' : 'Here are all the programs:', 'bot', false,
          loansPath, lang === 'es' ? 'Ver tipos de préstamo' : 'See loan options');
      },
      upload: function () {
        say(lang === 'es' ? 'Te llevo a la página segura para enviar tus documentos:' : 'Here\'s the secure page to send your documents:', 'bot', false,
          I18N.uploadPath, lang === 'es' ? 'Subir documentos' : 'Upload documents');
      }
    };
    (R.chips || []).forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'roxy-chip'; b.textContent = c.label;
      b.addEventListener('click', function () { say(c.label, 'user'); (ACTIONS[c.action] || function () { answer(c.label); })(); });
      chipsBox.appendChild(b);
    });
    panel.querySelector('.roxy-input').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      say(q, 'user'); input.value = '';
      answer(q);
    });
    function startChat() {
      if (!opened) { opened = true; say(R.greeting, 'bot'); }
      input.focus();
    }
    function openPanel() {
      panel.classList.add('open'); rBtn.classList.add('open'); teaser.classList.remove('show');
      sessionStorage.setItem('roxy-teased', '1');
      show('home');
    }
    function closePanel() { panel.classList.remove('open'); rBtn.classList.remove('open'); }
    rBtn.addEventListener('click', function () {
      panel.classList.contains('open') ? closePanel() : openPanel();
    });
    /* teaser: shows on every page (4s in) until the visitor dismisses it or opens Roxy */
    if (!sessionStorage.getItem('roxy-teased')) {
      setTimeout(function () { if (!panel.classList.contains('open')) teaser.classList.add('show'); }, 4000);
      teaser.addEventListener('click', function (e) {
        if (e.target.closest('.roxy-teaser-x')) {
          teaser.classList.remove('show');
          sessionStorage.setItem('roxy-teased', '1');
          return;
        }
        openPanel(); show('chat');
      });
    }
  }

  /* ---------- GHL chat widget (replaces Roxy when provided) ---------- */
  if (externalChat) {
    var s = document.createElement('script');
    s.src = GHL.chatWidgetSrc;
    if (GHL.chatWidgetResourcesUrl) s.setAttribute('data-resources-url', GHL.chatWidgetResourcesUrl);
    if (GHL.chatWidgetId) s.setAttribute('data-widget-id', GHL.chatWidgetId);
    s.defer = true;
    document.body.appendChild(s);
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
