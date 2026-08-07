(function () {
  "use strict";

  var DAYS = {
    Ahad: 0,
    Isnin: 1,
    Selasa: 2,
    Rabu: 3,
    Khamis: 4,
    Jumaat: 5,
    Sabtu: 6
  };
  var busy = false;

  function text(el) {
    return (el && el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function findTimetableSection() {
    var headings = Array.from(document.querySelectorAll("h2,h3,h4"));
    var heading = headings.find(function (el) {
      return text(el) === "Jadual Waktu";
    });
    if (!heading) return null;
    var section = heading.parentElement;
    while (section && section !== document.body) {
      if (section.querySelector("select") && section.querySelector('input[type="time"]')) return section;
      section = section.parentElement;
    }
    return null;
  }

  function smallestSlotRow(select, section) {
    var node = select.parentElement;
    while (node && node !== section) {
      if (
        node.querySelectorAll("select").length === 1 &&
        node.querySelectorAll('input[type="time"]').length === 1 &&
        node.querySelectorAll('input[type="number"]').length === 1
      ) return node;
      node = node.parentElement;
    }
    return select.parentElement;
  }

  function parseTime(value) {
    var parts = String(value || "").split(":");
    if (parts.length < 2) return NaN;
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function timeLabel(minutes) {
    var h = Math.floor(minutes / 60) % 24;
    var m = minutes % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function collectSlots(section) {
    return Array.from(section.querySelectorAll("select")).filter(function (select) {
      return !select.closest(".engat-class-manager-v27");
    }).map(function (select, index) {
      var row = smallestSlotRow(select, section);
      var timeInput = row && row.querySelector('input[type="time"]');
      var durationInput = row && row.querySelector('input[type="number"]');
      var option = select.options && select.options[select.selectedIndex];
      var dayName = option ? text(option) : text(select);
      var start = parseTime(timeInput && timeInput.value);
      var duration = Number(durationInput && durationInput.value);
      return {
        index: index,
        row: row,
        dayName: dayName,
        day: Object.prototype.hasOwnProperty.call(DAYS, dayName) ? DAYS[dayName] : Number(select.value),
        start: start,
        end: start + duration * 60,
        duration: duration
      };
    }).filter(function (slot) {
      return Number.isFinite(slot.day) && Number.isFinite(slot.start) &&
        Number.isFinite(slot.duration) && slot.duration > 0;
    });
  }

  function findDateInput(labelText) {
    var candidates = Array.from(document.querySelectorAll("label"));
    var label = candidates.find(function (el) {
      return text(el).toLowerCase().indexOf(labelText.toLowerCase()) !== -1;
    });
    if (label) {
      var input = label.querySelector('input[type="date"]');
      if (input) return input;
      if (label.parentElement) return label.parentElement.querySelector('input[type="date"]');
    }
    return null;
  }

  function parseLocalDate(value) {
    var p = String(value || "").split("-").map(Number);
    return p.length === 3 && p.every(Number.isFinite) ? new Date(p[0], p[1] - 1, p[2]) : null;
  }

  function formatDate(date) {
    return String(date.getDate()).padStart(2, "0") + "/" +
      String(date.getMonth() + 1).padStart(2, "0") + "/" + date.getFullYear();
  }

  function ensurePanel(section, id, className) {
    var panel = section.querySelector("#" + id);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = id;
      panel.className = className;
      var button = Array.from(section.querySelectorAll("button")).find(function (el) {
        return text(el).indexOf("Jana Rancangan Semester") !== -1;
      });
      (button && button.parentElement ? button.parentElement : section).insertBefore(
        panel,
        button || null
      );
    }
    return panel;
  }

  function updatePanel(panel, hidden, html) {
    if (panel.hidden !== hidden) panel.hidden = hidden;
    if (panel.innerHTML !== html) panel.innerHTML = html;
  }

  function update() {
    if (busy) return;
    busy = true;
    try {
      var section = findTimetableSection();
      if (!section) return;
      var slots = collectSlots(section);
      var managerActive = !!section.querySelector(".engat-class-manager-v27");
      slots.forEach(function (slot) {
        if (slot.row) slot.row.classList.remove("engat-slot-conflict");
      });

      var conflicts = [];
      if (!managerActive) {
        for (var i = 0; i < slots.length; i += 1) {
          for (var j = i + 1; j < slots.length; j += 1) {
            var a = slots[i], b = slots[j];
            if (a.day === b.day && a.start < b.end && b.start < a.end) {
              conflicts.push([a, b]);
              if (a.row) a.row.classList.add("engat-slot-conflict");
              if (b.row) b.row.classList.add("engat-slot-conflict");
            }
          }
        }
      }

      var conflictPanel = ensurePanel(section, "engat-timetable-conflict", "engat-timetable-message engat-error");
      if (managerActive) {
        updatePanel(conflictPanel, true, "");
      } else if (!slots.length) {
        updatePanel(conflictPanel, false,
          "<strong>Jadual waktu kursus ini belum ditetapkan.</strong><br>" +
          "Tekan “+ Kelas” dan masukkan hari, masa serta jam bagi kursus yang sedang diproses. " +
          "Jadual daripada kursus sebelumnya tidak digunakan supaya agihan tidak bercampur.");
      } else if (conflicts.length) {
        updatePanel(conflictPanel, false, "<strong>Jadual waktu bertindan.</strong><br>" +
          conflicts.map(function (pair) {
            return pair[0].dayName + " " + timeLabel(pair[0].start) + "–" + timeLabel(pair[0].end) +
              " bertindih dengan " + pair[1].dayName + " " + timeLabel(pair[1].start) +
              "–" + timeLabel(pair[1].end) + ".";
          }).join("<br>") +
          "<br>Sila ubah hari, masa atau tempoh jam sebelum menjana rancangan.");
      } else {
        updatePanel(conflictPanel, true, "");
      }

      var generate = Array.from(section.querySelectorAll("button")).find(function (el) {
        return text(el).indexOf("Jana Rancangan Semester") !== -1;
      });
      if (generate) {
        var isBlocked = !managerActive && (!slots.length || conflicts.length > 0);
        generate.dataset.engatHasConflict = isBlocked ? "true" : "false";
        generate.setAttribute("aria-disabled", isBlocked ? "true" : "false");
        if (!managerActive || generate.dataset.engatMultiClassInvalid !== "true") {
          generate.classList.toggle("engat-generate-blocked", isBlocked);
        }
      }

      var infoPanel = ensurePanel(section, "engat-partial-week-info", "engat-timetable-message engat-info");
      if (managerActive) {
        updatePanel(infoPanel, true, "");
        return;
      }
      var startInput = findDateInput("Tarikh mula semester");
      var startDate = parseLocalDate(startInput && startInput.value);
      if (!startDate || !slots.length) {
        updatePanel(infoPanel, true, "");
        return;
      }
      var weeklyTotal = slots.reduce(function (sum, slot) { return sum + slot.duration; }, 0);
      var firstWeekTotal = 0;
      var excluded = [];
      slots.forEach(function (slot) {
        var delta = slot.day - startDate.getDay();
        var occurrence = new Date(startDate);
        occurrence.setDate(startDate.getDate() + delta);
        if (delta >= 0) firstWeekTotal += slot.duration;
        else excluded.push({ slot: slot, date: occurrence });
      });
      if (excluded.length && firstWeekTotal < weeklyTotal) {
        updatePanel(infoPanel, false,
          "<strong>Semakan W1: " + firstWeekTotal + " jam daripada " + weeklyTotal + " jam mingguan.</strong><br>" +
          "Semester bermula " + formatDate(startDate) + ". " +
          excluded.map(function (item) {
            return "Slot " + item.slot.dayName + " " + item.slot.duration + " jam jatuh pada " +
              formatDate(item.date);
          }).join("; ") +
          " dan berada sebelum tarikh mula semester, jadi tidak dimasukkan dalam W1.");
      } else {
        updatePanel(infoPanel, false, "<strong>Jumlah jadual mingguan: " + weeklyTotal +
          " jam.</strong> Semua slot minggu pertama berada dalam julat semester.");
      }
    } finally {
      busy = false;
    }
  }

  function installStyles() {
    if (document.getElementById("engat-timetable-validation-style")) return;
    var style = document.createElement("style");
    style.id = "engat-timetable-validation-style";
    style.textContent =
      ".engat-timetable-message{margin:10px 0;padding:11px 12px;border-radius:10px;font-size:13px;line-height:1.45}" +
      ".engat-timetable-message.engat-error{border:1px solid #fca5a5;background:#fff1f2;color:#9f1239}" +
      ".engat-timetable-message.engat-info{border:1px solid #99f6e4;background:#f0fdfa;color:#115e59}" +
      ".engat-slot-conflict{outline:2px solid #e11d48!important;outline-offset:2px;border-radius:8px;background:#fff1f2!important}" +
      ".engat-generate-blocked{opacity:.55!important;cursor:not-allowed!important}";
    document.head.appendChild(style);
  }

  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest("button");
    if (!button || text(button).indexOf("Jana Rancangan Semester") === -1) return;
    update();
    if (button.dataset.engatHasConflict === "true") {
      event.preventDefault();
      event.stopImmediatePropagation();
      var panel = document.getElementById("engat-timetable-conflict");
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, true);

  function scheduleUpdate() {
    window.clearTimeout(scheduleUpdate.timer);
    scheduleUpdate.timer = window.setTimeout(update, 60);
  }

  installStyles();
  document.addEventListener("input", scheduleUpdate, true);
  document.addEventListener("change", scheduleUpdate, true);
  new MutationObserver(function (records) {
    var relevant = records.some(function (record) {
      if (record.target && record.target.closest &&
          record.target.closest("#engat-timetable-conflict,#engat-partial-week-info,.engat-class-manager-v27,.engat-class-reflection-note-v27")) {
        return false;
      }
      return Array.from(record.addedNodes || []).concat(Array.from(record.removedNodes || [])).some(function (node) {
        return node.nodeType === 1 &&
          (node.matches("h2,h3,h4,select,input,button") || node.querySelector("h2,h3,h4,select,input,button"));
      });
    });
    if (relevant) scheduleUpdate();
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(update, 500);
})();
