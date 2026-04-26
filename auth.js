import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAga6UWDBzwzE8u7g8Z7iYb3QLKbkJLI9c",
  authDomain: "voice-of-ukraine.firebaseapp.com",
  projectId: "voice-of-ukraine",
  storageBucket: "voice-of-ukraine.firebasestorage.app",
  messagingSenderId: "464319888247",
  appId: "1:464319888247:web:b46733df41c6b92b7d3f72"
};

const IS_DEMO = false;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function updateNavForAuth(user) {
  const join = document.getElementById("navJoin");
  const login = document.getElementById("navLogin");
  const logout = document.getElementById("navLogout");
  const loggedIn = !!(user && user.emailVerified);
  if (join) join.style.display = loggedIn ? "none" : "";
  if (login) login.style.display = loggedIn ? "none" : "";
  if (logout) logout.style.display = loggedIn ? "inline-flex" : "none";
}

function getNextUrl() {
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return "index.html";
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.origin !== window.location.origin) return "index.html";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "index.html";
  }
}

function pathName() {
  return (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
}

function toast(msg, type) {
  const t = document.getElementById("toast") || document.getElementById("globalToast");
  if (!t) return;
  t.textContent = msg;
  t.className = (t.id === "globalToast" ? "toast " : "toast") + (type ? " " + type : "");
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("show")));
  setTimeout(() => t.classList.remove("show"), 3500);
}

function saveLocalSession(user, token) {
  localStorage.setItem("vou_token", token || "demo_token");
  localStorage.setItem("vou_user", JSON.stringify({
    id: user.uid || user.id || ("demo_" + Date.now()),
    email: user.email || null,
    emailVerified: !!user.emailVerified
  }));
}

function clearLocalSession() {
  localStorage.removeItem("vou_token");
  localStorage.removeItem("vou_user");
}

window.doLogout = function doLogout() {
  signOut(auth).finally(() => {
    clearLocalSession();
    window.location.href = "index.html";
  });
};
// Some pages call `logout()`
window.logout = window.doLogout;

async function initLoginPage() {
  window.sendMagic = async function loginWithPassword() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById("err-login").textContent = "Please enter a valid email.";
      return;
    }
    if (!password || password.length < 6) {
      document.getElementById("err-login").textContent = "Please enter your password.";
      return;
    }

    if (IS_DEMO) {
      saveLocalSession({ id: "demo_" + Date.now(), email, emailVerified: true });
      toast("Demo sign in successful", "success");
      setTimeout(() => { window.location.href = getNextUrl(); }, 800);
      return;
    }

    const btn = document.getElementById("magicBtn");
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await cred.user.reload();
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
        throw new Error("Email is not verified yet. We sent you a new verification email.");
      }
      const token = await cred.user.getIdToken();
      saveLocalSession(cred.user, token);
      toast("Signed in successfully", "success");
      setTimeout(() => { window.location.href = getNextUrl(); }, 900);
    } catch (e) {
      document.getElementById("err-login").textContent = e.message || "Login failed.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign In →";
    }
  };

  window.resendVerificationFromLogin = async function resendVerificationFromLogin() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const err = document.getElementById("err-login");
    if (err) err.textContent = "";
    if (!email || !password) {
      if (err) err.textContent = "Enter email and password, then resend verification.";
      return;
    }
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      await signOut(auth);
      toast("Verification email sent. Check your inbox.", "success");
    } catch (e) {
      if (err) err.textContent = e.message || "Could not resend verification email.";
    }
  };
}

