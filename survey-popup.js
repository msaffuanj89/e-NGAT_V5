import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { auth, db, persistenceReady } from "./auth-common.js";

const SURVEY_ID = "engat-usage-2026";
const THREE_MINUTES = 3 * 60 * 1000;
const SCALE_OPTIONS = [
  ["1", "Sangat tidak setuju"],
  ["2", "Tidak setuju"],
  ["3", "Setuju"],
  ["4", "Sangat setuju"],
  ["5", "Sangat-sangat setuju"],
];

const experienceQuestions = [
  "Saya kerap mengambil masa yang lama untuk mengagihkan jam Kuliah, Tutorial, Amali, dan Lain-lain (K/T/A/L) mengikut kriteria SLT dalam MK/RMK.",
  "Saya pernah tersilap mengira jumlah akumulasi jam interaksi mingguan sehingga tidak sepadan dengan jumlah keseluruhan jam SLT kursus.",
  "Pengiraan agihan jam bersemuka (Bersemuka F2F) dan tidak bersemuka (Non-F2F) bagi setiap tajuk dalam MK agak mengelirukan.",
  "Pengiraan agihan untuk Kuliah, Tutorial, Amali dan Lain-lain serta e-Pembelajaran bagi setiap tajuk dalam MK agak mengelirukan.",
  "Apabila berlaku cuti umum atau pelepasan am, saya sukar untuk mengira semula agihan jam ganti/pindaan tanpa mengganggu jumlah SLT asal.",
  "Saya terlepas pandang mengenai jam interaksi yang mesti dilaksanakan di luar jadual waktu.",
  "Saya terpaksa menyemak semula dokumen LAM-PT 03-01 dan LAM-PT 03-02 berkali-kali untuk memastikan tiada ralat dalam pengiraan jam sebelum dihantar kepada Ketua Jabatan/Auditor.",
];

const ratingGroups = [
  {
    title: "B. Kebolehgunaan Aplikasi (Usability & UI)",
    start: 8,
    questions: [
      "Aplikasi e-NGAT mudah digunakan.",
      "Proses memuat naik fail Excel MK adalah mudah dan cepat.",
      "Antaramuka dan paparan aplikasi adalah jelas serta tersusun.",
      "Arahan dan label fungsi dalam aplikasi mudah difahami.",
      "Aplikasi ini sesuai digunakan tanpa memerlukan kemahiran teknikal yang tinggi.",
    ],
  },
  {
    title: "C. Ketepatan Analisis Fail MK",
    start: 13,
    questions: [
      "Aplikasi berjaya membaca maklumat topik daripada fail Excel MK dengan tepat.",
      "Aplikasi berjaya membaca agihan jam (KF, KS, TF, TS, EP) dengan tepat.",
      "Susunan topik dan subtopik yang dipaparkan adalah tepat mengikut fail MK.",
      "Aplikasi tidak menambah jam kepada kategori yang bernilai 0 dalam fail Excel MK.",
      "Jumlah keseluruhan jam yang dipaparkan dalam aplikasi sepadan dengan maklumat asal fail MK.",
    ],
  },
  {
    title: "D. Penjanaan Rancangan Pengajaran",
    start: 18,
    questions: [
      "Rancangan Pengajaran dan Pembelajaran Semester yang dijana adalah jelas dan teratur.",
      "Agihan jam mengikut minggu adalah sesuai dan munasabah.",
      "Agihan kuliah, tutorial, dan e-Pembelajaran mengikut topik adalah tepat.",
      "Rancangan Pengajaran dan Pembelajaran Mingguan yang dijana membantu persediaan pengajaran.",
      "Fungsi muat turun dokumen (PDF) memudahkan penyimpanan dan perkongsian.",
    ],
  },
  {
    title: "E. Pengurusan Cuti dan Jadual Waktu",
    start: 23,
    questions: [
      "Fungsi jadual waktu kelas membantu menjana rancangan pengajaran dengan lebih tepat.",
      "Maklumat cuti umum dipaparkan dengan baik dan tepat.",
      "Aplikasi membantu mengesan dan menguruskan kelas yang jatuh pada hari cuti.",
    ],
  },
  {
    title: "F. Kepuasan Keseluruhan & Kecekapan (Efficiency)",
    start: 26,
    questions: [
      "Aplikasi ini berjaya menjimatkan masa penyediaan rancangan pengajaran.",
      "Aplikasi ini membantu mengurangkan kesilapan manusia semasa menyusun rancangan semester.",
      "Saya berpuas hati dengan fungsi keseluruhan aplikasi e-NGAT.",
      "Saya akan mengesyorkan aplikasi ini kepada rakan pensyarah yang lain.",
    ],
  },
];

