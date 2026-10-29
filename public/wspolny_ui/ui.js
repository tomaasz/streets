/*
 * Wspólny UI aplikacji Urzędu Miejskiego w Wyszkowie: motyw, menu, dialogi
 * i zachowania wspólne dla aplikacji.
 * Dołączać w <head> bez defer/async, żeby zapamiętany motyw był ustawiony
 * przed pierwszym renderowaniem. Plik zewnętrzny, bo CSP części aplikacji
 * nie dopuszcza skryptów inline.
 *
 * Znaczniki:
 *   <button data-ui-theme-toggle>          przełącznik motywu (aria-label ustawiany tutaj);
 *                                          bez zapisanego wyboru obowiązuje jasny motyw
 *   <details class="ui-dropdown">          menu w pasku; Escape i kliknięcie obok je zamykają
 *   <button data-ui-dialog-open="ID">      otwiera <dialog id="ID" class="ui-dialog"> jako modalny
 *   <button data-ui-dialog-close>          zamyka dialog, w którym się znajduje
 *   <a|button|form data-ui-confirm="Treść"> pyta w dialogu przed przejściem/wysłaniem;
 *                                          data-ui-confirm-label="Usuń", data-ui-confirm-danger
 *   <form data-ui-dirty-guard>             ostrzega przed opuszczeniem strony z niezapisanymi
 *                                          zmianami; [data-ui-dirty-show] w formularzu
 *                                          (np. .ui-savebar) pojawia się po pierwszej zmianie
 *   <button data-ui-sidenav-toggle>        zwija .ui-sidenav do szyny ikon (stan zapamiętany)
 *   [data-ui-tooltip="Tekst"]           podpowiedź na hover/fokus; -ref="ID" wskazuje opis
 *   [data-ui-tooltip-trigger]             przycisk informacji: otwarcie/zamknięcie dotykiem
 *   .ui-error-summary                      podsumowanie błędów formularza dostaje fokus
 *
 * API: window.ui.toast(tekst, {kind: 'success'|'warning'|'danger'|'info', action: {label, run}})
 *      window.ui.confirm(tekst, {title, label, danger}) → Promise<boolean>
 * Tekst zawsze trafia do DOM przez textContent.
 */
