(function () {
  "use strict";

  if (window.__engatBrandLoaderV1Installed) return;
  window.__engatBrandLoaderV1Installed = true;

  var TOTAL_DURATION_MS = 3000;
  var PROGRESS_DURATION_MS = 2700;
  var EXIT_DURATION_MS = 180;
  var EXIT_START_MS = TOTAL_DURATION_MS - EXIT_DURATION_MS;
  var AUTH_READY_EVENT = "engat:auth-ready";

  function mountBrandLoader() {
    if (!document.body || document.getElementById("engat-brand-loader")) return;

    var host = document.createElement("div");
    host.id = "engat-brand-loader";
    host.setAttribute("role", "status");
    host.setAttribute("aria-label", "Memuatkan e-NGAT");
    host.setAttribute("aria-busy", "true");
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:block;visibility:visible!important;overflow:hidden;touch-action:none;overscroll-behavior:none;";

    var shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML =
      '<style>' +
      ":host{all:initial;position:fixed;inset:0;z-index:2147483647;display:block;visibility:visible!important;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:#123b37}" +
      "*,*::before,*::after{box-sizing:border-box}" +
      ".screen{position:absolute;inset:0;display:grid;place-items:center;min-width:0;min-height:100%;overflow:hidden;padding:max(24px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));background:radial-gradient(circle at 50% 40%,rgba(28,142,132,.18) 0,rgba(28,142,132,.07) 29%,transparent 54%),linear-gradient(155deg,#fffdf8 0%,#f1f8f6 48%,#e7f2ef 100%);opacity:1;transition:opacity " +
      EXIT_DURATION_MS +
      "ms cubic-bezier(.4,0,1,1);touch-action:none;overscroll-behavior:contain}" +
      ".screen::before,.screen::after{content:\"\";position:absolute;border-radius:50%;pointer-events:none;filter:blur(2px)}" +
      ".screen::before{width:min(82vw,720px);aspect-ratio:1;top:-42%;right:-25%;border:1px solid rgba(28,142,132,.16)}" +
      ".screen::after{width:min(72vw,620px);aspect-ratio:1;bottom:-45%;left:-24%;border:1px solid rgba(28,142,132,.12)}" +
      ".content{position:relative;z-index:1;display:grid;justify-items:center;gap:clamp(18px,3.5vmin,28px);width:min(100%,520px);transform:translateY(-1.5vh)}" +
      ".mark{position:relative;width:clamp(220px,64vmin,360px);aspect-ratio:1;filter:drop-shadow(0 24px 36px rgba(9,64,58,.13))}" +
      ".portrait{position:absolute;left:50%;top:50%;width:132%;height:auto;max-width:none;transform:translate(-50%,-49.5%) scale(.975);transform-origin:center;animation:engatLogoArrive 900ms cubic-bezier(.2,.8,.2,1) both;pointer-events:none;user-select:none;-webkit-user-drag:none}" +
      ".ring{position:absolute;inset:0;width:100%;height:100%;overflow:visible;transform:rotate(-90deg);filter:drop-shadow(0 5px 8px rgba(17,119,111,.16))}" +
      ".track,.progress{fill:none;vector-effect:non-scaling-stroke}" +
      ".track{stroke:rgba(26,116,109,.14);stroke-width:1.8}" +
      ".progress{stroke:url(#engatProgressGradient);stroke-width:2.6;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100}" +
      ".pulse{position:absolute;inset:3.4%;border-radius:50%;border:1px solid rgba(255,255,255,.72);box-shadow:inset 0 0 0 1px rgba(22,126,118,.08);pointer-events:none}" +
      ".readout{display:grid;justify-items:center;gap:5px;min-height:62px}" +
      ".percentage{font-size:clamp(25px,6vmin,34px);font-weight:800;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.04em;color:#0e615b;text-shadow:0 1px 0 rgba(255,255,255,.8)}" +
      ".label{font-size:11px;font-weight:800;line-height:1.2;letter-spacing:.2em;text-transform:uppercase;color:#55736f}" +
      ":host(.is-exiting) .screen{opacity:0}" +
      ":host(.is-exiting) .content{transform:translateY(-1.5vh) scale(.985);transition:transform " +
      EXIT_DURATION_MS +
      "ms ease}" +
      "@keyframes engatLogoArrive{from{opacity:0;transform:translate(-50%,-49.5%) scale(.92)}to{opacity:1;transform:translate(-50%,-49.5%) scale(.975)}}" +
      "@media(max-width:360px){.screen{padding-left:14px;padding-right:14px}.mark{width:min(68vmin,220px)}.content{gap:16px}.label{letter-spacing:.15em}}" +
      "@media(max-height:520px) and (orientation:landscape){.content{grid-template-columns:auto minmax(92px,auto);align-items:center;gap:24px;transform:none}.mark{width:min(70vh,300px)}.readout{align-content:center}.screen{padding-top:12px;padding-bottom:12px}}" +
      "@media(prefers-reduced-motion:reduce){.portrait{animation:none}.screen,.content{transition:none}:host(.is-exiting) .screen{opacity:1}:host(.is-exiting) .content{transform:translateY(-1.5vh)}}" +
      "</style>" +
      '<div class="screen">' +
      '<div class="content">' +
      '<div class="mark" aria-hidden="true">' +
      '<img class="portrait" src="./logo-loading-transparent.png?v=20260729-brand-loader-v2" alt="" draggable="false">' +
      '<span class="pulse"></span>' +
      '<svg class="ring" viewBox="0 0 100 100" aria-hidden="true">' +
      "<defs>" +
      '<linearGradient id="engatProgressGradient" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#62c8bd"></stop>' +
      '<stop offset="52%" stop-color="#168f86"></stop>' +
      '<stop offset="100%" stop-color="#075f59"></stop>' +
      "</linearGradient>" +
      "</defs>" +
      '<circle class="track" cx="50" cy="50" r="48" pathLength="100"></circle>' +
      '<circle class="progress" cx="50" cy="50" r="48" pathLength="100"></circle>' +
      "</svg>" +
      "</div>" +
      '<div class="readout">' +
      '<span class="percentage">0%</span>' +
      '<span class="label">Memuatkan e-NGAT</span>' +
      "</div>" +
      "</div>" +
      "</div>";

    var root = document.documentElement;
    var previousRootOverflow = root.style.overflow;
    var previousBodyOverflow = document.body.style.overflow;
    root.classList.add("engat-brand-loading");
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.appendChild(host);

    var progressCircle = shadow.querySelector(".progress");
    var percentage = shadow.querySelector(".percentage");
    var startedAt = performance.now();
    var animationFrame = 0;
    var exitTimer = 0;
    var removeTimer = 0;
    var lastPercentage = -1;
    var completed = false;
    var exitStarted = false;
    var authReady = window.__engatAuthReady === true;

    function updateProgress(value) {
      var bounded = Math.max(0, Math.min(100, value));
      var rounded = Math.round(bounded);
      progressCircle.style.strokeDashoffset = String(100 - bounded);
      if (rounded !== lastPercentage) {
        lastPercentage = rounded;
        percentage.textContent = rounded + "%";
      }
    }

    function animate(now) {
      if (completed) return;
      var elapsed = now - startedAt;
      updateProgress((elapsed / PROGRESS_DURATION_MS) * 100);
      if (elapsed < PROGRESS_DURATION_MS) {
        animationFrame = window.requestAnimationFrame(animate);
      } else {
        updateProgress(100);
      }
    }

    function beginExit() {
      if (completed || exitStarted || !authReady) return;
      var elapsed = performance.now() - startedAt;
      if (elapsed < EXIT_START_MS) return;
      exitStarted = true;
      updateProgress(100);
      host.classList.add("is-exiting");
      removeTimer = window.setTimeout(
        removeLoader,
        Math.max(EXIT_DURATION_MS, TOTAL_DURATION_MS - elapsed)
      );
    }

    function markAuthReady() {
      authReady = true;
      beginExit();
    }

    function removeLoader() {
      if (completed) return;
      completed = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
      window.removeEventListener(AUTH_READY_EVENT, markAuthReady);
      updateProgress(100);
      root.classList.remove("engat-brand-loading");
      if (root.style.overflow === "hidden") {
        root.style.overflow = previousRootOverflow;
      }
      if (document.body.style.overflow === "hidden") {
        document.body.style.overflow = previousBodyOverflow;
      }
      host.setAttribute("aria-busy", "false");
      host.remove();
      window.dispatchEvent(
        new CustomEvent("engat:brand-loader-complete", {
          detail: { duration: TOTAL_DURATION_MS },
        })
      );
    }

    updateProgress(0);
    window.addEventListener(AUTH_READY_EVENT, markAuthReady, { once: true });
    animationFrame = window.requestAnimationFrame(animate);
    exitTimer = window.setTimeout(beginExit, EXIT_START_MS);
  }

  function scheduleMount() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(mountBrandLoader);
    });
  }

  if (document.readyState === "complete") {
    scheduleMount();
  } else {
    window.addEventListener("load", scheduleMount, { once: true });
  }
})();
