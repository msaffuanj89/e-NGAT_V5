import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  ADMIN_EMAIL,
  auth,
  cleanEmail,
  db,
  friendlyAuthError,
  persistenceReady,
  setStatus,
} from "./auth-common.js";

const loginView = document.querySelector("#admin-login-view");
const dashboard = document.querySelector("#admin-dashboard");
const loginForm = document.querySelector("#admin-login-form");
const loginButton = document.querySelector("#admin-login-button");
const loginStatus = document.querySelector("#admin-login-status");
const adminStatus = document.querySelector("#admin-status");
const usersBody = document.querySelector("#users-body");
const summary = document.querySelector("#admin-summary");
const search = document.querySelector("#user-search");
const metricUsers = document.querySelector("#metric-users");
const metricSessions = document.querySelector("#metric-sessions");
const metricActive = document.querySelector("#metric-active");
const metricSurvey = document.querySelector("#metric-survey");
const courseAnalysis = document.querySelector("#course-analysis");
const ipgAnalysis = document.querySelector("#ipg-analysis");
const surveyAnalysis = document.querySelector("#survey-analysis");
const surveyAnswerAnalysis = document.querySelector("#survey-answer-analysis");
const reportAnalysis = document.querySelector("#report-analysis");
let users = [];
let usageEvents = [];
let reports = [];

const SURVEY_GROUPS = [
  {
    title: "Maklumat pengguna",
    items: [
      ["ipgKampus", "IPG Kampus", "choice"],
      ["pengalamanMengajar", "Pengalaman Mengajar di IPG", "choice"],
      ["jabatan", "Jabatan Tempat Berkhidmat", "choice"],
      ["program", "Program Berkaitan", "choice"],
      ["pernahManual", "Pernah menyediakan Rancangan Pengajaran Semester secara manual", "choice"],
      ["peranti", "Peranti utama untuk mengakses aplikasi", "choice"],
    ],
  },
  {
    title: "Pengalaman menyediakan LAM‑PT",
    items: [
      ["pengalaman1", "Masa yang lama untuk mengagihkan jam K/T/A/L", "scale"],
      ["pengalaman2", "Pernah tersilap mengira akumulasi jam interaksi mingguan", "scale"],
      ["pengalaman3", "Agihan jam F2F dan Non-F2F mengelirukan", "scale"],
      ["pengalaman4", "Agihan K/T/A/L dan e-Pembelajaran mengelirukan", "scale"],
      ["pengalaman5", "Sukar mengira semula agihan ketika cuti", "scale"],
      ["pengalaman6", "Terlepas pandang jam interaksi di luar jadual", "scale"],
      ["pengalaman7", "Perlu menyemak LAM-PT berkali-kali", "scale"],
    ],
  },
  {
    title: "Kebolehgunaan Aplikasi",
    items: [
      ["penilaian8", "Aplikasi e-NGAT mudah digunakan", "scale"],
      ["penilaian9", "Proses muat naik fail Excel MK mudah dan cepat", "scale"],
      ["penilaian10", "Antaramuka jelas dan tersusun", "scale"],
      ["penilaian11", "Arahan dan label mudah difahami", "scale"],
      ["penilaian12", "Sesuai tanpa kemahiran teknikal tinggi", "scale"],
    ],
  },
  {
    title: "Ketepatan Analisis Fail MK",
    items: [
      ["penilaian13", "Membaca maklumat topik dengan tepat", "scale"],
      ["penilaian14", "Membaca agihan jam KF, KS, TF, TS dan EP dengan tepat", "scale"],
      ["penilaian15", "Susunan topik dan subtopik tepat", "scale"],
      ["penilaian16", "Tidak menambah jam kepada kategori bernilai 0", "scale"],
      ["penilaian17", "Jumlah jam sepadan dengan fail MK", "scale"],
    ],
  },
  {
    title: "Penjanaan Rancangan Pengajaran",
    items: [
      ["penilaian18", "Rancangan Semester jelas dan teratur", "scale"],
      ["penilaian19", "Agihan jam mingguan sesuai dan munasabah", "scale"],
      ["penilaian20", "Agihan kuliah, tutorial dan e-Pembelajaran tepat", "scale"],
      ["penilaian21", "Rancangan Mingguan membantu persediaan", "scale"],
      ["penilaian22", "Muat turun PDF memudahkan simpanan dan perkongsian", "scale"],
    ],
  },
  {
    title: "Pengurusan Cuti dan Jadual Waktu",
    items: [
      ["penilaian23", "Jadual waktu membantu ketepatan rancangan", "scale"],
      ["penilaian24", "Maklumat cuti umum dipaparkan dengan tepat", "scale"],
      ["penilaian25", "Membantu mengurus kelas pada hari cuti", "scale"],
    ],
  },
  {
    title: "Kepuasan Keseluruhan dan Kecekapan",
    items: [
      ["penilaian26", "Menjimatkan masa penyediaan rancangan", "scale"],
      ["penilaian27", "Mengurangkan kesilapan manusia", "scale"],
      ["penilaian28", "Berpuas hati dengan e-NGAT", "scale"],
      ["penilaian29", "Akan mengesyorkan kepada rakan pensyarah", "scale"],
    ],
  },
  {
    title: "Ulasan pengguna",
    items: [
      ["ulasan30", "Fungsi yang paling membantu", "text"],
      ["ulasan31", "Masalah atau kesukaran", "text"],
      ["ulasan32", "Cadangan penambahbaikan", "text"],
      ["ulasan33", "Komen atau ulasan tambahan", "text"],
    ],
  },
];