(function () {
  'use strict';
  var KEY = 'ui-theme';
  var root = document.documentElement;

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* tryb prywatny itp. */ }
  }
  function isDark() { return root.getAttribute('data-ui-theme') === 'dark'; }
  // data-bs-theme przełącza wbudowane warianty ciemne Bootstrapa 5.3 (jeśli jest używany)
  function apply(dark) {
    if (dark) {
      root.setAttribute('data-ui-theme', 'dark');
      root.setAttribute('data-bs-theme', 'dark');
    } else {
      root.removeAttribute('data-ui-theme');
      root.removeAttribute('data-bs-theme');
    }
  }
  function preferred() {
    return read(KEY) === 'dark';
  }

  apply(preferred());

  function labelToggles() {
    var buttons = document.querySelectorAll('[data-ui-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-label', isDark() ? 'Włącz jasny motyw' : 'Włącz ciemny motyw');
    }
  }

  // ── Wysokość przypiętej belki ──────────────────────────────────────
  // --ui-sticky-top = rzeczywista wysokość paska i zakładek, także gdy aplikacja
  // dołoży drugi wiersz zakładek albo zmieni się rozmiar fontu.
  function measureBar() {
    var height = 0;
    var bars = document.querySelectorAll('.ui-appbar, .ui-nav');
    for (var i = 0; i < bars.length; i++) {
      var position = getComputedStyle(bars[i]).position;
      if (position === 'sticky' || position === 'fixed') height += bars[i].getBoundingClientRect().height;
    }
    if (height) root.style.setProperty('--ui-sticky-top', Math.round(height) + 'px');
    else root.style.removeProperty('--ui-sticky-top');
  }
  function watchBar() {
    measureBar();
    if (!window.ResizeObserver) {
      window.addEventListener('resize', measureBar);
      return;
    }
    var frame = 0;
    var observer = new ResizeObserver(function () {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measureBar);
    });
    var bars = document.querySelectorAll('.ui-appbar, .ui-nav');
    for (var i = 0; i < bars.length; i++) observer.observe(bars[i]);
  }

  // ── Komunikaty (toast) ─────────────────────────────────────────────
  function toastRegion() {
    var region = document.querySelector('.ui-toasts');
    if (!region) {
      region = document.createElement('div');
      region.className = 'ui-toasts';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    return region;
  }
  function toast(text, options) {
    options = options || {};
    var kind = options.kind || 'info';
    var item = document.createElement('div');
    item.className = 'ui-toast ui-toast-' + kind;
    var message = document.createElement('span');
    message.className = 'ui-toast-text';
    message.textContent = text;
    item.appendChild(message);
    if (options.action) {
      var action = document.createElement('button');
      action.type = 'button';
      action.className = 'ui-toast-action';
      action.textContent = options.action.label;
      action.addEventListener('click', function () {
        options.action.run();
        item.remove();
      });
      item.appendChild(action);
    }
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ui-toast-close';
    close.setAttribute('aria-label', 'Zamknij komunikat');
    close.textContent = '×';
    close.addEventListener('click', function () { item.remove(); });
    item.appendChild(close);
    toastRegion().appendChild(item);
    // błędy zostają do zamknięcia; reszta znika (z akcją „Cofnij” dłużej)
    var timeout = options.timeout != null ? options.timeout
      : kind === 'danger' ? 0 : options.action ? 12000 : 6000;
    if (timeout) setTimeout(function () { item.remove(); }, timeout);
    return item;
  }

  // ── Potwierdzenie w dialogu zamiast window.confirm ─────────────────
  function confirmDialog(text, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var dialog = document.createElement('dialog');
      dialog.className = 'ui-dialog';
      dialog.setAttribute('aria-labelledby', 'ui-confirm-title');
      var heading = document.createElement('div');
      heading.className = 'ui-dialog-heading';
      var title = document.createElement('h2');
      title.id = 'ui-confirm-title';
      title.textContent = options.title || 'Potwierdź';
      heading.appendChild(title);
      var body = document.createElement('div');
      body.className = 'ui-dialog-body';
      var paragraph = document.createElement('p');
      paragraph.textContent = text;
      body.appendChild(paragraph);
      var footer = document.createElement('form');
      footer.method = 'dialog';
      footer.className = 'ui-dialog-footer ui-actions ui-actions-end';
      var cancel = document.createElement('button');
      cancel.className = 'ui-button';
      cancel.value = 'cancel';
      cancel.textContent = 'Anuluj';
      var accept = document.createElement('button');
      accept.className = 'ui-button ' + (options.danger ? 'ui-button-danger' : 'ui-button-primary');
      accept.value = 'ok';
      accept.textContent = options.label || 'OK';
      footer.appendChild(cancel);
      footer.appendChild(accept);
      dialog.appendChild(heading);
      dialog.appendChild(body);
      dialog.appendChild(footer);
      document.body.appendChild(dialog);
      dialog.addEventListener('close', function () {
        resolve(dialog.returnValue === 'ok');
        dialog.remove();
      });
      dialog.showModal();
      cancel.focus();
    });
  }
  function confirmed(element) {
    return confirmDialog(element.getAttribute('data-ui-confirm'), {
      title: element.getAttribute('data-ui-confirm-title') || undefined,
      label: element.getAttribute('data-ui-confirm-label') || undefined,
      danger: element.hasAttribute('data-ui-confirm-danger')
    });
  }

  // ── Niezapisane zmiany ─────────────────────────────────────────────
  function markDirty(form) {
    if (form.hasAttribute('data-ui-dirty')) return;
    form.setAttribute('data-ui-dirty', '');
    var shown = form.querySelectorAll('[data-ui-dirty-show]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
  }
  function onFormInput(event) {
    var form = event.target.form || event.target.closest && event.target.closest('form');
    if (form && form.hasAttribute('data-ui-dirty-guard')) markDirty(form);
  }

  // ── Panel boczny ───────────────────────────────────────────────────
  function sidenavKey(workspace) { return 'ui-sidenav:' + (workspace.id || location.pathname.split('/')[1] || 'main'); }
  function setCollapsed(workspace, collapsed) {
    if (collapsed) workspace.setAttribute('data-ui-collapsed', '');
    else workspace.removeAttribute('data-ui-collapsed');
    var toggles = workspace.querySelectorAll('[data-ui-sidenav-toggle]');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggles[i].setAttribute('aria-label', collapsed ? 'Rozwiń panel boczny' : 'Zwiń panel boczny');
    }
  }

  // ── Dymki: jedna instancja, tekst bez HTML, obsługa treści dynamicznej ──
  function initTooltips() {
    var selector = '[data-ui-tooltip], [data-ui-tooltip-ref], [data-bs-toggle="tooltip"], [title]';
    var active = null, bubble = null, showTimer = 0, hideTimer = 0, pinned = false;
    var hovered = null, focused = null, suppressed = null, overBubble = false;
    var serial = 0;
    var nativeTitles = new WeakMap();

    function upgradeBootstrap(scope) {
      var nodes = Array.prototype.slice.call(scope.querySelectorAll('[data-bs-toggle="tooltip"]'));
      if (scope.matches && scope.matches('[data-bs-toggle="tooltip"]')) nodes.push(scope);
      nodes.forEach(function (el) {
        var text = el.getAttribute('data-bs-title') || el.getAttribute('data-bs-original-title') || el.title;
        if (window.bootstrap && window.bootstrap.Tooltip) {
          var instance = window.bootstrap.Tooltip.getInstance(el);
          if (instance) instance.dispose();
        }
        if (text) el.setAttribute('data-ui-tooltip', text);
        el.removeAttribute('data-bs-toggle');
      });
    }
    function trigger(target) {
      return target && target.closest ? target.closest(selector) : null;
    }
    function textFor(el) {
      var ref = document.getElementById(el.getAttribute('data-ui-tooltip-ref'));
      return ref ? ref.textContent.trim() : el.getAttribute('data-ui-tooltip') || el.getAttribute('title') || nativeTitles.get(el) || '';
    }
    function restoreTitle(el) {
      if (el && nativeTitles.has(el)) {
        if (!el.hasAttribute('title')) el.setAttribute('title', nativeTitles.get(el));
        nativeTitles.delete(el);
      }
    }
    function hide() {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      showTimer = 0;
      if (bubble) {
        var ids = (active.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) { return id && id !== bubble.id; });
        if (ids.length) active.setAttribute('aria-describedby', ids.join(' '));
        else active.removeAttribute('aria-describedby');
        bubble.remove();
      }
      restoreTitle(active);
      bubble = null;
      overBubble = false;
      active = null;
      pinned = false;
    }
    function position() {
      if (!bubble || !active) return;
      var r = active.getBoundingClientRect();
      var viewport = window.visualViewport;
      var leftEdge = viewport ? viewport.offsetLeft : 0;
      var topEdge = viewport ? viewport.offsetTop : 0;
      var width = viewport ? viewport.width : document.documentElement.clientWidth;
      var height = viewport ? viewport.height : window.innerHeight;
      if (!active.isConnected || r.bottom <= topEdge || r.top >= topEdge + height || r.right <= leftEdge || r.left >= leftEdge + width) {
        hide();
        return;
      }
      bubble.style.maxWidth = Math.max(1, Math.min(340, width - 16)) + 'px';
      bubble.style.maxHeight = Math.max(1, height - 16) + 'px';
      var b = bubble.getBoundingClientRect();
      var x = Math.max(leftEdge + 8, Math.min(r.left + (r.width - b.width) / 2, leftEdge + width - b.width - 8));
      var y = r.bottom + 8;
      if (y + b.height > topEdge + height - 8) y = r.top - b.height - 8;
      y = Math.max(topEdge + 8, Math.min(y, topEdge + height - b.height - 8));
      bubble.style.left = Math.round(x) + 'px';
      bubble.style.top = Math.round(y) + 'px';
    }
    function show(el) {
      if (!el.isConnected || el === suppressed || !textFor(el).trim()) return;
      if (active === el) { clearTimeout(hideTimer); return; }
      hide();
      upgradeBootstrap(el);
      active = el;
      if (el.hasAttribute('title')) {
        nativeTitles.set(el, el.getAttribute('title'));
        // Zapewnij nazwę przycisku ikonowego, jeśli dotychczas pochodziła z title.
        if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && !el.textContent.trim() && !(el.labels && el.labels.length)) {
          el.setAttribute('aria-label', nativeTitles.get(el));
        }
        el.removeAttribute('title');
      }
      bubble = document.createElement('div');
      do { serial++; } while (document.getElementById('ui-tooltip-' + serial));
      bubble.id = 'ui-tooltip-' + serial;
      bubble.className = 'ui-tooltip';
      bubble.setAttribute('role', 'tooltip');
      bubble.textContent = textFor(el);
      // Popover trafia do warstwy górnej: nie przycina go overflow tabeli ani panelu.
      if (bubble.showPopover) bubble.setAttribute('popover', 'manual');
      (el.closest('dialog[open]') || document.body).appendChild(bubble);
      if (bubble.showPopover) bubble.showPopover();
      var described = (el.getAttribute('aria-describedby') || '').trim();
      el.setAttribute('aria-describedby', (described ? described + ' ' : '') + bubble.id);
      bubble.addEventListener('pointerenter', function () { overBubble = true; clearTimeout(hideTimer); });
      bubble.addEventListener('pointerleave', function () { overBubble = false; scheduleHide(); });
      position();
    }
    function scheduleShow(el, delay) {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      if (el === suppressed || !textFor(el).trim()) return;
      // Wyłącz natywny dymek już przy wejściu, zanim przeglądarka go pokaże.
      if (el.hasAttribute('title')) {
        nativeTitles.set(el, el.getAttribute('title'));
        if (!el.hasAttribute('data-ui-tooltip') && !el.hasAttribute('data-ui-tooltip-ref')) {
          el.setAttribute('data-ui-tooltip', el.title);
        }
        if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && !el.textContent.trim() && !(el.labels && el.labels.length)) {
          el.setAttribute('aria-label', el.title);
        }
        el.removeAttribute('title');
      }
      showTimer = setTimeout(function () { showTimer = 0; show(el); }, delay);
    }
    function scheduleHide() {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (!pinned && !overBubble && active !== focused && active !== hovered) hide();
      }, 180);
    }
    upgradeBootstrap(document);
    document.addEventListener('htmx:afterSwap', function (event) { upgradeBootstrap(event.target); }, true);
    document.addEventListener('pointerover', function (event) {
      if (event.pointerType === 'touch') return;
      var el = trigger(event.target);
      if (!el || el.contains(event.relatedTarget)) return;
      upgradeBootstrap(el);
      hovered = el;
      suppressed = null;
      scheduleShow(el, 400);
    }, true);
    document.addEventListener('pointerout', function (event) {
      var el = trigger(event.target);
      if (!el || el.contains(event.relatedTarget)) return;
      if (hovered === el) hovered = null;
      if (suppressed === el) suppressed = null;
      if (el !== active) restoreTitle(el);
      scheduleHide();
    }, true);
    document.addEventListener('focusin', function (event) {
      var el = trigger(event.target);
      if (!el) return;
      focused = el;
      suppressed = null;
      scheduleShow(el, 0);
    });
    document.addEventListener('focusout', function (event) {
      var el = trigger(event.target);
      focused = null;
      pinned = false;
      if (suppressed === el) suppressed = null;
      if (el !== active) restoreTitle(el);
      scheduleHide();
    });
    document.addEventListener('click', function (event) {
      var el = event.target.closest('[data-ui-tooltip-trigger]');
      if (el) {
        if (active === el && pinned) { suppressed = el; hide(); }
        else { suppressed = null; show(el); pinned = true; }
        return;
      }
      if (bubble && !bubble.contains(event.target) && !active.contains(event.target)) hide();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (active || showTimer) {
        suppressed = active || hovered || focused;
        hide();
        event.preventDefault();
        // Escape zamyka również otwarte menu, lecz nie dialog pod samą podpowiedzią.
        if (!document.querySelector('.ui-dropdown[open]')) event.stopImmediatePropagation();
      }
    }, true);
    document.addEventListener('close', function (event) {
      if (active && event.target.contains(active)) hide();
    }, true);
    window.addEventListener('blur', hide);
    document.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', position);
      window.visualViewport.addEventListener('scroll', position);
    }
    // Usunięcie wyzwalacza przez HTMX/React musi usunąć również dymek.
    new MutationObserver(function () { if (active && !active.isConnected) hide(); })
      .observe(document.body, {childList: true, subtree: true});
  }


  // Centrum pomocy: teksty i identyfikatory pochodzą z lokalnych sekcji aplikacji.
  function initHelp() {
    document.querySelectorAll('[data-ui-help]:not([data-ui-help-ready]):not([data-ui-help-defer])').forEach(function (root) {
      var input = root.querySelector('[data-ui-help-search]');
      var nav = root.querySelector('[data-ui-help-nav]');
      var count = root.querySelector('[data-ui-help-count]');
      var empty = root.querySelector('[data-ui-help-empty]');
      if (!input || !nav || !count || !empty) return;
      nav.textContent = '';
      function normalize(text) {
        return text.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
      }
      var route = root.getAttribute('data-ui-help-route');
      function hashId() {
        var hash = location.hash.slice(1);
        if (route) {
          if (hash.indexOf(route + '/') !== 0) return '';
          hash = hash.slice(route.length + 1);
        }
        try { return decodeURIComponent(hash); } catch (_) { return ''; }
      }
      var sections = Array.from(root.querySelectorAll('.ui-help-section[id]')).map(function (section) {
        var heading = section.querySelector('h2');
        if (!heading) return null;
        var link = document.createElement('a');
        link.href = '#' + (route ? route + '/' : '') + encodeURIComponent(section.id);
        link.textContent = heading.textContent;
        nav.appendChild(link);
        section.tabIndex = -1;
        link.addEventListener('click', function () {
          section.focus({preventScroll: true});
          // Router oparty o hash nie emituje hashchange przy ponownym wyborze rozdziału.
          if (location.hash === link.hash) revealHash();
        });
        return {element: section, link: link, text: normalize(section.textContent)};
      }).filter(Boolean);
      if (!sections.length) return;
      function activeSection() {
        var offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        var visible = sections.filter(function (item) { return !item.element.hidden; });
        var current = visible[0];
        visible.forEach(function (item) {
          if (item.element.getBoundingClientRect().top <= offset + 32) current = item;
        });
        // Krótki ostatni rozdział nie zawsze da się dosunąć do górnej belki.
        var selectedId = hashId();
        visible.forEach(function (item) {
          var rect = item.element.getBoundingClientRect();
          if (item.element.id === selectedId && rect.top > offset && rect.top < window.innerHeight) current = item;
        });
        sections.forEach(function (item) {
          if (item === current) item.link.setAttribute('aria-current', 'location');
          else item.link.removeAttribute('aria-current');
        });
      }
      var faqState = new Map();
      function filter() {
        var words = normalize(input.value).trim().split(/\s+/).filter(Boolean);
        var total = 0;
        sections.forEach(function (item) {
          var match = words.every(function (word) { return item.text.indexOf(word) !== -1; });
          item.element.hidden = item.link.hidden = !match;
          if (match) total++;
          item.element.querySelectorAll('details').forEach(function (details) {
            if (words.length) {
              if (!faqState.has(details)) faqState.set(details, details.open);
              details.open = words.every(function (word) { return normalize(details.textContent).indexOf(word) !== -1; });
            } else if (faqState.has(details)) {
              details.open = faqState.get(details);
              faqState.delete(details);
            }
          });
        });
        count.textContent = 'Tematy: ' + total + ' z ' + sections.length;
        empty.hidden = total !== 0;
        root.querySelector('.ui-help-search [data-ui-help-clear]').hidden = input.value.length === 0;
        activeSection();
      }
      function clearFilter() { input.value = ''; filter(); input.focus(); }
      var clearButtons = root.querySelectorAll('[data-ui-help-clear]');
      clearButtons.forEach(function (button) { button.addEventListener('click', clearFilter); });
      input.addEventListener('input', filter);
      function onHelpKeydown(event) {
        if (event.key === 'Escape') { input.value = ''; filter(); }
      }
      input.addEventListener('keydown', onHelpKeydown);
      function revealHash() {
        var id = hashId();
        var target = document.getElementById(id);
        if (!target || !root.contains(target)) return;
        var section = target.closest('.ui-help-section');
        if (!section) return;
        input.value = '';
        filter();
        // FAQ pozostaje dostępne także przez bezpośredni odnośnik do pytania.
        var details = target.closest('details');
        if (details) details.open = true;
        target.scrollIntoView({block: 'start'});
        activeSection();
      }
      // Usuwamy hidden także w JS: reguły !important w warstwach Tailwinda
      // mogą mieć pierwszeństwo przed zwykłym arkuszem wydruku.
      var printMedia = window.matchMedia('print');
      function printHelp(event) {
        if (event.matches || event.type === 'beforeprint') {
          sections.forEach(function (item) { item.element.hidden = false; });
        } else filter();
      }
      printMedia.addEventListener('change', printHelp);
      window.addEventListener('beforeprint', printHelp);
      window.addEventListener('afterprint', printHelp);
      root.setAttribute('data-ui-help-ready', '');
      filter();
      revealHash();
      window.addEventListener('hashchange', revealHash);
      root.uiHelpDispose = function () {
        window.removeEventListener('hashchange', revealHash);
        window.removeEventListener('scroll', onHelpScroll);
        printMedia.removeEventListener('change', printHelp);
        window.removeEventListener('beforeprint', printHelp);
        window.removeEventListener('afterprint', printHelp);
        input.removeEventListener('input', filter);
        input.removeEventListener('keydown', onHelpKeydown);
        clearButtons.forEach(function (button) { button.removeEventListener('click', clearFilter); });
      };
      var scheduled = false;
      function onHelpScroll() {
        if (scheduled || !root.isConnected) return;
        scheduled = true;
        requestAnimationFrame(function () { activeSection(); scheduled = false; });
      }
      window.addEventListener('scroll', onHelpScroll, {passive: true});
    });
  }

  function init() {
    initHelp();
    document.addEventListener('htmx:afterSwap', initHelp);
    document.addEventListener('ui:help-init', initHelp);
    document.addEventListener('ui:help-dispose', function (event) {
      var roots = event.detail && event.detail.root ? [event.detail.root] : document.querySelectorAll('[data-ui-help]');
      roots.forEach(function (root) {
        if (root.uiHelpDispose) root.uiHelpDispose();
        root.removeAttribute('data-ui-help-ready');
      });
    });
    initTooltips();
    labelToggles();
    watchBar();
    var workspaces = document.querySelectorAll('.ui-workspace');
    for (var w = 0; w < workspaces.length; w++) {
      setCollapsed(workspaces[w], read(sidenavKey(workspaces[w])) === '1');
    }
    var summary = document.querySelector('.ui-error-summary');
    if (summary) {
      if (!summary.hasAttribute('tabindex')) summary.setAttribute('tabindex', '-1');
      summary.focus();
    }
    var guarded = document.querySelectorAll('form[data-ui-dirty-guard] [data-ui-dirty-show]');
    for (var g = 0; g < guarded.length; g++) guarded[g].hidden = true;

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (target.closest('[data-ui-theme-toggle]')) {
        var dark = !isDark();
        apply(dark);
        write(KEY, dark ? 'dark' : 'light');
        labelToggles();
      }
      var opener = target.closest('[data-ui-dialog-open]');
      if (opener) {
        var dialog = document.getElementById(opener.getAttribute('data-ui-dialog-open'));
        if (dialog && !dialog.open) dialog.showModal();
      }
      var closer = target.closest('[data-ui-dialog-close]');
      if (closer && closer.closest('dialog')) closer.closest('dialog').close();
      var sidenavToggle = target.closest('[data-ui-sidenav-toggle]');
      if (sidenavToggle && sidenavToggle.closest('.ui-workspace')) {
        var workspace = sidenavToggle.closest('.ui-workspace');
        var collapsed = !workspace.hasAttribute('data-ui-collapsed');
        setCollapsed(workspace, collapsed);
        write(sidenavKey(workspace), collapsed ? '1' : '0');
      }
      var dropdowns = document.querySelectorAll('.ui-dropdown[open]');
      for (var i = 0; i < dropdowns.length; i++) {
        if (!dropdowns[i].contains(target)) dropdowns[i].open = false;
      }
    });

    // potwierdzenie linku lub przycisku (przycisk w formularzu wysyła ten formularz)
    document.addEventListener('click', function (event) {
      var element = event.target.closest('a[data-ui-confirm], button[data-ui-confirm]');
      if (!element || element.hasAttribute('data-ui-confirmed')) return;
      event.preventDefault();
      confirmed(element).then(function (ok) {
        if (!ok) return;
        if (element.tagName === 'A') {
          location.href = element.href;
        } else if (element.form) {
          element.setAttribute('data-ui-confirmed', '');
          element.form.requestSubmit(element);
          element.removeAttribute('data-ui-confirmed');
        }
      });
    });
    document.addEventListener('submit', function (event) {
      var form = event.target;
      if (form.hasAttribute('data-ui-confirm') && !form.hasAttribute('data-ui-confirmed')) {
        event.preventDefault();
        confirmed(form).then(function (ok) {
          if (!ok) return;
          form.setAttribute('data-ui-confirmed', '');
          form.requestSubmit(event.submitter || undefined);
          form.removeAttribute('data-ui-confirmed');
        });
        return;
      }
      if (!event.defaultPrevented) form.removeAttribute('data-ui-dirty');
    });
    document.addEventListener('input', onFormInput);
    document.addEventListener('change', onFormInput);
    window.addEventListener('beforeunload', function (event) {
      if (!document.querySelector('form[data-ui-dirty-guard][data-ui-dirty]')) return;
      event.preventDefault();
      event.returnValue = '';
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var open = document.querySelector('.ui-dropdown[open]');
      if (!open) return;
      open.open = false;
      open.querySelector('summary').focus();
    });

    initTelemetry();
  }

  // ── Telemetria lokalna (Umami: ruch + Bugsink: błędy JS) ───────────
  var TELEMETRY_BY_PORT = {
    '80':   { w: '7abe8216-9eff-43ff-9fc9-0afd4588aeec', p: '1', k: '05c633736b0049dfbadf0b01872a3e8a' },
    '8080': { w: '7abe8216-9eff-43ff-9fc9-0afd4588aeec', p: '1', k: '05c633736b0049dfbadf0b01872a3e8a' },
    '3030': { w: 'c5254b1c-6c03-4515-a59a-39f8fbe0ca82', p: '2', k: 'bc67c242ea1a4a048a33166f7e1e4e54' },
    '5055': { w: 'a1a6bc6b-aa31-4e55-90d0-ae17c5992c7b', p: '3', k: '2ab77b414d49444489b46bb3762ebb4a' },
    '8060': { w: 'a1a6bc6b-aa31-4e55-90d0-ae17c5992c7b', p: '3', k: '2ab77b414d49444489b46bb3762ebb4a' },
    '8000': { w: '04613c57-d7af-4e6d-81d8-846171767875', p: '4', k: '0380eb87667f4e34a36a39313114a994' },
    '5050': { w: '4af47975-503a-444b-bff3-2a7b227e9148', p: '5', k: 'd7b4df4f0bc943e8a5deb0c2f1cc80a3' },
    '3000': { w: 'a75f7644-5178-4dd2-a21f-a0ef29ea3030', p: '6', k: '6b69a4b58d1840088f95fc93cf821691' },
    '5057': { w: '0e3b5957-81b3-475e-beeb-c3cb06f9c765', p: '7', k: '37bb247ef58f448a98ec920255e45841' },
    '8090': { w: '0e3b5957-81b3-475e-beeb-c3cb06f9c765', p: '7', k: '37bb247ef58f448a98ec920255e45841' },
    '5058': { w: 'f3000447-845d-44f6-81ee-88b4ee9b1bb5', p: '8', k: 'd6fb172c6b5d45b8b4e20ce258b14808' },
    '8095': { w: 'f3000447-845d-44f6-81ee-88b4ee9b1bb5', p: '8', k: 'd6fb172c6b5d45b8b4e20ce258b14808' }
  };
  var TELEMETRY_BY_HOST = {
    'admin.umw': TELEMETRY_BY_PORT['8080'],
    'akb.umw': TELEMETRY_BY_PORT['3030'],
    'pdf.umw': TELEMETRY_BY_PORT['5055'],
    'ksiazka.umw': TELEMETRY_BY_PORT['8000'],
    'redakcja.umw': TELEMETRY_BY_PORT['5050'],
    'streets.umw': TELEMETRY_BY_PORT['3000']
  };

  function getTelemetryConfig() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
    if (navigator.webdriver) return null;
    var host = location.hostname;
    if (TELEMETRY_BY_HOST[host]) return TELEMETRY_BY_HOST[host];
    var port = location.port || (location.protocol === 'https:' ? '443' : '80');
    return TELEMETRY_BY_PORT[port] || null;
  }

  function hex32() {
    var out = '';
    for (var i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
    return out;
  }

  function parseStack(stack) {
    if (!stack || typeof stack !== 'string') return [];
    var lines = stack.split('\n');
    var frames = [];
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/(?:at\s+(?:([^\s(]+)\s+\()?|@)(https?:\/\/[^:\s)]+):(\d+):(\d+)/);
      if (m) {
        frames.unshift({
          function: m[1] || '<anonymous>',
          filename: m[2],
          lineno: parseInt(m[3], 10),
          colno: parseInt(m[4], 10)
        });
      }
    }
    return frames;
  }

  function reportBugsink(errType, errMsg, stackFrames) {
    var cfg = getTelemetryConfig();
    if (!cfg || !window.fetch) return;
    var host = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? location.hostname : '192.168.0.12';
    var url = 'http://' + host + ':8005/api/' + cfg.p + '/store/?sentry_key=' + cfg.k + '&sentry_version=7';
    var userEl = document.querySelector('.ui-user-name');
    var payload = {
      event_id: hex32(),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: 'error',
      logger: 'wspolny_ui',
      request: {
        url: location.href,
        headers: { 'User-Agent': navigator.userAgent }
      },
      exception: {
        values: [{
          type: String(errType || 'Error'),
          value: String(errMsg || 'Nieznany błąd przeglądarki'),
          stacktrace: { frames: stackFrames && stackFrames.length ? stackFrames : [{ filename: location.href, function: '<global>', lineno: 1, colno: 1 }] }
        }]
      }
    };
    if (userEl && userEl.textContent) {
      payload.user = { username: userEl.textContent.trim() };
    }
    try {
      fetch(url, {
        method: 'POST',
        mode: 'cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload)
      }).catch(function () {});
    } catch (e) {}
  }

  function trackPageview(customName, customData) {
    var cfg = getTelemetryConfig();
    if (!cfg || !window.fetch) return;
    var host = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? location.hostname : '192.168.0.12';
    var payload = {
      website: cfg.w,
      hostname: location.hostname,
      screen: (window.screen ? window.screen.width + 'x' + window.screen.height : '1920x1080'),
      language: navigator.language || 'pl-PL',
      title: document.title || '',
      url: location.pathname + location.search,
      referrer: document.referrer || ''
    };
    if (customName) {
      payload.name = String(customName);
      if (customData) payload.data = customData;
    }
    try {
      fetch('http://' + host + ':3005/api/send', {
        method: 'POST',
        mode: 'cors',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'event', payload: payload })
      }).catch(function () {});
    } catch (e) {}
  }

  function initTelemetry() {
    var cfg = getTelemetryConfig();
    if (!cfg) return;
    trackPageview();
    if (window.history && history.pushState) {
      var origPush = history.pushState;
      var lastPath = location.pathname + location.search;
      history.pushState = function () {
        var ret = origPush.apply(this, arguments);
        setTimeout(function () {
          var cur = location.pathname + location.search;
          if (cur !== lastPath) {
            lastPath = cur;
            trackPageview();
          }
        }, 200);
        return ret;
      };
    }
    window.addEventListener('error', function (event) {
      if (!event) return;
      var err = event.error;
      var type = (err && err.name) || 'Error';
      var msg = (err && err.message) || event.message || 'Błąd skryptu';
      var frames = err && err.stack ? parseStack(err.stack) : [];
      if (!frames.length && event.filename) {
        frames = [{ filename: event.filename, function: '<anonymous>', lineno: event.lineno || 1, colno: event.colno || 1 }];
      }
      reportBugsink(type, msg, frames);
    });
    window.addEventListener('unhandledrejection', function (event) {
      var reason = event && event.reason;
      var type = (reason && reason.name) || 'UnhandledRejection';
      var msg = (reason && reason.message) || String(reason || 'Nieobsłużona obietnica Promise');
      var frames = reason && reason.stack ? parseStack(reason.stack) : [];
      reportBugsink(type, msg, frames);
    });
  }

  window.ui = { toast: toast, confirm: confirmDialog, track: trackPageview, reportError: reportBugsink };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
