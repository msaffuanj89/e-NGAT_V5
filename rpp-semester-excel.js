(function () {
  "use strict";

  var TEMPLATE_FILE = "lam-pt-03-01-03-02-template-v1.4.xlsx";
  var SHEET_PATH = "xl/worksheets/sheet2.xml";
  var START_ROW = 14;
  var END_ROW = 30;
  var CAPACITY = END_ROW - START_ROW + 1;
  var TOTAL_ROW = 31;
  var OVERALL_ROW = 32;
  var LAST_ROW = 45;
  var COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"];
  var HOUR_COLUMNS = ["H", "I", "J", "K", "L", "M", "N", "O", "P"];
  var encoder = new TextEncoder();
  var decoder = new TextDecoder();

  var categoryNotes = {
    KF: ["L/K", "Kuliah Fizikal"],
    KS: ["L/K", "Kuliah Dalam Talian Segerak"],
    TF: ["T", "Tutorial Fizikal"],
    TS: ["T", "Tutorial Dalam Talian Segerak"],
    AF: ["A/P", "Amali Fizikal"],
    AS: ["A/P", "Amali Dalam Talian Segerak"],
    LF: ["L/O", "Lain-lain Fizikal"],
    LS: ["L/O", "Lain-lain Dalam Talian Segerak"]
  };

  var categoryToColumn = {
    KF: "H",
    TF: "I",
    AF: "J",
    LF: "K",
    KS: "L",
    TS: "M",
    AS: "N",
    LS: "O"
  };

  window.__downloadRppSemesterExcel = async function downloadRppSemesterExcel(sourceRows, teachingPlanInfo, container) {
    var rows = buildTemplateRows(sourceRows || [], container);
    if (rows.length === 0) rows = [emptyTemplateRow()];

    var response = await fetch(new URL(TEMPLATE_FILE, document.baseURI).toString(), { cache: "no-store" });
    if (!response.ok) throw new Error("Template Excel RPP Semester tidak ditemui.");

    var entries = await readZipEntries(await response.arrayBuffer());
    var sheet = entries.get(SHEET_PATH);
    if (!sheet) throw new Error("Sheet RPP Semester tidak ditemui dalam template.");

    var sheetXml = decoder.decode(sheet);
    var styles = entries.get("xl/styles.xml");
    if (styles) {
      entries.set("xl/styles.xml", encoder.encode(ensureWrapStyles(decoder.decode(styles), getCellStyleIds(sheetXml, ["C14", "Q14"]))));
    }

    var xml = fillSheetXml(sheetXml, rows, teachingPlanInfo || {});
    entries.set(SHEET_PATH, encoder.encode(xml));

    var workbook = entries.get("xl/workbook.xml");
    if (workbook) {
      entries.set("xl/workbook.xml", encoder.encode(activateWorkbookSheet(forceWorkbookRecalculation(decoder.decode(workbook)), 1)));
    }

    var blob = new Blob([await writeZipEntries(entries)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    var fileName = safeFileName("RPP-Semester-" + ((teachingPlanInfo && teachingPlanInfo.courseCode) || "MK") + ".xlsx");
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  window.__downloadRppWeeklyExcel = async function downloadRppWeeklyExcel(documents, teachingPlanInfo, container) {
    var response = await fetch(new URL(TEMPLATE_FILE, document.baseURI).toString(), { cache: "no-store" });
    if (!response.ok) throw new Error("Templat rasmi LAM-PT-03-02 tidak ditemui.");

    var templateEntries = await readZipEntries(await response.arrayBuffer());
    var textareas = Array.prototype.slice.call(container ? container.querySelectorAll("tbody textarea") : []);
    var draftIndex = 0;
    var documentMap = new Map();
    var preparedWeeks = new Map();
    (documents || []).forEach(function (documentItem) {
      documentMap.set(Number(documentItem.week), documentItem);
    });

    for (var week = 1; week <= 14; week += 1) {
      var documentItem = documentMap.get(week) || { week: week, rows: [] };
      var rows = (documentItem.rows || []).map(function (row) {
        var outcome = textareas[draftIndex] ? textareas[draftIndex].value : "";
        var strategy = textareas[draftIndex + 1] ? textareas[draftIndex + 1].value : defaultWeeklyStrategy(row);
        var notes = textareas[draftIndex + 2] ? textareas[draftIndex + 2].value : "";
        draftIndex += 3;
        return {
          source: row,
          outcome: outcome,
          strategy: strategy,
          notes: notes
        };
      });
      preparedWeeks.set(week, rows);
    }

    var classGroups = window.__engatGetClassGroups ? window.__engatGetClassGroups() : [];
    if (!classGroups.length) classGroups = [{ name: (teachingPlanInfo && teachingPlanInfo.group) || "Kelas" }];
    var generatedWorkbooks = [];

    /*
     * Setiap kelas menerima fail LAM-PT-03-02 sendiri. Jadual kelas yang
     * dipaparkan dalam Catatan/Refleksi aplikasi tidak ditulis ke dalam sel
     * textarea, jadi nota teknikal itu tidak termasuk dalam fail rasmi.
     */
    for (var classIndex = 0; classIndex < classGroups.length; classIndex += 1) {
      var classGroup = classGroups[classIndex];
      var entries = cloneZipEntries(templateEntries);
      var classInfo = Object.assign({}, teachingPlanInfo || {}, {
        group: String(classGroup.name || "").trim() || "Kelas " + (classIndex + 1)
      });

      for (var exportWeek = 1; exportWeek <= 14; exportWeek += 1) {
        var sheetPath = "xl/worksheets/sheet" + (exportWeek + 2) + ".xml";
        var sheetBytes = entries.get(sheetPath);
        if (!sheetBytes) continue;
        entries.set(sheetPath, encoder.encode(fillWeeklySheetXml(
          decoder.decode(sheetBytes),
          preparedWeeks.get(exportWeek) || [],
          classInfo,
          exportWeek
        )));
      }

      var workbook = entries.get("xl/workbook.xml");
      if (workbook) {
        entries.set("xl/workbook.xml", encoder.encode(activateWorkbookSheet(forceWorkbookRecalculation(decoder.decode(workbook)), 2)));
      }

      var workbookBytes = await writeZipEntries(entries);
      var fileName = safeFileName(
        "RPP-Mingguan-" +
        ((teachingPlanInfo && teachingPlanInfo.courseCode) || "MK") + "-" +
        classInfo.group + ".xlsx"
      );
      generatedWorkbooks.push({ name: fileName, data: workbookBytes });
    }

    if (generatedWorkbooks.length === 1) {
      downloadBlob(new Blob([generatedWorkbooks[0].data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }), generatedWorkbooks[0].name);
      return;
    }

    if (!window.JSZip) throw new Error("Komponen ZIP Excel tidak berjaya dimuatkan.");
    var downloadZip = new window.JSZip();
    generatedWorkbooks.forEach(function (workbookItem) {
      downloadZip.file(workbookItem.name, workbookItem.data, { binary: true });
    });
    var zipBytes = await downloadZip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      platform: "DOS"
    });
    downloadBlob(new Blob([zipBytes], { type: "application/zip" }), safeFileName(
      "RPP-Mingguan-" +
      ((teachingPlanInfo && teachingPlanInfo.courseCode) || "MK") +
      "-Semua-Kelas.zip"
    ));
  };

  function cloneZipEntries(entries) {
    var copy = new Map();
    entries.forEach(function (data, name) {
      copy.set(name, data.slice ? data.slice(0) : data);
    });
    return copy;
  }

  function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.__buildRppSemesterTemplateRows = buildTemplateRows;

  function fillWeeklySheetXml(templateXml, rows, info, week) {
    var xml = ensureSheetView(templateXml);
    var dates = rows.map(function (item) { return item.source.date || ""; }).filter(Boolean);
    var metadata = {
      C3: info.program || "-",
      L3: info.courseCode || "-",
      C4: info.semester || "-",
      G4: info.year || "-",
      L4: info.credit || "-",
      C5: info.courseName || "-",
      L5: info.group || "-",
      C6: String(week),
      G6: dates.length ? formatWeeklyDateRange(dates[0], dates[dates.length - 1]) : "-"
    };
    Object.keys(metadata).forEach(function (cellRef) {
      xml = setCellValue(xml, cellRef, metadata[cellRef]);
    });

    var startRow = 11;
    var endRow = 25;
    for (var index = 0; index <= endRow - startRow; index += 1) {
      var rowNumber = startRow + index;
      var item = rows[index];
      var values = { B: "", C: "", F: "", G: "", H: "", I: "", J: "", K: "", L: "", M: "", N: "", O: "", P: "", Q: "" };
      if (item) {
        var source = item.source;
        values.B = weeklyTopicText(source);
        values.C = item.outcome;
        values.G = item.strategy || defaultWeeklyStrategy(source);
        values.Q = item.notes;
        var hourColumn = categoryToColumn[source.activity] || (source.activity === "EP" ? "P" : "");
        if (hourColumn) values[hourColumn] = roundNumber(source.hours || 0);
      }
      Object.keys(values).forEach(function (column) {
        xml = setCellValue(xml, column + rowNumber, values[column]);
      });
      xml = setRowHeight(xml, rowNumber, item ? estimateWeeklyRowHeight(item) : 18.5);
    }

    HOUR_COLUMNS.forEach(function (column) {
      var total = rows.reduce(function (sum, item) {
        var source = item.source;
        var targetColumn = categoryToColumn[source.activity] || (source.activity === "EP" ? "P" : "");
        return sum + (targetColumn === column ? Number(source.hours || 0) : 0);
      }, 0);
      xml = setCellFormula(xml, column + "26", "SUM(" + column + "11:" + column + "25)", roundNumber(total));
    });
    var overall = rows.reduce(function (sum, item) { return sum + Number(item.source.hours || 0); }, 0);
    xml = setCellFormula(xml, "H27", "SUM(H26:P26)", roundNumber(overall));
    return xml;
  }

  function weeklyTopicText(row) {
    var heading = [row.topicNumber ? row.topicNumber + "." : "", row.topic || ""].filter(Boolean).join(" ");
    return [heading, row.subtopic || ""].filter(Boolean).join("\n");
  }

  function defaultWeeklyStrategy(row) {
    if (row.activity === "KF" || row.activity === "KS") return "Kuliah";
    if (row.activity === "TF" || row.activity === "TS") return "Tutorial";
    if (row.activity === "AF" || row.activity === "AS") return "Amali";
    return "e-Pembelajaran Asinkron";
  }

  function estimateWeeklyRowHeight(item) {
    var lines = Math.max(
      estimateLineCount(weeklyTopicText(item.source), 34),
      estimateLineCount(item.outcome || "", 28),
      estimateLineCount(item.strategy || "", 26),
      estimateLineCount(item.notes || "", 28)
    );
    return Math.min(120, Math.max(32, lines * 14 + 8));
  }

  function formatWeeklyDateRange(start, end) {
    if (!end || start === end) return formatIsoDate(start);
    return formatIsoDate(start) + " - " + formatIsoDate(end);
  }

  function formatIsoDate(value) {
    var match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? match[3] + "/" + match[2] + "/" + match[1] : String(value || "");
  }

  function buildTemplateRows(sourceRows, container) {
    var textareas = Array.prototype.slice.call(container ? container.querySelectorAll("tbody textarea") : []);
    var noteIndex = 0;
    var output = [];

    sourceRows.forEach(function (row) {
      var editedNote = textareas[noteIndex] ? textareas[noteIndex].value : "";
      noteIndex += 1;

      if (row.specialTitle) {
        output.push(makeTemplateRow(row, row.specialTitle, {}, 0, editedNote || (row.notes || []).join("\n"), "special"));
        return;
      }

      var topicText = formatTopics(row);
      var categoryHours = reduceCategoryHours(row.ktalSegments || []);
      var hasKtal = Object.keys(categoryToColumn).some(function (key) {
        return categoryHours[key] > 0;
      });

      if (hasKtal) {
        var currentCategoryNote = buildCategoryNote(row, categoryHours);
        output.push(makeTemplateRow(
          row,
          topicText,
          categoryHours,
          0,
          chooseCurrentNote(editedNote, currentCategoryNote),
          "ktal"
        ));
      }

      if ((row.epHours || 0) > 0) {
        var epParts = (row.epSegments || []).map(function (segment) {
          return roundNumber(segment.hours || 0);
        }).filter(function (hours) {
          return hours > 0;
        });
        if (epParts.length === 0) epParts = [roundNumber(row.epHours || 0)];
        epParts.forEach(function (hours, index) {
          output.push(makeTemplateRow(
            row,
            topicText,
            {},
            hours,
            chooseCurrentNote(editedNote, buildEpNote(row)),
            "ep-" + index
          ));
        });
      }
    });

    return output;
  }

  function chooseCurrentNote(editedNote, generatedNote) {
    var value = String(editedNote || "").trim();
    if (!value) return generatedNote;

    /*
     * Nota kategori yang dijana oleh paparan React boleh menjadi lapuk apabila
     * pengguna menjana rancangan baharu pada baris/minggu yang sama. Jika nilai
     * semasa jelas merupakan nota auto lama, bina semula daripada ktalSegments.
     * Nota bebas yang ditaip sendiri oleh pensyarah tetap dikekalkan.
     */
    var lines = value.split(/\r?\n/).map(function (line) {
      return line.trim();
    }).filter(Boolean);
    var isGeneratedCategoryNote = lines.length > 0 && lines.every(function (line) {
      return /^(?:L\/K|T|A\/P|L\/O)\s*:\s*(?:KF|KS|TF|TS|AF|AS|LF|LS)\b/i.test(line) ||
        /^Pautan e-Pembelajaran\s*:/i.test(line);
    });
    return isGeneratedCategoryNote ? generatedNote : value;
  }

  function makeTemplateRow(source, topicText, categoryHours, epHours, note, suffix) {
    return {
      id: [source.week, source.startDate || "", source.endDate || "", suffix].join("-"),
      weekText: String(source.week || ""),
      dateRange: source.displayDateRange || "",
      topicText: topicText || "",
      kfHours: categoryHours.KF || 0,
      tfHours: categoryHours.TF || 0,
      afHours: categoryHours.AF || 0,
      lfHours: categoryHours.LF || 0,
      ksHours: categoryHours.KS || 0,
      tsHours: categoryHours.TS || 0,
      asHours: categoryHours.AS || 0,
      lsHours: categoryHours.LS || 0,
      epHours: epHours || 0,
      note: note || ""
    };
  }

  function reduceCategoryHours(segments) {
    return segments.reduce(function (totals, segment) {
      if (categoryToColumn[segment.category]) totals[segment.category] = roundNumber((totals[segment.category] || 0) + (segment.hours || 0));
      return totals;
    }, {});
  }

  function buildCategoryNote(row, categoryHours) {
    var notes = Object.keys(categoryNotes).map(function (key) {
      var hours = categoryHours[key] || 0;
      if (hours <= 0) return "";
      return categoryNotes[key][0] + ": " + key + " - " + categoryNotes[key][1] + " (" + formatHour(hours) + " jam)";
    }).filter(Boolean);
    if (row.notes && row.notes.length) notes = notes.concat(row.notes);
    return notes.join("\n");
  }

  function buildEpNote(row) {
    var notes = ["Pautan e-Pembelajaran : "];
    if (row.notes && row.notes.length) notes = notes.concat(row.notes);
    return notes.join("\n");
  }

  function formatTopics(row) {
    return (row.topics || []).map(function (topic) {
      var lines = [topic.topicNumber + ". " + topic.topicTitle];
      (topic.subtopics || []).forEach(function (subtopic) {
        if (subtopic.title) lines.push(subtopic.title);
        (subtopic.children || []).forEach(function (child) {
          if (child) lines.push("- " + child);
        });
      });
      return lines.filter(Boolean).join("\n");
    }).join("\n\n");
  }

  function fillSheetXml(templateXml, rows, info) {
    var extraRows = Math.max(0, rows.length - CAPACITY);
    var lastDataRow = END_ROW + extraRows;
    var totalRow = TOTAL_ROW + extraRows;
    var overallRow = OVERALL_ROW + extraRows;
    var xml = extraRows > 0 ? expandSheetRows(templateXml, extraRows) : templateXml;
    xml = ensureSheetView(xml);

    var metadata = {
      C3: info.program || "-",
      C4: info.semester || "-",
      G4: info.year || "-",
      C5: info.lecturerName || "-",
      P5: info.intake || "-",
      C6: info.department || "-",
      P6: info.group || "-",
      C7: info.courseName || "-",
      P7: info.credit || "-",
      C8: info.courseCode || "-"
    };
    Object.keys(metadata).forEach(function (cellRef) {
      xml = setCellValue(xml, cellRef, metadata[cellRef]);
    });

    for (var index = 0; index < Math.max(CAPACITY, rows.length); index += 1) {
      var rowNumber = START_ROW + index;
      var row = rows[index];
      if (!row) {
        COLUMNS.forEach(function (column) {
          xml = setCellValue(xml, column + rowNumber, "");
        });
        xml = setRowHeight(xml, rowNumber, 18);
        continue;
      }
      var values = {
        A: row.weekText,
        B: row.dateRange,
        C: row.topicText,
        H: row.kfHours,
        I: row.tfHours,
        J: row.afHours,
        K: row.lfHours,
        L: row.ksHours,
        M: row.tsHours,
        N: row.asHours,
        O: row.lsHours,
        P: row.epHours,
        Q: row.note
      };
      COLUMNS.forEach(function (column) {
        xml = setCellValue(xml, column + rowNumber, values[column] == null ? "" : values[column]);
      });
      xml = setRowHeight(xml, rowNumber, estimateRowHeight(row));
    }

    HOUR_COLUMNS.forEach(function (column) {
      var total = rows.reduce(function (sum, row) {
        return sum + hourValueForColumn(row, column);
      }, 0);
      xml = setCellFormula(xml, column + totalRow, "SUM(" + column + START_ROW + ":" + column + lastDataRow + ")", roundNumber(total));
    });
    xml = setCellFormula(xml, "H" + overallRow, "SUM(H" + totalRow + ":P" + totalRow + ")", roundNumber(rows.reduce(function (sum, row) {
      return sum + templateRowTotal(row);
    }, 0)));
    xml = updateDimension(xml, LAST_ROW + extraRows);
    return xml;
  }

  function ensureColumnSettings(xml) {
    var columns = [
      '<cols>',
      '<col min="1" max="1" width="7" customWidth="1"/>',
      '<col min="2" max="2" width="13" customWidth="1"/>',
      '<col min="3" max="7" width="12.5" customWidth="1"/>',
      '<col min="8" max="15" width="1.4" customWidth="1"/>',
      '<col min="16" max="16" width="20.25" customWidth="1"/>',
      '<col min="17" max="17" width="28" customWidth="1"/>',
      '<col min="18" max="16384" width="0" hidden="1" customWidth="1"/>',
      '</cols>'
    ].join("");
    if (/<cols>[\s\S]*?<\/cols>/.test(xml)) return xml.replace(/<cols>[\s\S]*?<\/cols>/, columns);
    return xml.replace(/(<sheetData>)/, columns + "$1");
  }

  function ensureSheetView(xml) {
    return xml.replace(/<sheetView\b([^>]*)>/, function (match, attrs) {
      var selfClosing = /\/\s*$/.test(attrs);
      var nextAttrs = attrs
        .replace(/\/\s*$/, "")
        .replace(/\szoomScale="[^"]*"/, "")
        .replace(/\szoomScaleNormal="[^"]*"/, "");
      return '<sheetView' + nextAttrs + ' zoomScale="80" zoomScaleNormal="80"' + (selfClosing ? "/>" : ">");
    });
  }

  function estimateRowHeight(row) {
    var topicLines = estimateLineCount(row.topicText || "", 72);
    var noteLines = estimateLineCount(row.note || "", 32);
    var height = Math.max(24, Math.max(topicLines, noteLines) * 15 + 8);
    return Math.min(150, Math.round(height));
  }

  function estimateLineCount(value, charsPerLine) {
    return String(value || "").split(/\n/).reduce(function (count, line) {
      return count + Math.max(1, Math.ceil(line.length / charsPerLine));
    }, 0);
  }

  function hourValueForColumn(row, column) {
    var values = {
      H: row.kfHours,
      I: row.tfHours,
      J: row.afHours,
      K: row.lfHours,
      L: row.ksHours,
      M: row.tsHours,
      N: row.asHours,
      O: row.lsHours,
      P: row.epHours
    };
    return values[column] || 0;
  }

  function templateRowTotal(row) {
    return HOUR_COLUMNS.reduce(function (sum, column) {
      return sum + hourValueForColumn(row, column);
    }, 0);
  }

  function expandSheetRows(xml, extraRows) {
    var rowPattern = /<row[^>]* r="(\d+)"[^>]*>[\s\S]*?<\/row>/g;
    var output = "";
    var cursor = 0;
    var inserted = false;
    var match;
    while ((match = rowPattern.exec(xml))) {
      var rowNumber = Number(match[1]);
      var rowXml = match[0];
      output += xml.slice(cursor, match.index);
      if (rowNumber > END_ROW) {
        if (!inserted) {
          output += buildExtraDataRows(xml, extraRows);
          inserted = true;
        }
        output += shiftRowXml(rowXml, extraRows);
      } else {
        output += rowXml;
      }
      cursor = match.index + rowXml.length;
    }
    output += xml.slice(cursor);
    return updateMergeCells(output, extraRows);
  }

  function buildExtraDataRows(xml, extraRows) {
    var match = xml.match(new RegExp('<row[^>]* r="' + END_ROW + '"[^>]*>[\\s\\S]*?<\\/row>'));
    if (!match) throw new Error("Template row tidak ditemui.");
    var rows = "";
    for (var index = 1; index <= extraRows; index += 1) {
      rows += renumberRowXml(match[0], END_ROW + index);
    }
    return rows;
  }

  function renumberRowXml(rowXml, nextRowNumber) {
    return rowXml
      .replace(/<row([^>]*) r="\d+"/, '<row$1 r="' + nextRowNumber + '"')
      .replace(/([A-Z]+)\d+/g, function (_match, column) {
        return column + nextRowNumber;
      });
  }

  function shiftRowXml(rowXml, offset) {
    var rowMatch = rowXml.match(/<row[^>]* r="(\d+)"/);
    var nextRowNumber = Number(rowMatch ? rowMatch[1] : 0) + offset;
    return rowXml
      .replace(/<row([^>]*) r="\d+"/, '<row$1 r="' + nextRowNumber + '"')
      .replace(/([A-Z]+)(\d+)/g, function (_match, column, rawRow) {
        return column + (Number(rawRow) + offset);
      });
  }

  function updateMergeCells(xml, extraRows) {
    var extraMerges = Array.from({ length: extraRows }, function (_item, index) {
      var row = END_ROW + index + 1;
      return '<mergeCell ref="C' + row + ':G' + row + '"/>';
    }).join("");
    return xml.replace(/<mergeCells count="(\d+)">([\s\S]*?)<\/mergeCells>/, function (_match, rawCount, body) {
      var shiftedBody = body.replace(/ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g, function (_ref, startColumn, rawStart, endColumn, rawEnd) {
        var start = Number(rawStart);
        var end = Number(rawEnd);
        if (start > END_ROW) return 'ref="' + startColumn + (start + extraRows) + ":" + endColumn + (end + extraRows) + '"';
        return 'ref="' + startColumn + start + ":" + endColumn + end + '"';
      });
      return '<mergeCells count="' + (Number(rawCount) + extraRows) + '">' + shiftedBody + extraMerges + "</mergeCells>";
    });
  }

  function setCellValue(xml, cellRef, value) {
    if (value === undefined || value === "" || value === 0) return replaceCell(xml, cellRef, function (style) {
      return '<c r="' + cellRef + '"' + style + "/>";
    });
    if (typeof value === "number") return replaceCell(xml, cellRef, function (style) {
      return '<c r="' + cellRef + '"' + style + "><v>" + roundNumber(value) + "</v></c>";
    });
    return replaceCell(xml, cellRef, function (style) {
      return '<c r="' + cellRef + '"' + style + ' t="inlineStr"><is><t xml:space="preserve">' + escapeXml(value) + "</t></is></c>";
    });
  }

  function setCellFormula(xml, cellRef, formula, cachedValue) {
    return replaceCell(xml, cellRef, function (style) {
      return '<c r="' + cellRef + '"' + style + "><f>" + escapeXml(formula) + "</f><v>" + cachedValue + "</v></c>";
    });
  }

  function replaceCell(xml, cellRef, buildCell) {
    var escapedRef = cellRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var cellPattern = new RegExp('<c r="' + escapedRef + '"([^>]*)\\/>|<c r="' + escapedRef + '"([^>]*)>[\\s\\S]*?<\\/c>');
    return xml.replace(cellPattern, function (_match, selfClosingAttrs, fullAttrs) {
      var attrs = selfClosingAttrs || fullAttrs || "";
      var styleMatch = attrs.match(/\ss="[^"]+"/);
      return buildCell(styleMatch ? styleMatch[0] : "");
    });
  }

  function setRowHeight(xml, rowNumber, height) {
    var rowPattern = new RegExp('<row([^>]*) r="' + rowNumber + '"([^>]*)>');
    return xml.replace(rowPattern, function (_match, before, after) {
      var attrs = (before + after)
        .replace(/\sht="[^"]*"/g, "")
        .replace(/\scustomHeight="[^"]*"/g, "");
      return '<row' + attrs + ' r="' + rowNumber + '" ht="' + height + '" customHeight="1">';
    });
  }

  function getCellStyleIds(xml, cellRefs) {
    var ids = [];
    cellRefs.forEach(function (cellRef) {
      var escapedRef = cellRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var match = xml.match(new RegExp('<c r="' + escapedRef + '"([^>]*)'));
      if (!match) return;
      var style = match[1].match(/\ss="(\d+)"/);
      if (style) ids.push(Number(style[1]));
    });
    return Array.from(new Set(ids));
  }

  function ensureWrapStyles(stylesXml, styleIds) {
    if (!styleIds.length) return stylesXml;
    return stylesXml.replace(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/, function (_match, attrs, body) {
      var styles = body.match(/<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g) || [];
      styleIds.forEach(function (styleId) {
        if (styles[styleId]) styles[styleId] = withWrapAlignment(styles[styleId]);
      });
      return '<cellXfs' + attrs + '>' + styles.join("") + '</cellXfs>';
    });
  }

  function withWrapAlignment(styleXml) {
    var style = styleXml.replace(/\sapplyAlignment="[^"]*"/, "") .replace(/<xf\b/, '<xf applyAlignment="1"');
    if (/\/>$/.test(style)) return style.replace(/\/>$/, '><alignment wrapText="1" vertical="top"/></xf>');
    if (/<alignment\b[^>]*\/>/.test(style)) return style.replace(/<alignment\b[^>]*\/>/, '<alignment wrapText="1" vertical="top"/>');
    if (/<alignment\b[^>]*>[\s\S]*?<\/alignment>/.test(style)) return style.replace(/<alignment\b[^>]*>[\s\S]*?<\/alignment>/, '<alignment wrapText="1" vertical="top"/>');
    return style.replace(/<\/xf>$/, '<alignment wrapText="1" vertical="top"/></xf>');
  }

  function updateDimension(xml, lastRow) {
    return xml.replace(/<dimension ref="[^"]+"/, '<dimension ref="A1:Q' + lastRow + '"');
  }

  async function readZipEntries(buffer) {
    var bytes = new Uint8Array(buffer);
    var view = new DataView(buffer);
    var eocdOffset = findEndOfCentralDirectory(view);
    var centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
    var entryCount = view.getUint16(eocdOffset + 10, true);
    var entries = new Map();
    var cursor = centralDirectoryOffset;
    for (var index = 0; index < entryCount; index += 1) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Struktur template Excel tidak sah.");
      var method = view.getUint16(cursor + 10, true);
      var compressedSize = view.getUint32(cursor + 20, true);
      var fileNameLength = view.getUint16(cursor + 28, true);
      var extraLength = view.getUint16(cursor + 30, true);
      var commentLength = view.getUint16(cursor + 32, true);
      var localHeaderOffset = view.getUint32(cursor + 42, true);
      var name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
      var localNameLength = view.getUint16(localHeaderOffset + 26, true);
      var localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      var dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      var compressedData = bytes.slice(dataStart, dataStart + compressedSize);
      entries.set(name, method === 0 ? compressedData : await inflateRaw(compressedData));
      cursor += 46 + fileNameLength + extraLength + commentLength;
    }
    return entries;
  }

  function findEndOfCentralDirectory(view) {
    for (var offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 66000); offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    throw new Error("Template Excel tidak mempunyai struktur ZIP yang sah.");
  }

  async function inflateRaw(data) {
    if (!window.DecompressionStream) throw new Error("Browser ini tidak menyokong export template Excel.");
    var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function writeZipEntries(entries) {
    if (!window.JSZip) throw new Error("Komponen ZIP Excel tidak berjaya dimuatkan.");
    var zip = new window.JSZip();
    entries.forEach(function (data, name) {
      zip.file(name, data, { binary: true });
    });
    return zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      platform: "DOS"
    });
  }

  function buildLocalHeader(name, data) {
    var nameBytes = encoder.encode(name);
    var header = new Uint8Array(30 + nameBytes.length);
    var view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc32(data), true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);
    return header;
  }

  function buildCentralDirectoryHeader(name, data, offset) {
    var nameBytes = encoder.encode(name);
    var header = new Uint8Array(46 + nameBytes.length);
    var view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint32(16, crc32(data), true);
    view.setUint32(20, data.length, true);
    view.setUint32(24, data.length, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint32(42, offset, true);
    header.set(nameBytes, 46);
    return header;
  }

  function buildEndOfCentralDirectory(entryCount, centralDirectorySize, centralDirectoryOffset) {
    var bytes = new Uint8Array(22);
    var view = new DataView(bytes.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, entryCount, true);
    view.setUint16(10, entryCount, true);
    view.setUint32(12, centralDirectorySize, true);
    view.setUint32(16, centralDirectoryOffset, true);
    return bytes;
  }

  function concatUint8Arrays(parts) {
    var size = parts.reduce(function (sum, part) {
      return sum + part.length;
    }, 0);
    var output = new Uint8Array(size);
    var cursor = 0;
    parts.forEach(function (part) {
      output.set(part, cursor);
      cursor += part.length;
    });
    return output;
  }

  var crcTable = null;
  function crc32(data) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (var n = 0; n < 256; n += 1) {
        var c = n;
        for (var k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    var crc = 0xffffffff;
    for (var index = 0; index < data.length; index += 1) crc = crcTable[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function forceWorkbookRecalculation(xml) {
    if (xml.includes("<calcPr")) return xml.replace(/<calcPr[^>]*\/>/, '<calcPr calcMode="auto"/>');
    return xml.replace("</workbook>", '<calcPr calcMode="auto"/></workbook>');
  }

  function activateWorkbookSheet(xml, sheetIndex) {
    return xml.replace(/<workbookView\b([^>]*)>/, function (match, attrs) {
      var selfClosing = /\/\s*$/.test(attrs);
      var nextAttrs = attrs
        .replace(/\/\s*$/, "")
        .replace(/\sactiveTab="[^"]*"/, "")
        .replace(/\sfirstSheet="[^"]*"/, "");
      return "<workbookView" + nextAttrs + ' activeTab="' + sheetIndex + '" firstSheet="1"' + (selfClosing ? "/>" : ">");
    });
  }

  function emptyTemplateRow() {
    return makeTemplateRow({ week: 1, displayDateRange: "" }, "", {}, 0, "", "empty");
  }

  function formatHour(value) {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  }

  function roundNumber(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function safeFileName(value) {
    return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