async function ensureAdminProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return snapshot.data();
  if (cleanEmail(user.email) !== ADMIN_EMAIL) return null;
  const profile = {
    uid: user.uid,
    fullName: user.displayName || "Pentadbir e-NGAT",
    birthDate: "",
    ipg: "",
    email: ADMIN_EMAIL,
    role: "admin",
    active: true,
    approvalStatus: "approved",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return profile;
}

async function checkAdmin(user) {
  const profile = await ensureAdminProfile(user);
  return profile && profile.role === "admin" && profile.active !== false;
}

function timestampDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateLabel(value) {
  const date = timestampDate(value);
  return date
    ? new Intl.DateTimeFormat("ms-MY", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : "—";
}

function renderBreakdown(container, entries, emptyText) {
  container.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "auth-note";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  const total = entries.reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
  const largest = Math.max(...entries.map(([, value]) => Number(value) || 0), 1);
  for (const [label, value] of entries) {
    const numericValue = Number(value) || 0;
    const percentage = total ? (numericValue / total) * 100 : 0;
    const row = document.createElement("div");
    row.className = "admin-breakdown-row";
    const name = document.createElement("span");
    name.className = "admin-breakdown-label";
    name.textContent = label;
    name.title = label;
    const track = document.createElement("span");
    track.className = "admin-breakdown-track";
    const fill = document.createElement("span");
    fill.className = "admin-breakdown-fill";
    fill.style.width = `${(numericValue / largest) * 100}%`;
    track.appendChild(fill);
    const count = document.createElement("span");
    count.className = "admin-breakdown-value";
    count.textContent = `${numericValue} (${Math.round(percentage)}%)`;
    row.append(name, track, count);
    container.appendChild(row);
  }
}

function renderUsers(filter = "") {
  const needle = cleanEmail(filter);
  const visible = users.filter((user) =>
    [user.fullName, user.email, user.ipg].some((value) =>
      String(value || "").toLowerCase().includes(needle)
    )
  );
  usersBody.replaceChildren();
  for (const user of visible) {
    const row = document.createElement("tr");
    const values = [
      user.fullName || "—",
      user.email || "—",
      user.ipg || "—",
      `${user.usageCount || 0} sesi / ${user.activeDays || 0} hari`,
      user.latestCourse || "—",
      dateLabel(user.lastUsedAt),
      user.surveyStatus || "Belum selesai",
    ];
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    const roleCell = document.createElement("td");
    const roleBadge = document.createElement("span");
    roleBadge.className = "admin-badge";
    roleBadge.textContent = user.role === "admin" ? "Admin" : "Pengguna";
    roleCell.appendChild(roleBadge);
    row.appendChild(roleCell);

    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");
    const userStatus = user.approvalStatus || (user.active === false ? "disabled" : "approved");
    statusBadge.className = "admin-badge" + (userStatus !== "approved" ? " admin-badge--off" : "");
    statusBadge.textContent = userStatus === "pending"
      ? "Menunggu pengesahan"
      : userStatus === "disabled"
        ? "Tidak aktif"
        : "Disahkan";
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    const actionCell = document.createElement("td");
    if (user.role !== "admin") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-mini " + (userStatus === "approved" ? "admin-mini--off" : "admin-mini--on");
      button.textContent = userStatus === "pending"
        ? "Sahkan pendaftaran"
        : userStatus === "disabled"
          ? "Aktifkan semula"
          : "Nyahaktifkan";
      button.addEventListener("click", () => toggleUser(user, button));
      actionCell.appendChild(button);
    } else {
      actionCell.textContent = "—";
    }
    row.appendChild(actionCell);
    usersBody.appendChild(row);
  }
  summary.textContent = `${users.length} akaun berdaftar · ${usageEvents.length} sesi penggunaan direkodkan · ${visible.length} pengguna dipaparkan`;
}

