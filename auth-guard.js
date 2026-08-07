import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { auth, db, persistenceReady } from "./auth-common.js";

function reveal() {
  window.__engatAuthReady = true;
  document.documentElement.classList.remove("auth-pending");
  window.dispatchEvent(new CustomEvent("engat:auth-ready"));
}

function loginRedirect() {
  const next = encodeURIComponent("./index.html");
  window.location.replace("./login.html?next=" + next);
}

await persistenceReady;
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginRedirect();
    return;
  }
  try {
    const profile = await getDoc(doc(db, "users", user.uid));
    if (!profile.exists() || profile.data().active === false) {
      await signOut(auth);
      loginRedirect();
      return;
    }
    reveal();
    const logout = document.createElement("button");
    logout.type = "button";
    logout.innerHTML =
      '<span style="display:inline-flex;align-items:center;justify-content:center;gap:.65rem"><svg viewBox="0 0 24 24" aria-hidden="true" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></svg><span>Log keluar</span></span>';
    logout.setAttribute("aria-label", "Log keluar daripada e-NGAT");
    logout.setAttribute("data-engat-header-logout", "true");
    logout.title = profile.data().fullName || user.email || "Pengguna";
    logout.style.cssText =
      "min-height:5rem;border:1px solid #17352d;border-radius:16px;padding:1rem;background:linear-gradient(145deg,#17352d,#102820);color:white;font:750 14px system-ui;cursor:pointer;white-space:nowrap;box-shadow:0 12px 30px rgba(15,23,42,.12)";
    logout.addEventListener("click", async () => {
      logout.disabled = true;
      await signOut(auth);
      window.location.replace("./login.html");
    });
    function placeLogout() {
      const wrapper = document.querySelector(".engat-upload-survey-wrap");
      const report = wrapper && wrapper.querySelector('[data-engat-report="true"]');
      const survey = wrapper && wrapper.querySelector('[data-engat-survey-link="true"]');
      if (!wrapper || !survey) return false;
      (report || survey).insertAdjacentElement("afterend", logout);
      return true;
    }
    if (!placeLogout()) {
      const observer = new MutationObserver(() => {
        if (placeLogout()) observer.disconnect();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  } catch (_) {
    await signOut(auth);
    loginRedirect();
  }
});
