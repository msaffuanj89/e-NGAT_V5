import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { ADMIN_EMAIL };

export const persistenceReady = setPersistence(auth, browserLocalPersistence);

export function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function safeNext(fallback = "./index.html") {
  const value = new URLSearchParams(window.location.search).get("next");
  if (!value || !/^(?:\.\/)?[a-zA-Z0-9_./?-]+$/.test(value) || value.includes("..")) {
    return fallback;
  }
  return value;
}

export function friendlyAuthError(error) {
  const code = error && error.code ? error.code : "";
  const messages = {
    "auth/email-already-in-use": "Emel ini sudah didaftarkan. Sila log masuk.",
    "auth/invalid-credential": "Emel atau password tidak tepat.",
    "auth/invalid-email": "Format emel tidak sah.",
    "auth/missing-password": "Sila masukkan password.",
    "auth/too-many-requests": "Terlalu banyak percubaan. Sila cuba lagi kemudian.",
    "auth/user-disabled": "Akaun ini telah dinyahaktifkan.",
    "auth/weak-password": "Password tidak memenuhi syarat keselamatan.",
    "auth/network-request-failed": "Sambungan internet bermasalah. Sila cuba semula.",
    "permission-denied": "Maklumat belum dapat diproses. Sila cuba semula.",
  };
  return messages[code] || (error && error.message ? error.message : "Operasi tidak berjaya.");
}

export function setStatus(element, message, type = "") {
  element.textContent = message || "";
  element.className = "auth-status" + (type ? " auth-status--" + type : "");
  element.hidden = !message;
}