async function loadUsers() {
  const userSnapshot = await getDocs(collection(db, "users"));
  let usageSnapshot = null;
  try {
    usageSnapshot = await getDocs(collection(db, "usageEvents"));
  } catch (_) {
    usageSnapshot = { docs: [] };
  }
  users = userSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  usageEvents = usageSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  try {
    const reportSnapshot = await getDocs(collection(db, "reports"));
    reports = reportSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (_) {
    reports = [];
  }

  const surveySnapshots = await Promise.all(
    users.map(async (user) => {
      try {
        return await getDoc(doc(db, "users", user.id, "survey", "engat-usage-2026"));
      } catch (_) {
        return null;
      }
    })
  );
  const surveyByUid = new Map(
    surveySnapshots.map((snapshot, index) => [
      users[index].id,
      snapshot && snapshot.exists() ? snapshot.data() : null,
    ])
  );

  for (const user of users) {
    const events = usageEvents.filter((event) => event.uid === user.id);
    const datedEvents = events
      .map((event) => ({ ...event, date: timestampDate(event.lastActiveAt || event.startedAt) }))
      .sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
    const courseEvent = datedEvents.find((event) => event.courseCode || event.courseName);
    const survey = surveyByUid.get(user.id);
    user.usageCount = events.length;
    user.activeDays = new Set(events.map((event) => event.sessionDate).filter(Boolean)).size;
    user.lastUsedAt = datedEvents[0] ? datedEvents[0].lastActiveAt || datedEvents[0].startedAt : null;
    user.latestCourse = courseEvent
      ? [courseEvent.courseCode, courseEvent.courseName].filter(Boolean).join(" — ")
      : "";
    user.surveyStatus = survey && survey.completed
      ? "Selesai"
      : survey && survey.deferUsed
        ? "Ditangguh"
        : "Belum selesai";
    user.surveyAnswers = survey && survey.completed && survey.answers
      ? survey.answers
      : null;
  }

  users.sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "ms"));
  renderAnalytics();
  renderReports();
  renderUsers(search.value);
}

function reportDate(value) {
  if (!value) return "-";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ms-MY");
}

function renderReports() {
  if (!reportAnalysis) return;
  reportAnalysis.replaceChildren();
  const ordered = [...reports].sort((a, b) => {
    const left = a.createdAt && typeof a.createdAt.toMillis === "function" ? a.createdAt.toMillis() : 0;
    const right = b.createdAt && typeof b.createdAt.toMillis === "function" ? b.createdAt.toMillis() : 0;
    return right - left;
  });
  if (!ordered.length) {
    const empty = document.createElement("p");
    empty.className = "auth-note";
    empty.textContent = "Belum ada laporan masalah diterima.";
    reportAnalysis.appendChild(empty);
    return;
  }
  ordered.forEach((report) => {
    const card = document.createElement("article");
    card.className = "admin-report";
    const content = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = report.category || "Lain-lain";
    const description = document.createElement("p");
    description.textContent = report.description || "Tiada penerangan.";
    const meta = document.createElement("div");
    meta.className = "admin-report-meta";
    meta.textContent = `${report.email || "Pengguna"} · ${reportDate(report.createdAt)} · ${report.status || "new"}`;
    content.append(title, description, meta);
    card.appendChild(content);
    if (report.screenshot && report.screenshot.dataUrl) {
      const image = document.createElement("img");
      image.src = report.screenshot.dataUrl;
      image.alt = "Tangkap layar laporan";
      image.addEventListener("click", () => window.open(report.screenshot.dataUrl, "_blank", "noopener"));
      card.appendChild(image);
    }
    reportAnalysis.appendChild(card);
  });
}

