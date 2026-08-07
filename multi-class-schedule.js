(function () {
  "use strict";
  if (window.__engatMultiClassV53Loaded) return;
  window.__engatMultiClassV53Loaded = true;

  var STORAGE_KEY = "engat-class-groups-v52";
  var DAYS = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  var syncing = false;
  var renderTimer = 0;
  var noteTimer = 0;
  var baseSyncTimer = 0;

  function cleanText(element) {
    return (element && element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function timetableSection() {
    var heading = Array.from(document.querySelectorAll("h2,h3,h4")).find(function (item) {
      return cleanText(item) === "Jadual Waktu";
    });
    if (!heading) return null;
    var section = heading.parentElement;
    var fallback = null;
    while (section && section !== document.body) {
      var hasScheduleFields = section.querySelector("select") &&
        section.querySelector('input[type="time"]') &&
        section.querySelector('input[type="number"]');
      var hasClassManager = !!section.querySelector(".engat-class-manager-v27");
      if ((hasScheduleFields || hasClassManager) && !fallback) fallback = section;
      if ((hasScheduleFields || hasClassManager) && Array.from(section.querySelectorAll("button")).some(function (button) {
        return cleanText(button).indexOf("Jana Rancangan Semester") !== -1;
      })) return section;
      section = section.parentElement;
    }
    return fallback;
  }

  function defaultGroups() {
    return [{
      id: "class-" + Date.now(),
      name: "",
      slots: [
        { id: "slot-" + Date.now() + "-1", day: 1, time: "08:00", duration: 2 },
        { id: "slot-" + Date.now() + "-2", day: 2, time: "08:00", duration: 1 }
      ]
    }];
  }

  function normalizeGroups(value) {
    if (!Array.isArray(value) || !value.length) return defaultGroups();
    return value.map(function (group, groupIndex) {
      return {
        id: group.id || "class-" + Date.now() + "-" + groupIndex,
        name: String(group.name || ""),
        slots: Array.isArray(group.slots) ? group.slots.map(function (slot, slotIndex) {
          return {
            id: slot.id || "slot-" + Date.now() + "-" + groupIndex + "-" + slotIndex,
            day: Math.max(0, Math.min(6, Number(slot.day))),
            time: /^\d{2}:\d{2}$/.test(String(slot.time || "")) ? String(slot.time) : "08:00",
            duration: Math.max(1, Math.round(Number(slot.duration) || 1))
          };
        }) : [{ id: "slot-" + Date.now() + "-" + groupIndex, day: 1, time: "08:00", duration: 1 }]
      };
    });
  }

  function loadGroups() {
    try {
      return normalizeGroups(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch (_error) {
      return defaultGroups();
    }
  }

  var groups = loadGroups();

  function saveGroups() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    } catch (_error) {
      /* Jadual masih berfungsi apabila simpanan pelayar disekat. */
    }
    window.__engatClassGroups = JSON.parse(JSON.stringify(groups));
    window.dispatchEvent(new CustomEvent("engat:classes-changed", {
      detail: { groups: window.__engatClassGroups }
    }));
  }

  window.__engatGetClassGroups = function () {
    return JSON.parse(JSON.stringify(groups));
  };

  function nativeInputValue(input, value) {
    if (!input) return;
    if (String(input.value) === String(value)) return;
    var prototype = input.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    var descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor.set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function originalRows(section) {
    return Array.from(section.querySelectorAll("select")).filter(function (select) {
      return !select.closest(".engat-class-manager-v27");
    }).map(function (select) {
      var row = select.parentElement;
      while (row && row !== section) {
        if (row.querySelectorAll("select").length === 1 &&
            row.querySelectorAll('input[type="time"]').length === 1 &&
            row.querySelectorAll('input[type="number"]').length === 1) return row;
        row = row.parentElement;
      }
      return null;
    }).filter(Boolean);
  }

  function originalAddButton(section) {
    return Array.from(section.querySelectorAll("button")).find(function (button) {
      return cleanText(button).indexOf("Kelas") !== -1 &&
        cleanText(button).indexOf("Jana") === -1 &&
        !button.closest(".engat-class-manager-v27");
    });
  }

  function deleteButton(row) {
    return Array.from(row.querySelectorAll("button")).find(function (button) {
      return button.querySelector("svg") || /padam|buang/i.test(cleanText(button));
    });
  }

  function syncBaseClass(section) {
    if (syncing || !section || !groups.length) return;
    syncing = true;
    try {
      var desired = groups[0].slots;
      var rows = originalRows(section);
      var addButton = originalAddButton(section);
      var addAttempts = 0;
      while (rows.length < desired.length && addButton && addAttempts < 20) {
        var previousAddCount = rows.length;
        addButton.click();
        rows = originalRows(section);
        addAttempts += 1;
        if (rows.length <= previousAddCount) break;
      }
      var removeAttempts = 0;
      while (rows.length > desired.length && removeAttempts < 20) {
        var previousRemoveCount = rows.length;
        var remove = deleteButton(rows[rows.length - 1]);
        if (!remove) break;
        remove.click();
        rows = originalRows(section);
        removeAttempts += 1;
        if (rows.length >= previousRemoveCount) break;
      }
      rows.slice(0, desired.length).forEach(function (row, index) {
        var slot = desired[index];
        var select = row.querySelector("select");
        var option = Array.from(select.options).find(function (candidate) {
          return cleanText(candidate) === DAYS[slot.day];
        });
        nativeInputValue(select, option ? option.value : slot.day);
        nativeInputValue(row.querySelector('input[type="time"]'), slot.time);
        nativeInputValue(row.querySelector('input[type="number"]'), slot.duration);
        row.classList.add("engat-original-slot-v27");
      });
    } finally {
      syncing = false;
    }
  }

  function scheduleBaseSync() {
    window.clearTimeout(baseSyncTimer);
    var attempt = 0;
    function run() {
      var section = timetableSection();
      if (!section || !groups.length) return;
      syncBaseClass(section);
      if (originalRows(section).length !== groups[0].slots.length && attempt < 12) {
        attempt += 1;
        baseSyncTimer = window.setTimeout(run, 80);
      }
    }
    baseSyncTimer = window.setTimeout(run, 0);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function options(selected) {
    return DAYS.map(function (day, index) {
      return '<option value="' + index + '"' + (index === Number(selected) ? " selected" : "") + ">" + day + "</option>";
    }).join("");
  }

  function groupHtml(group, groupIndex) {
    var slots = group.slots.map(function (slot, slotIndex) {
      return '<div class="engat-class-slot-v27" data-slot-index="' + slotIndex + '">' +
        '<label><span>Hari</span><select data-field="day">' + options(slot.day) + '</select></label>' +
        '<label><span>Masa</span><input data-field="time" type="time" value="' + escapeHtml(slot.time) + '"></label>' +
        '<label><span>Jam</span><input data-field="duration" type="number" min="1" step="1" value="' + escapeHtml(slot.duration) + '"></label>' +
        '<button type="button" class="engat-delete-slot-v27" aria-label="Padam slot">🗑</button>' +
        '</div>';
    }).join("");
    var deleteInteraction = groupIndex > 0 ?
      '<button type="button" class="engat-delete-class-v27" aria-label="Padam Interaksi ' +
        escapeHtml(group.name.trim() || "Kelas " + (groupIndex + 1)) + '">🗑 Padam Interaksi</button>' : "";
    return '<section class="engat-class-card-v27" data-group-index="' + groupIndex + '">' +
      '<label class="engat-class-name-v27"><span class="sr-only">Nama kelas</span><input data-field="name" aria-label="Nama kelas ' + (groupIndex + 1) + '" placeholder="Taip nama kelas" value="' + escapeHtml(group.name) + '"></label>' +
      '<div class="engat-class-columns-v27"><span>Hari</span><span>Masa</span><span>Jam</span><span></span></div>' +
      '<div class="engat-class-slots-v27">' + slots + '</div>' +
      '<div class="engat-class-actions-v53">' +
        '<button type="button" class="engat-add-slot-v27">+ Tambah Hari, Masa dan Jam</button>' +
        deleteInteraction +
      '</div>' +
    '</section>';
  }

  function detectConflicts() {
    var slots = [];
    groups.forEach(function (group, groupIndex) {
      var groupName = group.name.trim();
      if (!groupName) return;
      group.slots.forEach(function (slot, slotIndex) {
        if (!/^\d{2}:\d{2}$/.test(String(slot.time || "")) ||
            !Number.isFinite(Number(slot.duration)) || Number(slot.duration) <= 0) return;
        var parts = slot.time.split(":").map(Number);
        var start = parts[0] * 60 + parts[1];
        slots.push({
          groupIndex: groupIndex,
          slotIndex: slotIndex,
          name: groupName,
          day: slot.day,
          start: start,
          end: start + slot.duration * 60
        });
      });
    });
    var conflicts = [];
    for (var i = 0; i < slots.length; i += 1) {
      for (var j = i + 1; j < slots.length; j += 1) {
        if (slots[i].day === slots[j].day && slots[i].start < slots[j].end && slots[j].start < slots[i].end) {
          conflicts.push([slots[i], slots[j]]);
        }
      }
    }
    return conflicts;
  }

  function validateManager(manager, showRequired) {
    if (!manager) return false;
    var conflictBox = manager.querySelector(".engat-class-validation-v27");
    var errors = [];
    groups.forEach(function (group, index) {
      if (showRequired && !group.name.trim()) errors.push("Masukkan nama bagi Kelas " + (index + 1) + ".");
      if (showRequired && !group.slots.length) errors.push("Tambah sekurang-kurangnya satu Hari, Masa dan Jam bagi " +
        (group.name.trim() || "Kelas " + (index + 1)) + ".");
    });
    var completedGroups = groups.filter(function (group) {
      return group.name.trim() && group.slots.length;
    });
    var totals = completedGroups.map(function (group) {
      return group.slots.reduce(function (sum, slot) { return sum + Number(slot.duration || 0); }, 0);
    });
    if (totals.length > 1 && totals.some(function (total) { return total !== totals[0]; })) {
      errors.push("Jumlah jam mingguan setiap kelas mesti sama supaya agihan topik kekal konsisten.");
    }
    detectConflicts().forEach(function (pair) {
      errors.push(pair[0].name + " bertindih dengan " + pair[1].name + " pada " + DAYS[pair[0].day] + ".");
    });
    var validationHtml = errors.length ? "<strong>Semakan jadual kelas</strong><br>" + errors.map(escapeHtml).join("<br>") : "";
    if (conflictBox.hidden !== !errors.length) conflictBox.hidden = !errors.length;
    if (conflictBox.innerHTML !== validationHtml) conflictBox.innerHTML = validationHtml;
    var section = timetableSection();
    var generate = section && Array.from(section.querySelectorAll("button")).find(function (button) {
      return cleanText(button).indexOf("Jana Rancangan Semester") !== -1;
    });
    if (generate) {
      generate.dataset.engatMultiClassInvalid = errors.length ? "true" : "false";
      generate.classList.toggle("engat-generate-blocked", errors.length > 0);
    }
    return errors.length === 0;
  }

  function renderManager() {
    var section = timetableSection();
    if (!section) return;
    var breakHeading = Array.from(document.querySelectorAll("h2,h3,h4")).find(function (item) {
      return cleanText(item) === "Cuti Semester";
    });
    if (breakHeading) breakHeading.textContent = "Cuti / Peristiwa / Program";
    var manager = section.querySelector(".engat-class-manager-v27");
    if (!manager) {
      manager = document.createElement("div");
      manager.className = "engat-class-manager-v27";
      var firstRow = originalRows(section)[0];
      var insertTarget = firstRow && firstRow.parentElement;
      (insertTarget && insertTarget.parentElement ? insertTarget.parentElement : section).insertBefore(manager, insertTarget || null);
    }
    manager.innerHTML =
      '<div class="engat-class-manager-head-v27">' +
      '<button type="button" class="engat-add-class-v27">+ Interaksi</button></div>' +
      groups.map(groupHtml).join("") +
      '<div class="engat-class-validation-v27" hidden></div>';

    originalRows(section).forEach(function (row) { row.classList.add("engat-original-slot-v27"); });
    Array.from(section.querySelectorAll("div")).forEach(function (element) {
      var labels = Array.from(element.children).map(cleanText).filter(Boolean);
      if (!element.closest(".engat-class-manager-v27") &&
          labels.length === 3 &&
          labels[0] === "Hari" && labels[1] === "Masa" && labels[2] === "Jam" &&
          !element.querySelector("input,select,button")) {
        element.classList.add("engat-original-columns-v53");
      }
    });
    var precedingColumns = manager.previousElementSibling;
    if (precedingColumns && !precedingColumns.querySelector("input,select,button")) {
      var precedingLabels = Array.from(precedingColumns.children).map(cleanText).filter(Boolean);
      if (precedingLabels[0] === "Hari" && precedingLabels[1] === "Masa" && precedingLabels[2] === "Jam") {
        precedingColumns.classList.add("engat-original-columns-v53");
      }
    }
    Array.from(manager.querySelectorAll(".engat-class-slot-v27")).forEach(function (row) {
      row.classList.remove("engat-original-slot-v27");
    });
    var add = originalAddButton(section);
    if (add) add.classList.add("engat-original-add-v27");
    scheduleBaseSync();
    validateManager(manager);
    addClassNotes();
  }

  function updateFromControl(control) {
    var card = control.closest(".engat-class-card-v27");
    if (!card) return;
    var groupIndex = Number(card.dataset.groupIndex);
    var group = groups[groupIndex];
    if (!group) return;
    var field = control.dataset.field;
    if (field === "name") group.name = control.value;
    var slotRow = control.closest(".engat-class-slot-v27");
    if (slotRow) {
      var slot = group.slots[Number(slotRow.dataset.slotIndex)];
      if (field === "day") slot.day = Number(control.value);
      if (field === "time") slot.time = control.value;
      if (field === "duration") {
        var rounded = Math.max(1, Math.round(Number(control.value) || 1));
        slot.duration = rounded;
        if (String(rounded) !== control.value) control.value = rounded;
      }
    }
    saveGroups();
    if (groupIndex === 0 && field !== "name") scheduleBaseSync();
    validateManager(control.closest(".engat-class-manager-v27"));
    addClassNotes();
    scheduleNotes();
  }

  document.addEventListener("input", function (event) {
    if (event.target && event.target.closest(".engat-class-manager-v27")) updateFromControl(event.target);
  }, true);
  document.addEventListener("change", function (event) {
    if (event.target && event.target.closest(".engat-class-manager-v27")) updateFromControl(event.target);
  }, true);

  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest("button");
    if (!button) return;
    var manager = button.closest(".engat-class-manager-v27");
    if (manager) {
      event.preventDefault();
      var card = button.closest(".engat-class-card-v27");
      var groupIndex = card ? Number(card.dataset.groupIndex) : -1;
      if (button.classList.contains("engat-add-class-v27")) {
        groups.push({
          id: "class-" + Date.now(),
          name: "",
          slots: [
            { id: "slot-" + Date.now() + "-1", day: 1, time: "08:00", duration: 2 },
            { id: "slot-" + Date.now() + "-2", day: 2, time: "08:00", duration: 1 }
          ]
        });
      } else if (button.classList.contains("engat-add-slot-v27")) {
        groups[groupIndex].slots.push({
          id: "slot-" + Date.now(),
          day: 1,
          time: "08:00",
          duration: 1
        });
      } else if (button.classList.contains("engat-delete-slot-v27")) {
        var slotIndex = Number(button.closest(".engat-class-slot-v27").dataset.slotIndex);
        groups[groupIndex].slots.splice(slotIndex, 1);
      } else if (button.classList.contains("engat-delete-class-v27")) {
        if (groupIndex <= 0 || groupIndex >= groups.length) return;
        groups.splice(groupIndex, 1);
      } else {
        return;
      }
      saveGroups();
      renderManager();
      scheduleNotes();
      return;
    }
    if (cleanText(button).indexOf("Jana Rancangan Semester") !== -1) {
      var currentManager = document.querySelector(".engat-class-manager-v27");
      if (currentManager && !validateManager(currentManager, true)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        currentManager.querySelector(".engat-class-validation-v27").scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, true);

  function formatTime(value) {
    var parts = String(value || "00:00").split(":").map(Number);
    var suffix = parts[0] >= 12 ? "PM" : "AM";
    var hour = parts[0] % 12 || 12;
    return String(hour).padStart(2, "0") + ":" + String(parts[1]).padStart(2, "0") + " " + suffix;
  }

  function durationFromRow(row) {
    /*
     * Jam sesi ialah sebahagian daripada data RPP pada kolum Minggu/Tarikh/Masa.
     * Jangan baca daripada textarea Catatan/Refleksi kerana catatan pengguna
     * mungkin kosong atau mengandungi nombor lain yang tidak berkaitan.
     */
    var firstCell = row && row.querySelector("td");
    var matches = cleanText(firstCell).match(/\((\d+(?:[.,]\d+)?)\s*jam\)/gi) || [];
    if (!matches.length) return null;
    return Number(matches[matches.length - 1].match(/\d+(?:[.,]\d+)?/)[0].replace(",", "."));
  }

  function addClassNotes() {
    Array.from(document.querySelectorAll("table")).forEach(function (table) {
      var tableText = cleanText(table).toUpperCase();
      if (tableText.indexOf("CATATAN/REFLEKSI") === -1 || tableText.indexOf("MINGGU") === -1) return;
      Array.from(table.querySelectorAll("tbody tr")).forEach(function (row) {
        var textareas = row.querySelectorAll("textarea");
        var textarea = textareas[textareas.length - 1];
        if (!textarea) return;
        var duration = durationFromRow(row);
        var matches = [];
        groups.forEach(function (group, groupIndex) {
          group.slots.forEach(function (slot) {
            if (duration != null && Number(slot.duration) === duration) {
              matches.push({
                name: group.name.trim() || "Kelas " + (groupIndex + 1),
                slot: slot
              });
            }
          });
        });
        var note = textarea.parentElement.querySelector(".engat-class-reflection-note-v27");
        if (!note) {
          note = document.createElement("div");
          note.className = "engat-class-reflection-note-v27";
          textarea.insertAdjacentElement("afterend", note);
        }
        var noteHtml = matches.length ?
          "<strong>Jadual kelas:</strong>" + matches.map(function (item) {
            return "<span>" + escapeHtml(item.name) + " · " + DAYS[item.slot.day] + " · " +
              formatTime(item.slot.time) + " · " + item.slot.duration + " jam</span>";
          }).join("") : "";
        if (note.innerHTML !== noteHtml) note.innerHTML = noteHtml;
      });
    });
  }

  function scheduleNotes() {
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(addClassNotes, 120);
  }

  function installStyles() {
    if (document.getElementById("engat-multi-class-v53-style")) return;
    var style = document.createElement("style");
    style.id = "engat-multi-class-v53-style";
    style.textContent =
      ".engat-original-slot-v27,.engat-original-add-v27,.engat-original-columns-v53{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important}" +
      ".engat-class-manager-v27{display:grid;gap:22px;margin:0 0 14px;min-width:0}.engat-class-manager-head-v27{display:flex;align-items:center;justify-content:flex-end;margin-top:-52px;margin-bottom:4px}.engat-class-manager-v27 button{border:1px solid #d8d4cf;border-radius:9px;background:#fff;padding:9px 14px;font-weight:700;color:#173f36;max-width:100%;white-space:normal}.engat-add-class-v27{min-height:42px}.engat-class-card-v27{padding:0 0 4px;min-width:0;max-width:100%}.engat-class-card-v27+.engat-class-card-v27{padding-top:8px}" +
      ".engat-class-name-v27{display:block}.engat-class-name-v27 span,.engat-class-slot-v27 label span{font-size:11px;font-weight:800;color:#6b6762}.engat-class-slot-v27 label span{display:none}.engat-class-name-v27 input{width:100%;min-height:48px;border:1px solid #d8d4cf;border-radius:9px;padding:0 14px;font-size:16px;text-align:center}.engat-class-name-v27 input::placeholder{color:#57534e;opacity:1}" +
      ".engat-class-columns-v27,.engat-class-slot-v27{display:grid;grid-template-columns:minmax(110px,1.35fr) minmax(105px,1fr) minmax(80px,.7fr) 44px;gap:9px;align-items:end}.engat-class-columns-v27{padding:14px 10px 3px;color:#6b6762;font-size:12px;font-weight:800}.engat-class-manager-v27 .engat-class-slot-v27{position:static!important;left:auto!important;width:auto!important;height:auto!important;overflow:visible!important;opacity:1!important;pointer-events:auto!important;padding:9px;border:1px solid #e4e1dd;border-radius:9px;background:#fff;margin-top:8px;box-sizing:border-box}.engat-class-slot-v27>label{display:grid;gap:5px;min-width:0;max-width:100%}.engat-class-slot-v27 select,.engat-class-slot-v27 input{box-sizing:border-box;width:100%;min-width:0!important;max-width:100%!important;height:42px;border:1px solid #d8d4cf;border-radius:8px;background:#fff;padding:0 10px;font-size:14px}.engat-delete-slot-v27{height:42px;padding:0!important;color:#57534e!important}.engat-class-actions-v53{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:10px}.engat-class-actions-v53 .engat-add-slot-v27{margin:0;padding:8px 12px!important;font-size:12px}.engat-delete-class-v27{min-height:42px;color:#9f1239!important;border-color:#fda4af!important;background:#fff1f2!important;font-size:12px}.engat-delete-class-v27:hover{background:#ffe4e6!important}" +
      ".engat-class-validation-v27{padding:12px;border:1px solid #fda4af;border-radius:10px;background:#fff1f2;color:#9f1239;font-size:13px;line-height:1.5;overflow-wrap:anywhere}.engat-class-reflection-note-v27{margin-top:8px;padding:8px;border-radius:8px;background:#eefbf7;color:#115e59;font-size:11px;line-height:1.4;overflow-wrap:anywhere}.engat-class-reflection-note-v27 strong{display:block;margin-bottom:4px}.engat-class-reflection-note-v27 span{display:block}" +
      "@media(max-width:650px){.engat-class-manager-head-v27{margin-top:0}.engat-add-class-v27{width:100%}.engat-class-columns-v27{display:none}.engat-class-slot-v27{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px!important}.engat-class-slot-v27 label span{display:block}.engat-class-slot-v27 select,.engat-class-slot-v27 input{font-size:16px}.engat-delete-slot-v27{width:42px;justify-self:end}.engat-class-actions-v53{display:grid;grid-template-columns:minmax(0,1fr)}.engat-class-actions-v53 button{width:100%}}" +
      "@media(max-width:360px){.engat-class-slot-v27{grid-template-columns:minmax(0,1fr)}.engat-delete-slot-v27{width:100%;justify-self:stretch}}";
    document.head.appendChild(style);
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(function () {
      var section = timetableSection();
      if (section && !section.querySelector(".engat-class-manager-v27")) renderManager();
    }, 100);
  }

  installStyles();
  saveGroups();
  window.__engatInstallMultiClass = scheduleRender;
  window.setTimeout(scheduleRender, 700);
  window.setTimeout(scheduleRender, 1500);
  /*
   * Paparan utama dibina semula oleh React selepas fail MK dimuat naik.
   * Polling ringan memastikan pengurus kelas dipasang walaupun mutasi React
   * berlaku sebelum observer sempat melihat seksyen Jadual Waktu.
   */
  window.setInterval(function () {
    var section = timetableSection();
    if (section && !section.querySelector(".engat-class-manager-v27")) renderManager();
  }, 800);
  new MutationObserver(function (records) {
    var managerExists = !!document.querySelector(".engat-class-manager-v27");
    var needsManager = !managerExists && records.some(function (record) {
      return Array.from(record.addedNodes || []).some(function (node) {
        return node.nodeType === 1 &&
          !node.closest(".engat-class-reflection-note-v27") &&
          !node.closest("#engat-timetable-conflict") &&
          !node.closest("#engat-partial-week-info");
      });
    });
    if (needsManager) scheduleRender();
    var needsNotes = records.some(function (record) {
      return Array.from(record.addedNodes || []).some(function (node) {
        return node.nodeType === 1 &&
          !node.closest(".engat-class-manager-v27") &&
          !node.closest(".engat-class-reflection-note-v27") &&
          (node.matches("table,textarea,.weekly-lesson-document") ||
            node.querySelector("table,textarea,.weekly-lesson-document"));
      });
    });
    if (needsNotes) scheduleNotes();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
