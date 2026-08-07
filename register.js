import { createUserWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  ADMIN_EMAIL,
  auth,
  cleanEmail,
  db,
  friendlyAuthError,
  persistenceReady,
  setStatus,
} from "./auth-common.js";

const form = document.querySelector("#register-form");
const status = document.querySelector("#status");
const submitButton = document.querySelector("#submit-button");
document.querySelector("#birth-date").max = new Date().toISOString().slice(0, 10);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function showRegistrationConfirmation(fullName, email) {
  const modal = document.createElement("div");
  modal.className = "registration-confirmation";
  modal.innerHTML = `
    <section class="registration-confirmation__panel" role="dialog" aria-modal="true" aria-labelledby="registration-confirmation-title">
      <div class="registration-confirmation__icon" aria-hidden="true">✓</div>
      <p class="auth-eyebrow">Pendaftaran berjaya</p>
      <h2 id="registration-confirmation-title">Sahkan pendaftaran anda</h2>
      <p>Akaun <strong>${escapeHtml(fullName)}</strong> telah didaftarkan menggunakan emel <strong>${escapeHtml(email)}</strong>. Tekan butang di bawah untuk menghantar mesej WhatsApp kepada pentadbir.</p>
      <button class="auth-button registration-confirmation__button" type="button">SAHKAN PENDAFTARAN</button>
      <a class="registration-confirmation__later" href="./login.html">Kembali ke halaman log masuk</a>
    </section>`;
  document.body.appendChild(modal);
  modal.querySelector("button").addEventListener("click", () => {
    window.location.href = "https://wa.link/f58e97";
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(status, "");
  const data = new FormData(form);
  const fullName = String(data.get("fullName") || "").trim();
  const birthDate = String(data.get("birthDate") || "");
  const ipg = String(data.get("ipg") || "").trim();
  const email = cleanEmail(data.get("email"));
  const password = String(data.get("password") || "");
  const passwordConfirm = String(data.get("passwordConfirm") || "");

  if (password !== passwordConfirm) {
    setStatus(status, "Password dan pengesahan password tidak sepadan.", "error");
    return;
  }
  if (password.length < 8) {
    setStatus(status, "Password mesti mempunyai sekurang-kurangnya 8 aksara.", "error");
    return;
  }
  if (!fullName || !birthDate || !ipg || !email) {
    setStatus(status, "Sila lengkapkan semua maklumat.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Mendaftarkan...";
  try {
    await persistenceReady;
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const role = email === ADMIN_EMAIL ? "admin" : "user";
    const isAdmin = role === "admin";
    await updateProfile(credential.user, { displayName: fullName });
    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      fullName,
      birthDate,
      ipg,
      email,
      role,
      active: isAdmin,
      approvalStatus: isAdmin ? "approved" : "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (!isAdmin) await signOut(auth);
    setStatus(
      status,
      isAdmin
        ? "Pendaftaran berjaya. Membuka panel pentadbir..."
        : "Pendaftaran berjaya. Sila sahkan pendaftaran melalui WhatsApp.",
      "success"
    );
    if (isAdmin) {
      window.setTimeout(() => window.location.replace("./admin.html"), 1200);
    } else {
      submitButton.textContent = "Pendaftaran berjaya";
      showRegistrationConfirmation(fullName, email);
    }
  } catch (error) {
    setStatus(status, friendlyAuthError(error), "error");
    submitButton.disabled = false;
    submitButton.textContent = "Daftar akaun";
  }
});
