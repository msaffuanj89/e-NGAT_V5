(function () {
  "use strict";

  var DEFAULT_MK_LINK =
    "https://docs.google.com/spreadsheets/d/1z-K1R4keODvwQN_dNHDHXfarGUtSpWUn/edit?usp=sharing&ouid=115307088907438587130&rtpof=true&sd=true";

  function addLayoutStyles() {
    if (document.getElementById("engat-link-mk-style")) return;
    var style = document.createElement("style");
    style.id = "engat-link-mk-style";
    style.textContent =
      ".engat-upload-survey-wrap{width:100%;max-width:1180px;margin-left:auto;display:grid!important;gap:12px!important}" +
      ".engat-link-mk{display:inline-flex;align-items:center;justify-content:center;gap:.65rem;width:100%;height:100%;min-height:5rem;border:1px solid #d7e1dc;border-radius:16px;background:linear-gradient(145deg,#fff,#f8fbf9);color:#173f35;padding:1rem;font-weight:750;font-size:.9rem;cursor:pointer;white-space:nowrap;box-shadow:0 12px 30px rgba(15,23,42,.07);transition:.2s ease}" +
      ".engat-link-mk:hover{border-color:#059669;transform:translateY(-2px);box-shadow:0 18px 36px rgba(15,23,42,.11)}.engat-link-mk:disabled{cursor:wait;opacity:.7}" +
      ".engat-upload-survey-wrap>*{width:100%!important;min-width:0;height:100%;min-height:5rem!important;border-radius:16px!important;font-size:.9rem!important;box-shadow:0 12px 30px rgba(15,23,42,.07)!important;transition:.2s ease!important}" +
      ".engat-upload-survey-wrap>label{border:1px solid #b9ddcc!important;background:linear-gradient(145deg,#f5fcf8,#eaf8f1)!important}.engat-upload-survey-wrap>.engat-survey-link{border:1px solid #d7e1dc!important;background:linear-gradient(145deg,#fff,#fafbf9)!important;color:#243a34!important}.engat-upload-survey-wrap>*:hover{transform:translateY(-2px)}" +
      "@media (min-width:768px){.engat-upload-survey-wrap{grid-template-columns:repeat(2,minmax(0,1fr))!important}}" +
      "@media (min-width:1180px){.engat-upload-survey-wrap{grid-template-columns:repeat(5,minmax(0,1fr))!important}}";
    document.head.appendChild(style);
  }

  function googleSheetId(url) {
    var match = String(url || "").match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : "";
  }

  function fileNameFromHeader(header) {
    var encoded = String(header || "").match(/filename\*=UTF-8''([^;]+)/i);
    if (encoded) {
      try {
        return decodeURIComponent(encoded[1]);
      } catch (_) {}
    }
    var plain = String(header || "").match(/filename="?([^";]+)"?/i);
    return plain ? plain[1] : "MK-daripada-Google-Sheets.xlsx";
  }

  async function loadGoogleSheet(button) {
    var entered = window.prompt("Masukkan pautan Google Sheets untuk MK:", DEFAULT_MK_LINK);
    if (!entered) return;

    var id = googleSheetId(entered);
    if (!id) {
      window.alert("Pautan tidak sah. Gunakan pautan Google Sheets yang mengandungi /spreadsheets/d/.");
      return;
    }

    var input = document.querySelector('input[type="file"][accept*=".xlsx"]');
    if (!input) {
      window.alert("Ruangan Upload File Excel belum tersedia. Sila muat semula halaman.");
      return;
    }

    var originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Membaca MK...";

    try {
      var response = await fetch(
        "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(id) + "/export?format=xlsx"
      );
      if (!response.ok) throw new Error("Google memulangkan status " + response.status);

      var blob = await response.blob();
      var name = fileNameFromHeader(response.headers.get("content-disposition"));
      var file = new File([blob], name, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      var transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      button.textContent = "MK dimuat";
      window.setTimeout(function () {
        button.textContent = originalText;
      }, 1800);
    } catch (error) {
      button.textContent = originalText;
      window.alert(
        "Fail MK tidak dapat dibaca. Pastikan pautan boleh diakses oleh sesiapa yang mempunyai pautan. " +
          (error && error.message ? error.message : "")
      );
    } finally {
      button.disabled = false;
    }
  }

  function addLinkButton() {
    var wrapper = document.querySelector(".engat-upload-survey-wrap");
    if (!wrapper || wrapper.querySelector("[data-engat-link-mk]")) return false;

    addLayoutStyles();
    var button = document.createElement("button");
    button.type = "button";
    button.className = "engat-link-mk";
    button.setAttribute("data-engat-link-mk", "true");
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg><span>Link MK</span>';
    button.addEventListener("click", function () {
      loadGoogleSheet(button);
    });
    wrapper.insertBefore(button, wrapper.firstChild);
    return true;
  }

  function widenNonFaceToFaceColumn() {
    var tables = Array.prototype.slice.call(document.querySelectorAll("table"));
    var table = tables.find(function (candidate) {
      return candidate.textContent.indexOf("TIDAK BERSEMUKA") !== -1;
    });
    if (!table || table.querySelector('colgroup[data-engat-rpp-widths]')) return;

    var widths = [70, 120, 66, 66, 66, 66, 66, 44, 44, 44, 44, 44, 44, 44, 44, 132, 240];
    var colgroup = document.createElement("colgroup");
    colgroup.setAttribute("data-engat-rpp-widths", "true");
    widths.forEach(function (width) {
      var col = document.createElement("col");
      col.style.width = width + "px";
      colgroup.appendChild(col);
    });
    table.insertBefore(colgroup, table.firstChild);
    table.style.width = "1288px";
    table.style.minWidth = "1288px";
  }

  function enhance() {
    addLinkButton();
    widenNonFaceToFaceColumn();
  }

  window.setTimeout(enhance, 1250);
  new MutationObserver(enhance).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