const openQuestions = [
  "Apakah fungsi yang paling membantu anda dalam aplikasi e-NGAT?",
  "Apakah masalah atau kesukaran yang anda hadapi semasa menggunakan aplikasi ini?",
  "Apakah cadangan penambahbaikan untuk meningkatkan kualiti aplikasi e-NGAT?",
  "Komen atau ulasan tambahan (jika ada)",
];

let currentUser = null;
let surveyRef = null;
let surveyState = { deferUsed: false, completed: false, answers: {} };
let timer = null;
let modal = null;
let activeStep = 0;

function addStyles() {
  if (document.getElementById("engat-survey-modal-style")) return;
  const style = document.createElement("style");
  style.id = "engat-survey-modal-style";
  style.textContent = `
    .engat-survey-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:1rem;background:rgba(12,10,9,.72);backdrop-filter:blur(5px)}
    .engat-survey-dialog{width:min(100%,980px);height:min(92vh,850px);display:flex;flex-direction:column;overflow:hidden;border-radius:16px;background:#f8fafc;box-shadow:0 28px 80px rgba(0,0,0,.35)}
    .engat-survey-head{padding:1rem 1.25rem;border-bottom:1px solid #d6d3d1;background:#fff}
    .engat-survey-headline{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}
    .engat-survey-head h2{margin:0;color:#064e3b;font:750 1.25rem/1.25 system-ui}
    .engat-survey-head p{margin:.35rem 0 0;color:#57534e;font:400 .875rem/1.45 system-ui}
    .engat-survey-progress{height:7px;margin-top:.8rem;overflow:hidden;border-radius:99px;background:#e7e5e4}
    .engat-survey-progress span{display:block;height:100%;border-radius:inherit;background:#0f766e;transition:width .2s}
    .engat-survey-step-label{white-space:nowrap;color:#0f766e;font:700 .8rem system-ui}
    .engat-survey-form{flex:1;overflow:auto;padding:1rem}
    .engat-survey-section{display:grid;gap:1rem}
    .engat-survey-intro,.engat-survey-card{padding:1rem;border:1px solid #d6d3d1;border-radius:12px;background:#fff}
    .engat-survey-intro h3,.engat-survey-card h3{margin:0 0 .55rem;color:#1c1917;font:750 1rem/1.4 system-ui}
    .engat-survey-intro p{margin:.45rem 0;color:#44403c;font:400 .9rem/1.55 system-ui}
    .engat-survey-question{margin:0 0 .75rem;color:#1c1917;font:650 .92rem/1.5 system-ui}
    .engat-survey-required-mark{color:#dc2626}
    .engat-survey-input,.engat-survey-textarea{box-sizing:border-box;width:100%;border:1px solid #a8a29e;border-radius:8px;padding:.7rem .75rem;background:#fff;color:#1c1917;font:400 .9rem system-ui}
    .engat-survey-textarea{min-height:90px;resize:vertical}
    .engat-survey-options{display:grid;gap:.55rem}
    .engat-survey-option{display:flex;align-items:flex-start;gap:.6rem;color:#292524;font:400 .9rem/1.4 system-ui}
    .engat-survey-option input{width:1.05rem;height:1.05rem;margin:.08rem 0 0;accent-color:#0f766e}
    .engat-survey-scale{display:grid;grid-template-columns:repeat(5,minmax(48px,1fr));gap:.4rem}
    .engat-survey-scale label{display:grid;place-items:center;gap:.25rem;min-height:58px;padding:.35rem;border:1px solid #d6d3d1;border-radius:8px;color:#57534e;font:650 .72rem/1.15 system-ui;text-align:center;cursor:pointer}
    .engat-survey-scale label:has(input:checked){border-color:#0f766e;background:#ecfdf5;color:#065f46}
    .engat-survey-scale input{accent-color:#0f766e}
    .engat-survey-error{outline:2px solid #dc2626;outline-offset:2px}
    .engat-survey-actions{display:flex;align-items:center;justify-content:space-between;gap:.65rem;padding:1rem 1.25rem;border-top:1px solid #d6d3d1;background:#fff}
    .engat-survey-actions-side{display:flex;gap:.65rem}
    .engat-survey-action{min-height:42px;border:0;border-radius:8px;padding:.65rem 1rem;font:700 .875rem system-ui;cursor:pointer}
    .engat-survey-action--later,.engat-survey-action--back{color:#44403c;background:#e7e5e4}
    .engat-survey-action--next{color:#fff;background:#0f766e}
    .engat-survey-action:disabled{cursor:wait;opacity:.65}
    .engat-survey-required{color:#9f1239!important;font-weight:650!important}
    @media(max-width:640px){.engat-survey-overlay{padding:0}.engat-survey-dialog{height:100vh;max-height:none;border-radius:0}.engat-survey-head{padding:.8rem 1rem}.engat-survey-form{padding:.75rem}.engat-survey-actions{padding:.75rem;flex-wrap:wrap}.engat-survey-actions-side{margin-left:auto}.engat-survey-action{padding:.6rem .75rem}.engat-survey-scale label{font-size:.65rem}}
  `;
  document.head.appendChild(style);
}

