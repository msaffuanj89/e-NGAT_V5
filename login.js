import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  auth,
  cleanEmail,
  db,
  friendlyAuthError,
  persistenceReady,
  safeNext,
  setStatus,
} from "./auth-common.js";

const form = document.querySelector("#login-form");
const status = document.querySelector("#status");
const submitButton = document.querySelector("#submit-button");
const resetButton = document.querySelector("#reset-button");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(status, "");
  const data = new FormData(form);
  const email = cleanEmail(data.get("email"));
  const password = String(data.get("password") || "");
  submitButton.disabled = true;
  submitButton.textContent = "Menyemak...";
  try {
    await persistenceReady;
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const profileSnap = await getDoc(doc(db, "users", credential.user.uid));
    if (!profileSnap.exists()) throw new Error("Profil pengguna tidak ditemui. Hubungi pentadbir.");
    if (profileSnap.data().approvalStatus === "pending") {
      await signOut(auth);
      throw new Error("Pendaftaran anda masih menunggu pengesahan pentadbir.");
    }
    if (profileSnap.data().active === false) {
      await signOut(auth);
      throw new Error("Akaun ini telah dinyahaktifkan. Hubungi pentadbir.");
    }
    setStatus(status, "Log masuk berjaya.", "success");
    window.location.replace(safeNext("./index.html"));
  } catch (error) {
    setStatus(status, friendlyAuthError(error), "error");
    submitButton.disabled = false;
    submitButton.textContent = "Log masuk";
  }
});

resetButton.addEventListener("click", async () => {
  const email = cleanEmail(document.querySelector("#email").value);
  if (!email) {
    setStatus(status, "Masukkan emel dahulu untuk menerima pautan tetapan semula.", "error");
    return;
  }
  resetButton.disabled = true;
  try {
    await sendPasswordResetEmail(auth, email);
    setStatus(status, "Pautan tetapan semula password telah dihantar jika emel itu berdaftar.", "success");
  } catch (error) {
    setStatus(status, friendlyAuthError(error), "error");
  } finally {
    resetButton.disabled = false;
  }
});
