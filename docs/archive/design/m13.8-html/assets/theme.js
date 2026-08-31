/* ==========================================================================
   EviMesh theme switching (system default + manual override + persistence)
   ==========================================================================
   Contract:
     - <html data-theme="auto|light|dark">, default "auto"
     - "auto"  -> follows prefers-color-scheme (tokens.css media query)
     - "light" / "dark" -> forced via attribute selectors in tokens.css
     - choice persisted to localStorage under KEY
   No-flash rule: the attribute must exist BEFORE first paint. Put this
   inline snippet in <head>, before any stylesheet (do not defer it):

     <script>
       (function () {
         try {
           var t = localStorage.getItem("evimesh-theme") || "auto";
           if (t !== "light" && t !== "dark") t = "auto";
           document.documentElement.setAttribute("data-theme", t);
         } catch (e) {
           document.documentElement.setAttribute("data-theme", "auto");
         }
       })();
     </script>

   Then load this file (defer is fine) to wire the toggle buttons.
   ========================================================================== */

(function () {
  "use strict";

  var KEY = "evimesh-theme";
  var root = document.documentElement;

  function stored() {
    try {
      var t = localStorage.getItem(KEY);
      return t === "light" || t === "dark" ? t : "auto";
    } catch (e) {
      return "auto";
    }
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    try {
      if (theme === "auto") {
        localStorage.removeItem(KEY);
      } else {
        localStorage.setItem(KEY, theme);
      }
    } catch (e) {
      /* storage unavailable: session-only preference */
    }
    syncButtons();
  }

  function systemDark() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }

  /* Effective (resolved) theme, for aria-pressed and icons. */
  function effective() {
    var t = root.getAttribute("data-theme") || "auto";
    if (t === "auto") return systemDark() ? "dark" : "light";
    return t;
  }

  function syncButtons() {
    var current = root.getAttribute("data-theme") || "auto";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      var mode = btn.getAttribute("data-theme-toggle"); // auto|light|dark|cycle
      if (mode === "cycle") {
        var eff = effective();
        btn.setAttribute("aria-label", eff === "dark" ? "切换到亮色主题" : "切换到暗色主题");
        btn.querySelectorAll("[data-theme-icon]").forEach(function (ic) {
          ic.style.display = ic.getAttribute("data-theme-icon") === eff ? "" : "none";
        });
        return;
      }
      var active = current === mode;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function init() {
    // Attribute already set by the inline no-flash snippet; normalize.
    var current = root.getAttribute("data-theme");
    if (current !== "light" && current !== "dark") {
      root.setAttribute("data-theme", "auto");
    }

    document.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-theme-toggle]");
      if (!btn) return;
      var mode = btn.getAttribute("data-theme-toggle");
      if (mode === "cycle") {
        apply(effective() === "dark" ? "light" : "dark");
      } else if (mode === "auto" || mode === "light" || mode === "dark") {
        apply(mode);
      }
    });

    // Keep "auto" pages in sync when the OS preference changes.
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if ((root.getAttribute("data-theme") || "auto") === "auto") syncButtons();
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    syncButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
