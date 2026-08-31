/* ==========================================================================
   EviMesh design book - shared page behaviors (progressive enhancement)
   ==========================================================================
   Everything here is optional: pages render fully without JS except the
   copy affordances and tab switching. No dependencies, no network.
   ========================================================================== */

(function () {
  "use strict";

  /* 1. Copy-to-clipboard for [data-copy] buttons and .idchip__btn.
        Falls back to a hidden textarea when the async clipboard API is
        unavailable (some file:// contexts). */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function flash(btn, ok) {
    var prev = btn.innerHTML;
    var icon = ok
      ? '<svg class="icon icon--sm" aria-hidden="true"><use href="#icon-check"></use></svg>'
      : '<svg class="icon icon--sm" aria-hidden="true"><use href="#icon-x"></use></svg>';
    btn.innerHTML = icon;
    btn.setAttribute("data-copied", ok ? "true" : "false");
    setTimeout(function () {
      btn.innerHTML = prev;
      btn.removeAttribute("data-copied");
    }, 1400);
  }

  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-copy]");
    if (!btn) return;
    event.preventDefault();
    var value = btn.getAttribute("data-copy");
    if (!value) {
      var chip = btn.closest(".idchip");
      value = chip ? chip.getAttribute("data-value") || chip.querySelector(".idchip__value").textContent.trim() : "";
    }
    copyText(value).then(
      function () { flash(btn, true); },
      function () { flash(btn, false); }
    );
  });

  /* 2. Tabs: [data-tabs] container with .tabs__tab[role=tab] and panels
        referenced by aria-controls. Keyboard: arrow keys move focus. */
  document.querySelectorAll("[data-tabs]").forEach(function (container) {
    var tabs = Array.prototype.slice.call(container.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    function select(tab) {
      tabs.forEach(function (t) {
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        var active = t === tab;
        t.setAttribute("aria-selected", active ? "true" : "false");
        t.setAttribute("tabindex", active ? "0" : "-1");
        if (panel) panel.hidden = !active;
      });
      tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.setAttribute("tabindex", tab.getAttribute("aria-selected") === "true" ? "0" : "-1");
      tab.addEventListener("click", function () { select(tab); });
      tab.addEventListener("keydown", function (e) {
        var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        var next = tabs[(i + dir + tabs.length) % tabs.length];
        select(next);
      });
    });

    var first = container.querySelector('[aria-selected="true"]');
    if (!first && tabs[0]) tabs[0].setAttribute("aria-selected", "true");
  });

  /* 3. Dialog close buttons ([data-close-dialog]). */
  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-close-dialog]");
    if (!btn) return;
    var dlg = btn.closest(".scrim");
    if (dlg) dlg.style.display = "none";
    var opener = document.getElementById(btn.getAttribute("data-close-dialog") || "");
    if (opener) opener.focus();
  });

  /* 4. Esc closes the topmost visible scrim (demo affordance). */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var scrims = Array.prototype.slice.call(document.querySelectorAll(".scrim"));
    for (var i = scrims.length - 1; i >= 0; i--) {
      if (scrims[i].style.display !== "none") {
        scrims[i].style.display = "none";
        return;
      }
    }
  });
})();
