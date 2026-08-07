(function () {
  "use strict";

  function buttonByText(text) {
    return Array.prototype.find.call(document.querySelectorAll("button"), function (button) {
      return (button.textContent || "").trim().indexOf(text) !== -1;
    });
  }

  function centerSemesterButtons() {
    var pdf = buttonByText("Download PDF RPP Semester");
    var excel = buttonByText("Download Excel RPP Semester");
    if (!pdf || !excel || pdf.parentElement !== excel.parentElement) return;

    var bar = pdf.parentElement;
    var documentCode = Array.prototype.find.call(bar.children, function (child) {
      return (child.textContent || "").indexOf("LAM-PT-03-01") !== -1;
    });
    bar.style.display = "flex";
    bar.style.alignItems = "center";
    bar.style.justifyContent = "center";
    bar.style.gap = "12px";
    bar.style.position = "relative";
    bar.style.flexWrap = "wrap";

    if (documentCode) {
      if (window.innerWidth >= 900) {
        documentCode.style.position = "absolute";
        documentCode.style.right = "0";
        documentCode.style.top = "50%";
        documentCode.style.transform = "translateY(-50%)";
        documentCode.style.width = "auto";
      } else {
        documentCode.style.position = "static";
        documentCode.style.transform = "none";
        documentCode.style.width = "100%";
        documentCode.style.textAlign = "center";
      }
    }
  }

  function centerWeeklyButtons() {
    var pdf = buttonByText("Download PDF RPP Mingguan");
    var excel = buttonByText("Download Excel RPP Mingguan");
    if (!pdf || !excel || pdf.parentElement !== excel.parentElement) return;
    var bar = pdf.parentElement;
    bar.style.display = "flex";
    bar.style.alignItems = "center";
    bar.style.justifyContent = "center";
    bar.style.gap = "12px";
    bar.style.flexWrap = "wrap";
    bar.style.width = "100%";
  }

  function applyLayout() {
    centerSemesterButtons();
    centerWeeklyButtons();
  }

  window.addEventListener("resize", applyLayout);
  window.setTimeout(applyLayout, 800);
  new MutationObserver(applyLayout).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