function requiredMark() {
  const mark = document.createElement("span");
  mark.className = "engat-survey-required-mark";
  mark.textContent = " *";
  return mark;
}

function card(question, required = true) {
  const box = document.createElement("section");
  box.className = "engat-survey-card";
  const label = document.createElement("p");
  label.className = "engat-survey-question";
  label.textContent = question;
  if (required) label.appendChild(requiredMark());
  box.appendChild(label);
  return box;
}

function textField(name, question, options = {}) {
  const box = card(question, options.required !== false);
  const input = document.createElement(options.multiline ? "textarea" : "input");
  input.className = options.multiline ? "engat-survey-textarea" : "engat-survey-input";
  input.name = name;
  input.required = options.required !== false;
  input.value = String(surveyState.answers?.[name] || "");
  if (options.multiline) input.rows = 4;
  box.appendChild(input);
  return box;
}

function radioField(name, question, options, required = true) {
  const box = card(question, required);
  const choices = document.createElement("div");
  choices.className = "engat-survey-options";
  options.forEach((option) => {
    const label = document.createElement("label");
    label.className = "engat-survey-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = option;
    input.required = required;
    input.checked = surveyState.answers?.[name] === option;
    label.append(input, document.createTextNode(option));
    choices.appendChild(label);
  });
  box.appendChild(choices);
  return box;
}

function scaleField(name, question) {
  const box = card(question, true);
  const choices = document.createElement("div");
  choices.className = "engat-survey-scale";
  SCALE_OPTIONS.forEach(([value, labelText]) => {
    const label = document.createElement("label");
    label.title = labelText;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = value;
    input.required = true;
    input.checked = String(surveyState.answers?.[name] || "") === value;
    const text = document.createElement("span");
    text.textContent = value;
    label.append(input, text);
    choices.appendChild(label);
  });
  box.appendChild(choices);
  return box;
}