function answerValues(key) {
  return users
    .filter((user) => user.role !== "admin" && user.surveyAnswers)
    .map((user) => user.surveyAnswers[key])
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function choiceSummary(values) {
  const counts = new Map();
  values.forEach((value) => {
    const label = String(value).trim();
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label}: ${count}`)
    .join(" · ");
}

function answerCounts(values) {
  const counts = new Map();
  values.forEach((value) => {
    const label = String(value).trim();
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function createChartRow(label, count, total, colorIndex = 0) {
  const percentage = total ? (count / total) * 100 : 0;
  const row = document.createElement("div");
  row.className = "admin-chart-row";

  const chartLabel = document.createElement("div");
  chartLabel.className = "admin-chart-label";
  chartLabel.textContent = label;

  const track = document.createElement("div");
  track.className = "admin-chart-track";
  const fill = document.createElement("span");
  fill.className = `admin-chart-fill admin-chart-fill--${(colorIndex % 5) + 1}`;
  fill.style.width = `${percentage}%`;
  fill.setAttribute("aria-label", `${label}: ${count} jawapan, ${percentage.toFixed(1)} peratus`);
  track.appendChild(fill);

  const value = document.createElement("div");
  value.className = "admin-chart-value";
  value.textContent = `${count} (${Math.round(percentage)}%)`;
  row.append(chartLabel, track, value);
  return row;
}

function renderSurveyAnswerAnalysis() {
  surveyAnswerAnalysis.replaceChildren();
  const completed = users.filter(
    (user) => user.role !== "admin" && user.surveyAnswers
  ).length;
  if (!completed) {
    const empty = document.createElement("p");
    empty.className = "auth-note";
    empty.textContent = "Belum ada jawapan lengkap untuk dianalisis.";
    surveyAnswerAnalysis.appendChild(empty);
    return;
  }

  for (const group of SURVEY_GROUPS) {
    const section = document.createElement("section");
    section.className = "admin-survey-section";
    const heading = document.createElement("h4");
    heading.textContent = group.title;
    section.appendChild(heading);

    for (const [key, question, type] of group.items) {
      const values = answerValues(key);
      const item = document.createElement("article");
      item.className = "admin-survey-item";
      const header = document.createElement("div");
      header.className = "admin-survey-item-header";
      const label = document.createElement("div");
      label.className = "admin-survey-question";
      label.textContent = question;
      header.appendChild(label);

      if (type === "scale") {
        const numeric = values.map(Number).filter((value) => value >= 1 && value <= 5);
        const counts = [1, 2, 3, 4, 5].map(
          (score) => numeric.filter((value) => value === score).length
        );
        const score = document.createElement("div");
        score.className = "admin-survey-score";
        const average = numeric.length
          ? numeric.reduce((total, value) => total + value, 0) / numeric.length
          : 0;
        score.textContent = numeric.length
          ? `Purata ${average.toFixed(2)} · ${numeric.length} respons`
          : "Tiada jawapan";
        header.appendChild(score);

        const chart = document.createElement("div");
        chart.className = "admin-survey-chart";
        counts.forEach((count, index) => {
          chart.appendChild(createChartRow(String(index + 1), count, numeric.length, index));
        });
        const legend = document.createElement("div");
        legend.className = "admin-chart-legend";
        legend.textContent = "1 = Sangat tidak setuju · 5 = Sangat-sangat setuju";
        item.append(header, chart, legend);
      } else if (type === "choice") {
        const score = document.createElement("div");
        score.className = "admin-survey-score";
        score.textContent = values.length ? `${values.length} respons` : "Tiada jawapan";
        header.appendChild(score);
        const chart = document.createElement("div");
        chart.className = "admin-survey-chart admin-survey-chart--choice";
        answerCounts(values).forEach(([choice, count], index) => {
          chart.appendChild(createChartRow(choice, count, values.length, index));
        });
        item.append(header, chart);
      } else {
        const comments = document.createElement("div");
        comments.className = "admin-comments";
        values.forEach((value) => {
          const comment = document.createElement("p");
          comment.className = "admin-comment";
          comment.textContent = String(value);
          comments.appendChild(comment);
        });
        if (!values.length) {
          const empty = document.createElement("span");
          empty.className = "admin-survey-score";
          empty.textContent = "Tiada jawapan";
          comments.appendChild(empty);
        }
        item.append(header, comments);
      }
      section.appendChild(item);
    }
    surveyAnswerAnalysis.appendChild(section);
  }
}

function renderAnalytics() {
  const regularUsers = users.filter((user) => user.role !== "admin");
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeUids = new Set(
    usageEvents
      .filter((event) => {
        const date = timestampDate(event.lastActiveAt || event.startedAt);
        return date && date.getTime() >= sevenDaysAgo;
      })
      .map((event) => event.uid)
  );
  const surveyCompleted = regularUsers.filter((user) => user.surveyStatus === "Selesai").length;
  metricUsers.textContent = String(regularUsers.length);
  metricSessions.textContent = String(usageEvents.length);
  metricActive.textContent = String(activeUids.size);
  metricSurvey.textContent = regularUsers.length
    ? `${Math.round((surveyCompleted / regularUsers.length) * 100)}%`
    : "0%";

  const ipgCounts = new Map();
  for (const user of regularUsers) {
    const label = String(user.ipg || "Tidak dinyatakan").trim() || "Tidak dinyatakan";
    ipgCounts.set(label, (ipgCounts.get(label) || 0) + 1);
  }
  renderBreakdown(
    ipgAnalysis,
    Array.from(ipgCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ms")),
    "Belum ada pensyarah berdaftar."
  );

  const courseCounts = new Map();
  for (const event of usageEvents) {
    const label = [event.courseCode, event.courseName].filter(Boolean).join(" — ");
    if (label) courseCounts.set(label, (courseCounts.get(label) || 0) + 1);
  }
  renderBreakdown(
    courseAnalysis,
    Array.from(courseCounts.entries()).sort((a, b) => b[1] - a[1]),
    "Belum ada fail MK direkodkan."
  );

  const surveyCounts = new Map([
    ["Selesai", regularUsers.filter((user) => user.surveyStatus === "Selesai").length],
    ["Ditangguh", regularUsers.filter((user) => user.surveyStatus === "Ditangguh").length],
    ["Belum selesai", regularUsers.filter((user) => user.surveyStatus === "Belum selesai").length],
  ]);
  renderBreakdown(surveyAnalysis, Array.from(surveyCounts.entries()), "Belum ada data soal selidik.");
  renderSurveyAnswerAnalysis();
}

async function toggleUser(user, button) {
  button.disabled = true;
  try {
    const currentStatus = user.approvalStatus || (user.active === false ? "disabled" : "approved");
    const approving = currentStatus !== "approved";
    await updateDoc(doc(db, "users", user.id), {
      active: approving,
      approvalStatus: approving ? "approved" : "disabled",
      updatedAt: serverTimestamp(),
    });
    user.active = approving;
    user.approvalStatus = approving ? "approved" : "disabled";
    renderUsers(search.value);
    setStatus(adminStatus, "Status pengguna berjaya dikemas kini.", "success");
  } catch (error) {
    setStatus(adminStatus, friendlyAuthError(error), "error");
    button.disabled = false;
  }
}

async function showDashboard(user) {
  if (!(await checkAdmin(user))) {
    await signOut(auth);
    setStatus(loginStatus, "Akaun ini bukan akaun pentadbir.", "error");
    loginView.hidden = false;
    dashboard.hidden = true;
    return;
  }
  loginView.hidden = true;
  dashboard.hidden = false;
  await loadUsers();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  const email = cleanEmail(data.get("email"));
  const password = String(data.get("password") || "");
  loginButton.disabled = true;
  loginButton.textContent = "Menyemak akses...";
  try {
    await persistenceReady;
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await showDashboard(credential.user);
  } catch (error) {
    setStatus(loginStatus, friendlyAuthError(error), "error");
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Log masuk sebagai pentadbir";
  }
});

document.querySelector("#admin-logout").addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("./admin.html");
});
search.addEventListener("input", () => renderUsers(search.value));

await persistenceReady;
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      await showDashboard(user);
    } catch (_) {
      setStatus(adminStatus, "");
      summary.textContent = "Maklumat pengguna belum dapat dimuatkan. Sila cuba muat semula halaman.";
    }
  }
});
