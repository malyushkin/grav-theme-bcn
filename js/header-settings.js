(function () {
  var KEY = 'bcn-theme';
  var ALLOWED = ['auto', 'light', 'dark'];
  var html = document.documentElement;

  function getStored() {
    try {
      var v = localStorage.getItem(KEY);
      return ALLOWED.indexOf(v) >= 0 ? v : null;
    } catch (e) { return null; }
  }

  function setStored(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) { /* private mode */ }
  }

  function resolveAutoTheme() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }

  /* A theme flip changes color, background and border on nearly every
     element at once. Left alone, every transition on those properties
     fires together and the switch smears instead of snapping. */
  function withoutTransitions(fn) {
    var style = document.createElement('style');
    style.appendChild(document.createTextNode(
      '*,*::before,*::after{transition:none !important}'
    ));
    document.head.appendChild(style);
    fn();
    void document.body.offsetHeight;
    requestAnimationFrame(function () { style.remove(); });
  }

  function applyMode(mode) {
    html.dataset.themeMode = mode;
    html.dataset.theme = mode === 'auto' ? resolveAutoTheme() : mode;
    var buttons = document.querySelectorAll('[data-theme-mode-set]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed',
        buttons[i].getAttribute('data-theme-mode-set') === mode ? 'true' : 'false');
    }
  }

  var themeButtons = document.querySelectorAll('[data-theme-mode-set]');
  if (themeButtons.length) {
    applyMode(getStored() || html.dataset.themeMode || 'auto');
  }

  for (var i = 0; i < themeButtons.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-theme-mode-set');
        if (ALLOWED.indexOf(mode) < 0) return;
        setStored(mode);
        withoutTransitions(function () { applyMode(mode); });
      });
    })(themeButtons[i]);
  }

  /* Disclosures: a [data-bcn-disclosure] button shows and hides the element
     its aria-controls names. One open at a time; Escape or a click outside
     closes it, and Escape puts focus back on the button. */
  var toggles = document.querySelectorAll('[data-bcn-disclosure]');

  function panelOf(toggle) {
    return document.getElementById(toggle.getAttribute('aria-controls'));
  }

  function setOpen(toggle, open) {
    var panel = panelOf(toggle);
    if (!panel) return;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function openToggle() {
    for (var i = 0; i < toggles.length; i++) {
      if (toggles[i].getAttribute('aria-expanded') === 'true') return toggles[i];
    }
    return null;
  }

  for (var j = 0; j < toggles.length; j++) {
    (function (toggle) {
      toggle.addEventListener('click', function () {
        var wasOpen = toggle.getAttribute('aria-expanded') === 'true';
        var current = openToggle();
        if (current && current !== toggle) setOpen(current, false);
        setOpen(toggle, !wasOpen);
      });
    })(toggles[j]);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var current = openToggle();
    if (!current) return;
    setOpen(current, false);
    current.focus();
  });

  document.addEventListener('click', function (e) {
    var current = openToggle();
    if (!current) return;
    var panel = panelOf(current);
    if (current.contains(e.target) || (panel && panel.contains(e.target))) return;
    setOpen(current, false);
  });

  /* Auto mode follows an OS theme change while the page is open. */
  var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      if (html.dataset.themeMode === 'auto') {
        html.dataset.theme = e.matches ? 'dark' : 'light';
      }
    });
  }

  /* Sticky-nav shrink on scroll. Independent of the popover: a page that
     does not render the control still gets the scrolled header state. */
  var nav = document.querySelector('.site-nav-fixed');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