async function initSignupPage() {
  const form = document.getElementById("signupForm");
  if (!form) return;

  function setErr(id, msg) {
    const el = document.getElementById("err-" + id);
    if (el) el.textContent = msg || "";
  }

  async function getIp() {
    try { const r = await fetch("https://api.ipapi.is/"); return r.ok ? await r.json() : {}; }
    catch { return {}; }
  }

  async function getGps() {
    return await new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude.toFixed(5),
          lon: pos.coords.longitude.toFixed(5),
          acc: pos.coords.accuracy
        }),
        () => resolve(null),
        { timeout: 8000 }
      );
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    ["name","email","password","phone","city","country","consent"].forEach((x) => setErr(x, ""));

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const phone = document.getElementById("phone").value.trim();
    const city = document.getElementById("city").value.trim();
    const country = document.getElementById("country").value.trim();
    const consent = !!document.getElementById("consent")?.checked;

    let ok = true;
    if (!fullName || fullName.length < 2) { setErr("name", "Full name is required."); ok = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("email", "Enter a valid email."); ok = false; }
    if (!password || password.length < 6) { setErr("password", "Password must be at least 6 characters."); ok = false; }
    if (!phone || phone.length < 7) { setErr("phone", "Phone number is required."); ok = false; }
    if (!city) { setErr("city", "City is required."); ok = false; }
    if (!country) { setErr("country", "Country is required."); ok = false; }
    if (!consent) { setErr("consent", "You must agree to continue."); ok = false; }
    if (!ok) return;

    const btn = document.getElementById("signupBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Creating account…"; }

    try {
      if (IS_DEMO) {
        toast("Demo mode is disabled.", "error");
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: fullName });

      // Send verification first, so profile/IP failures never block email delivery.
      const actionCodeSettings = {
        url: `${window.location.origin}/login.html?verified=1`,
        handleCodeInApp: false
      };
      try {
        await sendEmailVerification(cred.user, actionCodeSettings);
      } catch (verificationErr) {
        // Fallback: if custom continue URL/domain is not allowed in Firebase,
        // still send the default verification email so signup is not blocked.
        await sendEmailVerification(cred.user);
      }

      // Save profile data as best effort only.
      try {
        const [ip, gps] = await Promise.all([getIp(), getGps()]);
        await setDoc(doc(db, "profiles", cred.user.uid), {
          full_name: fullName,
          email,
          phone,
          city,
          country,
          consent: true,
          lat: gps?.lat || null,
          lon: gps?.lon || null,
          gps_acc: gps?.acc || null,
          ip_address: ip.ip || null,
          ip_city: ip.location?.city || null,
          ip_country: ip.location?.country || null,
          ip_isp: ip.company?.name || null,
          user_agent: navigator.userAgent,
          created_at: serverTimestamp()
        }, { merge: true });
      } catch (profileErr) {
        console.warn("Profile save failed, but verification email was sent.", profileErr);
      }

      await signOut(auth);

      const next = getNextUrl();
      window.location.href = `verify-waiting.html?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
    } catch (e) {
      toast(e?.message || "Signup failed", "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Create account →"; }
    }
  });
}

function initIndexPage() {
  onAuthStateChanged(auth, async (user) => {
    updateNavForAuth(user);
    if (!user || !user.emailVerified) return;
    const token = await user.getIdToken();
    saveLocalSession(user, token);
  });
}

function initArticlePage() {
  onAuthStateChanged(auth, async (user) => {
    updateNavForAuth(user);
    if (!user || !user.emailVerified) {
      window.location.href = "signup.html?next=" + encodeURIComponent(window.location.href);
      return;
    }
    const token = await user.getIdToken();
    saveLocalSession(user, token);
    document.addEventListener("DOMContentLoaded", () => {
      if (typeof window.loadArticlePage === "function") window.loadArticlePage();
    });
  });
}

function initVerifyWaitingPage() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "";
  const next = params.get("next") || "index.html";
  const emailShow = document.getElementById("emailShow");
  if (emailShow) emailShow.textContent = email || "—";
  const goLogin = document.getElementById("goLogin");
  if (goLogin) goLogin.href = `login.html?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
}

const page = pathName();
if (page === "signup.html") initSignupPage();
if (page === "login.html") initLoginPage();
if (page === "index.html") initIndexPage();
if (page === "article.html") initArticlePage();
if (page === "verify-waiting.html") initVerifyWaitingPage();

// Keep nav state in sync on all pages that include auth.js
onAuthStateChanged(auth, (user) => updateNavForAuth(user));

