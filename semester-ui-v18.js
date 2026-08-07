(function () {
  "use strict";

  var defaultsStarted = false;
  var DEFAULT_TIMETABLE = [
    { day: "Isnin", time: "08:00", duration: "2" },
    { day: "Selasa", time: "08:00", duration: "1" }
  ];

  function cleanText(element) {
    return (element && element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function headingByText(label) {
    return Array.from(document.querySelectorAll("h2,h3,h4")).find(function (heading) {
      return cleanText(heading) === label;
    });
  }

  function timetableSection() {
    var heading = headingByText("Jadual Waktu");
    if (!heading) return null;
    var section = heading.parentElement;
    while (section && section !== document.body) {
      var labels = Array.from(section.querySelectorAll("button")).map(cleanText).join(" ");
      if (labels.indexOf("Kelas") !== -1 && labels.indexOf("Jana Rancangan Semester") !== -1) return section;
      section = section.parentElement;
    }
    return null;
  }

  function inputValue(input, value) {
    if (!input) return;
    var prototype = input.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function slotRow(select, section) {
    var row = select.parentElement;
    while (row && row !== section) {
      if (row.querySelectorAll("select").length === 1 &&
          row.querySelectorAll('input[type="time"]').length === 1 &&
          row.querySelectorAll('input[type="number"]').length === 1) return row;
      row = row.parentElement;
    }
    return select.parentElement;
  }

  function setDefaultRows(section) {
    var selects = Array.from(section.querySelectorAll("select"));
    if (selects.length < 2) return false;
    DEFAULT_TIMETABLE.forEach(function (item, index) {
      var select = selects[index];
      var row = slotRow(select, section);
      var option = Array.from(select.options).find(function (candidate) {
        return cleanText(candidate) === item.day;
      });
      inputValue(select, option ? option.value : item.day);
      inputValue(row.querySelector('input[type="time"]'), item.time);
      inputValue(row.querySelector('input[type="number"]'), item.duration);
    });
    return true;
  }

  function installDefaultTimetable() {
    if (defaultsStarted) return;
    var section = timetableSection();
    if (!section) return;
    var existing = section.querySelectorAll("select");
    if (existing.length >= 2) {
      defaultsStarted = true;
      setDefaultRows(section);
      return;
    }
    var addButton = Array.from(section.querySelectorAll("button")).find(function (button) {
      return cleanText(button).indexOf("Kelas") !== -1;
    });
    if (!addButton) return;
    defaultsStarted = true;
    if (existing.length === 0) addButton.click();
    window.setTimeout(function () {
      if (section.querySelectorAll("select").length < 2) addButton.click();
      window.setTimeout(function () { setDefaultRows(section); }, 140);
    }, 140);
  }

  function directFieldWrapper(input, row) {
    var node = input.closest("label") || input.parentElement;
    while (node.parentElement && node.parentElement !== row &&
           node.parentElement.querySelectorAll("input").length === 1) {
      node = node.parentElement;
    }
    return node;
  }

  function arrangeBreakRows(section) {
    Array.from(section.querySelectorAll('input[type="date"]')).forEach(function (firstDate) {
      var row = firstDate.parentElement;
      while (row && row !== section) {
        if (row.querySelectorAll('input[type="date"]').length === 2 &&
            row.querySelectorAll("input").length >= 3 &&
            row.querySelector("button")) break;
        row = row.parentElement;
      }
      if (!row || row === section) return;
      var dates = row.querySelectorAll('input[type="date"]');
      var nameInput = Array.from(row.querySelectorAll("input")).find(function (input) {
        return input.type !== "date";
      });
      if (!nameInput) return;
      row.classList.add("engat-break-row-v18", "engat-break-row-v21");
      row.style.setProperty("display", "grid", "important");
      row.style.setProperty("gap", "10px", "important");
      var startWrapper = directFieldWrapper(dates[0], row);
      var endWrapper = directFieldWrapper(dates[1], row);
      var nameWrapper = directFieldWrapper(nameInput, row);
      startWrapper.classList.add("engat-break-start-v18", "engat-break-start-v21");
      endWrapper.classList.add("engat-break-end-v18", "engat-break-end-v21");
      nameWrapper.classList.add("engat-break-name-v18", "engat-break-name-v21");
      var compact = window.innerWidth <= 560;
      row.style.setProperty("grid-template-columns", compact ?
        "minmax(0, 1fr) 44px" :
        "minmax(0, 1fr) minmax(0, 1fr) 46px", "important");
      startWrapper.style.setProperty("grid-column", "1", "important");
      startWrapper.style.setProperty("grid-row", "1", "important");
      endWrapper.style.setProperty("grid-column", compact ? "1" : "2", "important");
      endWrapper.style.setProperty("grid-row", compact ? "2" : "1", "important");
      nameWrapper.style.setProperty("grid-column", compact ? "1" : "1 / 3", "important");
      nameWrapper.style.setProperty("grid-row", compact ? "3" : "2", "important");
      nameWrapper.style.setProperty("width", "100%", "important");
      nameInput.style.setProperty("width", "100%", "important");
      var deleteButton = Array.from(row.querySelectorAll("button")).find(function (button) {
        return button.querySelector("svg") || /padam|buang/i.test(cleanText(button));
      });
      if (deleteButton) {
        var deleteWrapper = deleteButton.parentElement === row ? deleteButton : deleteButton.parentElement;
        deleteWrapper.classList.add("engat-break-delete-v18", "engat-break-delete-v21");
        deleteWrapper.style.setProperty("grid-column", compact ? "2" : "3", "important");
        deleteWrapper.style.setProperty("grid-row", compact ? "3" : "2", "important");
      }
    });
  }

  function updateBreakSection() {
    var heading = headingByText("Cuti Semester") || headingByText("Cuti / Peristiwa / Program");
    if (!heading) return;
    heading.textContent = "Cuti / Peristiwa / Program";
    var section = heading.parentElement;
    while (section && section !== document.body) {
      if (section.querySelectorAll('input[type="date"]').length) break;
      section = section.parentElement;
    }
    if (!section || section === document.body) return;
    var note = Array.from(section.querySelectorAll("p")).find(function (paragraph) {
      return cleanText(paragraph).indexOf("Opsyenal") !== -1;
    });
    if (note) note.textContent = "Opsyenal. Tambah cuti, peristiwa atau program yang menjejaskan jadual pengajaran.";
    arrangeBreakRows(section);
  }

  function installStyles() {
    if (document.getElementById("engat-semester-ui-v21-style")) return;
    var style = document.createElement("style");
    style.id = "engat-semester-ui-v21-style";
    style.textContent =
      ".engat-break-row-v18{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 46px!important;gap:10px!important;align-items:end!important}" +
      ".engat-break-start-v18{grid-column:1;grid-row:1}.engat-break-end-v18{grid-column:2;grid-row:1}" +
      ".engat-break-name-v18{grid-column:1/3;grid-row:2;min-width:0!important;width:100%!important}" +
      ".engat-break-name-v18 input{width:100%!important;min-width:0!important}" +
      ".engat-break-delete-v18{grid-column:3;grid-row:2;align-self:end}" +
      "@media(max-width:560px){.engat-break-row-v18{grid-template-columns:minmax(0,1fr) 44px!important}.engat-break-start-v18,.engat-break-end-v18,.engat-break-name-v18{grid-column:1!important}.engat-break-start-v18{grid-row:1!important}.engat-break-end-v18{grid-row:2!important}.engat-break-name-v18{grid-row:3!important}.engat-break-delete-v18{grid-column:2!important;grid-row:3!important}}";
    document.head.appendChild(style);
  }

  function refresh() {
    updateBreakSection();
    installDefaultTimetable();
  }

  installStyles();
  window.setTimeout(refresh, 800);
  window.setTimeout(refresh, 1600);
  window.addEventListener("resize", refresh);
  new MutationObserver(function () {
    window.clearTimeout(refresh.timer);
    refresh.timer = window.setTimeout(refresh, 80);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
