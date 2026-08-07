import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { auth, db, persistenceReady } from "./auth-common.js";

let eventRef = null;
let startedAtMs = Date.now();
let recordedCourse = "";
let heartbeat = null;

function newId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sessionIdFor(userId) {
  const key = `engat-usage-session:${userId}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = newId();
    sessionStorage.setItem(key, id);
  }
  return id;
}

function findCourse() {
  const paragraphs = Array.from(document.querySelectorAll("p"));
  const codeText = paragraphs.find((item) => item.textContent.trim().startsWith("Kod Kursus:"));
  const nameText = paragraphs.find((item) => item.textContent.trim().startsWith("Nama Kursus:"));
  const courseCode = codeText ? codeText.textContent.replace(/^Kod Kursus:\s*/i, "").trim() : "";
  const courseName = nameText ? nameText.textContent.replace(/^Nama Kursus:\s*/i, "").trim() : "";
  if (!courseCode && !courseName) return null;
  return { courseCode, courseName };
}

async function updateActivity(extra = {}) {
  if (!eventRef) return;
  try {
    await updateDoc(eventRef, {
      lastActiveAt: serverTimestamp(),
      durationSeconds: Math.max(0, Math.round((Date.now() - startedAtMs) / 1000)),
      ...extra,
    });
  } catch (_) {}
}

async function captureCourse() {
  const course = findCourse();
  if (!course) return;
  const signature = `${course.courseCode}|${course.courseName}`;
  if (signature === recordedCourse) return;
  recordedCourse = signature;
  await updateActivity(course);
}

async function beginSession(user) {
  startedAtMs = Date.now();
  const id = sessionIdFor(user.uid);
  eventRef = doc(db, "usageEvents", id);
  await setDoc(
    eventRef,
    {
      eventId: id,
      uid: user.uid,
      email: user.email || "",
      sessionDate: new Date().toISOString().slice(0, 10),
      startedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      durationSeconds: 0,
      courseCode: "",
      courseName: "",
      userAgent: navigator.userAgent.slice(0, 240),
    },
    { merge: true }
  );
  window.clearInterval(heartbeat);
  heartbeat = window.setInterval(() => updateActivity(), 5 * 60 * 1000);
  new MutationObserver(captureCourse).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateActivity();
  });
}

await persistenceReady;
onAuthStateChanged(auth, async (user) => {
  window.clearInterval(heartbeat);
  eventRef = null;
  if (!user) return;
  try {
    await beginSession(user);
  } catch (_) {}
});