function createSection(step) {
  const section = document.createElement("div");
  section.className = "engat-survey-section";
  section.dataset.step = String(step);

  if (step === 0) {
    const intro = document.createElement("section");
    intro.className = "engat-survey-intro";
    intro.innerHTML = `<h3>Soal Selidik Kebolehgunaan Aplikasi e‑NGAT</h3>
      <p>Assalamualaikum dan Salam Sejahtera. Saya Muhammad Saffuan bin Jaffar, pensyarah dari IPG Kampus Pulau Pinang.</p>
      <p>Aplikasi ini direka untuk mempermudah penyediaan Rancangan Pengajaran Semester dan Mingguan secara automatik berdasarkan fail Excel Maklumat Kursus (MK).</p>
      <p>Maklum balas anda membantu kami menilai ketepatan data, kemudahan penggunaan dan penambahbaikan fungsi aplikasi. Borang ini mengambil masa kira-kira 5 minit. Semua maklumat adalah <strong>SULIT</strong>.</p>`;
    section.appendChild(intro);
    return section;
  }

  if (step === 1) {
    const heading = document.createElement("section");
    heading.className = "engat-survey-intro";
    heading.innerHTML = "<h3>Maklumat Pengguna</h3><p>Sila lengkapkan maklumat berikut.</p>";
    section.append(
      heading,
      textField("ipgKampus", "1. IPG Kampus"),
      radioField("pengalamanMengajar", "2. Pengalaman Mengajar di IPG", [
        "Kurang daripada 3 tahun",
        "3 hingga 5 tahun",
        "6 hingga 10 tahun",
        "Lebih 10 tahun",
      ], false),
      textField("jabatan", "3. Jabatan Tempat Berkhidmat", { required: false }),
      radioField("program", "4. Program Berkaitan", ["PPISMP", "PISMP", "PDPP", "Lain-lain"]),
      radioField("pernahManual", "5. Pernahkah anda menyediakan Rancangan Pengajaran Semester secara manual sebelum ini?", ["Ya", "Tidak"])
    );
    return section;
  }

  if (step === 2) {
    const heading = document.createElement("section");
    heading.className = "engat-survey-intro";
    heading.innerHTML = "<h3>Pengalaman Menyediakan LAM‑PT 03‑01 dan LAM‑PT 03‑02</h3><p>Skala 1 = Sangat tidak setuju hingga 5 = Sangat-sangat setuju.</p>";
    section.appendChild(heading);
    experienceQuestions.forEach((question, index) => {
      section.appendChild(scaleField(`pengalaman${index + 1}`, `${index + 1}. ${question}`));
    });
    return section;
  }

  const heading = document.createElement("section");
  heading.className = "engat-survey-intro";
  heading.innerHTML = "<h3>Penilaian Aplikasi e‑NGAT</h3><p>Skala 1 = Sangat tidak setuju (STS), 2 = Tidak setuju (TS), 3 = Setuju (S), 4 = Sangat setuju (ST), 5 = Sangat-sangat setuju (SST).</p>";
  section.append(
    heading,
    radioField("peranti", "8. Peranti utama yang digunakan untuk mengakses aplikasi", [
      "Laptop / Komputer",
      "Telefon pintar",
      "Tablet",
    ])
  );
  ratingGroups.forEach((group) => {
    const groupHeading = document.createElement("section");
    groupHeading.className = "engat-survey-intro";
    groupHeading.innerHTML = `<h3>${group.title}</h3>`;
    section.appendChild(groupHeading);
    group.questions.forEach((question, index) => {
      const number = group.start + index;
      section.appendChild(scaleField(`penilaian${number}`, `${number}. ${question}`));
    });
  });
  openQuestions.forEach((question, index) => {
    section.appendChild(textField(`ulasan${30 + index}`, `${30 + index}. ${question}`, { multiline: true }));
  });
  return section;
}

function setBusy(value) {
  if (!modal) return;
  modal.querySelectorAll("button").forEach((button) => {
    button.disabled = value;
  });
}

function closeModal() {
  if (!modal) return;
  modal.remove();
  modal = null;
  document.body.style.overflow = "";
}

function collectCurrentAnswers() {
  if (!modal) return;
  const data = new FormData(modal.querySelector("form"));
  surveyState.answers = { ...(surveyState.answers || {}) };
  for (const [key, value] of data.entries()) surveyState.answers[key] = String(value).trim();
}

async function saveState(nextState) {
  surveyState = { ...surveyState, ...nextState };
  await setDoc(
    surveyRef,
    {
      surveyId: SURVEY_ID,
      deferUsed: Boolean(surveyState.deferUsed),
      completed: Boolean(surveyState.completed),
      deferredAt: surveyState.deferUsed ? surveyState.deferredAt || serverTimestamp() : null,
      completedAt: surveyState.completed ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
      answers: surveyState.answers || {},
    },
    { merge: true }
  );
}

function validateStep() {
  const section = modal.querySelector(`.engat-survey-section[data-step="${activeStep}"]`);
  const firstInvalid = Array.from(section.querySelectorAll("input,textarea")).find(
    (field) => !field.checkValidity()
  );
  section.querySelectorAll(".engat-survey-error").forEach((item) => item.classList.remove("engat-survey-error"));
  if (!firstInvalid) return true;
  const parent = firstInvalid.closest(".engat-survey-card");
  if (parent) parent.classList.add("engat-survey-error");
  firstInvalid.reportValidity();
  firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
  return false;
}

function renderStep() {
  const form = modal.querySelector("form");
  form.replaceChildren(createSection(activeStep));
  modal.querySelector(".engat-survey-step-label").textContent = `Bahagian ${activeStep + 1} daripada 4`;
  modal.querySelector(".engat-survey-progress span").style.width = `${((activeStep + 1) / 4) * 100}%`;
  const back = modal.querySelector("[data-survey-back]");
  const next = modal.querySelector("[data-survey-next]");
  back.hidden = activeStep === 0;
  next.textContent = activeStep === 3 ? "Hantar soal selidik" : "Seterusnya";
  form.scrollTop = 0;
}

