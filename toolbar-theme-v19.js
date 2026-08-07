(function () {
  "use strict";

  function installTheme() {
    if (document.getElementById("engat-toolbar-theme-v19")) return;
    var style = document.createElement("style");
    style.id = "engat-toolbar-theme-v19";
    style.textContent =
      ".engat-upload-survey-wrap{align-items:stretch!important}" +
      ".engat-upload-survey-wrap>*{box-sizing:border-box!important;width:100%!important;height:5rem!important;min-height:5rem!important;padding:.85rem!important;border-radius:16px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:.55rem!important;overflow:hidden!important;font-size:.84rem!important;font-weight:780!important;line-height:1.15!important;white-space:nowrap!important;text-align:center!important}" +
      ".engat-upload-survey-wrap>* span,.engat-upload-survey-wrap>* strong{white-space:nowrap!important}" +
      ".engat-upload-survey-wrap>.engat-link-mk{order:1!important;border:1px solid #93c5fd!important;background:linear-gradient(145deg,#eff6ff,#dbeafe)!important;color:#1d4ed8!important}" +
      ".engat-upload-survey-wrap>label{order:2!important;border:1px solid #86efac!important;background:linear-gradient(145deg,#f0fdf4,#dcfce7)!important;color:#047857!important}" +
      ".engat-upload-survey-wrap>label *{color:inherit!important}" +
      ".engat-upload-survey-wrap>.engat-survey-link{order:3!important;border:1px solid #c4b5fd!important;background:linear-gradient(145deg,#f5f3ff,#ede9fe)!important;color:#6d28d9!important}" +
      ".engat-upload-survey-wrap>.engat-report-button{order:4!important;border:1px solid #fda4af!important;background:linear-gradient(145deg,#fff1f2,#ffe4e6)!important;color:#be123c!important}" +
      ".engat-upload-survey-wrap>[data-engat-header-logout]{order:5!important}" +
      ".engat-upload-survey-wrap>*.engat-link-mk:hover{border-color:#2563eb!important;box-shadow:0 18px 36px rgba(37,99,235,.16)!important}" +
      ".engat-upload-survey-wrap>label:hover{border-color:#16a34a!important;box-shadow:0 18px 36px rgba(22,163,74,.15)!important}" +
      ".engat-upload-survey-wrap>.engat-survey-link:hover{border-color:#7c3aed!important;box-shadow:0 18px 36px rgba(124,58,237,.15)!important}" +
      ".engat-upload-survey-wrap>.engat-report-button:hover{border-color:#e11d48!important;box-shadow:0 18px 36px rgba(225,29,72,.15)!important}" +
      "@media(min-width:1180px){" +
      ".engat-upload-survey-wrap{grid-template-columns:repeat(5,minmax(0,1fr))!important;max-width:1320px!important}" +
      ".engat-upload-survey-wrap>label{padding-left:.65rem!important;padding-right:.65rem!important;justify-content:center!important}" +
      ".engat-upload-survey-wrap>label>.flex{display:flex!important;flex:0 1 auto!important;min-width:0!important;align-items:center!important;justify-content:center!important;gap:.55rem!important}" +
      ".engat-upload-survey-wrap>label>.flex>.min-w-0{min-width:0!important;overflow:visible!important}" +
      ".engat-upload-survey-wrap>label .text-sm{font-size:.84rem!important;line-height:1.15!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important}" +
      ".engat-upload-survey-wrap>label .text-xs{display:block!important;margin-top:.18rem!important;font-size:.62rem!important;line-height:1!important;font-weight:600!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important}" +
      ".engat-upload-survey-wrap>label>svg{display:none!important}" +
      ".engat-upload-survey-wrap>label>.flex svg{display:block!important;width:18px!important;height:18px!important;flex:0 0 auto!important}" +
      ".engat-upload-survey-wrap>label>.flex>.h-10{width:36px!important;height:36px!important;flex:0 0 36px!important}" +
      "}" +
      "@media(max-width:1179px){.engat-upload-survey-wrap>*{height:auto!important;min-height:5rem!important;font-size:.9rem!important}}";
    document.head.appendChild(style);
  }

  function normalizeOrder() {
    var wrapper = document.querySelector(".engat-upload-survey-wrap");
    if (!wrapper) return;
    var report = wrapper.querySelector('[data-engat-report="true"]');
    var logout = wrapper.querySelector('[data-engat-header-logout="true"]');
    if (report && logout && report.nextElementSibling !== logout) {
      report.insertAdjacentElement("afterend", logout);
    }
  }

  function normalizeUploadLabel() {
    var upload = document.querySelector(".engat-upload-survey-wrap>label");
    if (!upload) return;
    var title = upload.querySelector(".text-sm");
    var formats = upload.querySelector(".text-xs");
    if (title && title.textContent !== "UPLOAD") title.textContent = "UPLOAD";
    if (formats && formats.textContent !== ".xlsx, .xls, .xlsm, .csv") {
      formats.textContent = ".xlsx, .xls, .xlsm, .csv";
    }
  }

  function refresh() {
    installTheme();
    normalizeOrder();
    normalizeUploadLabel();
  }

  refresh();
  window.setTimeout(refresh, 900);
  new MutationObserver(refresh).observe(document.documentElement, { childList:true, subtree:true });
})();