async function submitSurvey() {
  collectCurrentAnswers();
  setBusy(true);
  try {
    await saveState({ completed: true });
    closeModal();
    window.alert("Terima kasih. Jawapan soal selidik anda telah berjaya dihantar.");
  } catch (error) {
    console.error("e-NGAT survey save failed:", error);
    setBusy(false);
    window.alert("Jawapan belum dapat disimpan. Sila cuba semula sebentar lagi.");
  }
}

function showSurvey(force = false) {
  if (!currentUser || modal || (surveyState.completed && !force)) return;
  const compulsory = surveyState.deferUsed && !surveyState.completed;
  activeStep = 0;
  addStyles();
  document.body.style.overflow = "hidden";
  modal = document.createElement("div");
  modal.className = "engat-survey-overlay";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "engat-survey-title");
  modal.innerHTML = `
    <section class="engat-survey-dialog">
      <header class="engat-survey-head">
        <div class="engat-survey-headline">
          <div><h2 id="engat-survey-title">Soal Selidik Penggunaan e‑NGAT</h2><p></p></div>
          <span class="engat-survey-step-label"></span>
        </div>
        <div class="engat-survey-progress" aria-hidden="true"><span></span></div>
      </header>
      <form class="engat-survey-form"></form>
      <footer class="engat-survey-actions">
        <div data-survey-later></div>
        <div class="engat-survey-actions-side">
          <button type="button" class="engat-survey-action engat-survey-action--back" data-survey-back>Kembali</button>
          <button type="button" class="engat-survey-action engat-survey-action--next" data-survey-next>Seterusnya</button>
        </div>
      </footer>
    </section>`;
  const note = modal.querySelector(".engat-survey-head p");
  note.textContent = compulsory
    ? "Pilihan “Kemudian” telah digunakan. Sila lengkapkan soal selidik ini untuk meneruskan penggunaan."
    : surveyState.completed
      ? "Jawapan terdahulu telah dimuatkan. Anda boleh mengemas kini dan menghantarnya semula."
      : "Maklum balas anda membantu penambahbaikan e‑NGAT. Anda boleh memilih “Kemudian” sekali sahaja.";
  if (compulsory) note.className = "engat-survey-required";

  if (!compulsory && !surveyState.completed) {
    const later = document.createElement("button");
    later.type = "button";
    later.className = "engat-survey-action engat-survey-action--later";
    later.textContent = "Kemudian";
    later.addEventListener("click", async () => {
      collectCurrentAnswers();
      setBusy(true);
      try {
        await saveState({ deferUsed: true, deferredAt: serverTimestamp() });
        closeModal();
        scheduleSurvey();
      } catch (_) {
        setBusy(false);
        window.alert("Status soal selidik tidak dapat disimpan. Sila cuba lagi.");
      }
    });
    modal.querySelector("[data-survey-later]").appendChild(later);
  }

  modal.querySelector("[data-survey-back]").addEventListener("click", () => {
    collectCurrentAnswers();
    activeStep -= 1;
    renderStep();
  });
  modal.querySelector("[data-survey-next]").addEventListener("click", async () => {
    if (!validateStep()) return;
    collectCurrentAnswers();
    if (activeStep < 3) {
      activeStep += 1;
      renderStep();
    } else {
      await submitSurvey();
    }
  });
  document.body.appendChild(modal);
  renderStep();
  modal.querySelector("[data-survey-next]").focus();
}

function scheduleSurvey() {
  window.clearTimeout(timer);
  if (!surveyState.completed) timer = window.setTimeout(() => showSurvey(), THREE_MINUTES);
}

function connectExistingButton() {
  const button = document.querySelector('[data-engat-survey-link="true"]');
  if (!button || button.dataset.engatPopupReady) return;
  button.dataset.engatPopupReady = "true";
  button.removeAttribute("target");
  button.href = "#soal-selidik";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (currentUser) showSurvey(true);
  });
}

new MutationObserver(connectExistingButton).observe(document.documentElement, {
  childList: true,
  subtree: true,
});

await persistenceReady;
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  window.clearTimeout(timer);
  closeModal();
  if (!user) return;
  surveyRef = doc(db, "users", user.uid, "survey", SURVEY_ID);
  try {
    const snapshot = await getDoc(surveyRef);
    surveyState = snapshot.exists()
      ? { deferUsed: false, completed: false, answers: {}, ...snapshot.data() }
      : { deferUsed: false, completed: false, answers: {} };
  } catch (_) {
    surveyState = { deferUsed: false, completed: false, answers: {} };
  }
  connectExistingButton();
  scheduleSurvey();
});
