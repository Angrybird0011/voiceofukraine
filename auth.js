import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
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

async function initLoginPage() {
  window.sendMagic = async function loginWithPassword() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById("err-login").textContent = "Please enter a valid email.";
      return;
    }
    if (!password || password.length < 8) {
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
  const fd = {};
  let smsVerified = false;
  let signupUser = null;

  function setErr(id, msg) {
    const el = document.getElementById("err-" + id);
    if (el) el.textContent = msg;
  }
  function clearErr() {
    ["name","email","country","phone","sms","password","confirm"].forEach((x) => setErr(x, ""));
  }
  function goTo(n) {
    [1,2,3,4].forEach((i) => {
      document.getElementById("step" + i).style.display = i === n ? "block" : "none";
      const sc = document.getElementById("sc" + i);
      if (i < n) { sc.textContent = "✓"; sc.className = "step-c done"; }
      else if (i === n) { sc.textContent = i; sc.className = "step-c active"; }
      else { sc.textContent = i; sc.className = "step-c"; }
      const sl = document.getElementById("sl" + i);
      if (sl) sl.className = "step-line" + (i < n ? " done" : "");
    });
    document.getElementById("progFill").style.width = (n * 25) + "%";
  }
  function startTimer(btnId, spanId, secs) {
    const btn = document.getElementById(btnId);
    const span = document.getElementById(spanId);
    btn.disabled = true;
    let s = secs;
    if (span) span.textContent = s;
    const iv = setInterval(() => {
      s--;
      if (span) span.textContent = s;
      if (s <= 0) {
        clearInterval(iv);
        btn.disabled = false;
        btn.textContent = btnId === "resendBtn" ? "Resend verification email" : "Resend OTP";
      }
    }, 1000);
  }

  async function sendSms() {
    const phone = document.getElementById("phone").value.trim();
    if (!phone || phone.length < 7) { setErr("phone","Enter phone with country code e.g. +44 7700 900000"); return; }
    fd.phone = phone;
    setErr("phone", "");
    setErr("sms", "");
    document.getElementById("smsBox").style.display = "block";
    if (IS_DEMO) { startTimer("resendSmsBtn", "smsTimer", 30); return; }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    sessionStorage.setItem("sms_otp_" + phone, otp);
    sessionStorage.setItem("sms_otp_time", Date.now().toString());
    toast("SMS OTP generated. Integrate your SMS provider for production.", "success");
    startTimer("resendSmsBtn", "smsTimer", 30);
  }

  async function verifySms(code) {
    setErr("sms", "");
    if (IS_DEMO) {
      if (code === "123456") {
        smsVerified = true;
        document.getElementById("smsOk").classList.add("show");
        document.getElementById("sendSmsBtn").textContent = "✓ Verified";
        document.getElementById("sendSmsBtn").disabled = true;
        return;
      }
      setErr("sms","Wrong code. Demo is 123456");
      return;
    }
    const stored = sessionStorage.getItem("sms_otp_" + fd.phone);
    const storedTime = parseInt(sessionStorage.getItem("sms_otp_time") || "0", 10);
    if ((Date.now() - storedTime) > 10 * 60 * 1000) { setErr("sms","Code expired. Click Resend OTP."); return; }
    if (code === stored) {
      smsVerified = true;
      document.getElementById("smsOk").classList.add("show");
      document.getElementById("sendSmsBtn").textContent = "✓ Verified";
      document.getElementById("sendSmsBtn").disabled = true;
      sessionStorage.removeItem("sms_otp_" + fd.phone);
    } else {
      setErr("sms","Incorrect code. Please try again.");
    }
  }

  async function goStep2() {
    clearErr();
    const name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const country = document.getElementById("country").value;
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirmPassword").value;
    let ok = true;
    if (!name || name.length < 2) { setErr("name","Please enter your full name."); ok = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("email","Please enter a valid email."); ok = false; }
    if (!phone || phone.length < 7) { setErr("phone","Phone number is required."); ok = false; }
    if (!country) { setErr("country","Please select your country."); ok = false; }
    if (!password || password.length < 8) { setErr("password","Password must be at least 8 characters."); ok = false; }
    if (password !== confirm) { setErr("confirm","Passwords do not match."); ok = false; }
    if (!smsVerified) { setErr("phone",'Please verify your phone number first — click "Send OTP" and enter the code.'); ok = false; }
    if (!ok) return;

    fd.name = name;
    fd.email = email;
    fd.country = country;
    fd.phone = phone;
    fd.password = password;
    fd.city = document.getElementById("city").value.trim();

    const btn = document.getElementById("step1Btn");
    btn.disabled = true;
    btn.textContent = "Creating account…";
    try {
      if (IS_DEMO) {
        signupUser = { uid: "demo_" + Date.now(), email, emailVerified: true };
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        signupUser = cred.user;
      }
      document.getElementById("emailShow").textContent = email;
      goTo(2);
      startTimer("resendBtn", "timer", 60);
      toast("Verification email sent. Open inbox then click Verify Email.", "success");
    } catch (e) {
      toast(e.message || "Signup failed", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Continue →";
    }
  }

  async function verifyOtp() {
    try {
      if (IS_DEMO) {
        document.getElementById("emailOk").classList.add("show");
        setTimeout(() => goTo(3), 600);
        return;
      }
      if (!auth.currentUser) throw new Error("Session expired. Sign up again.");
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified) throw new Error("Email not verified yet.");
      document.getElementById("emailOk").classList.add("show");
      setTimeout(() => goTo(3), 600);
    } catch (e) {
      document.getElementById("err-otp").textContent = "❌ " + e.message;
    }
  }

  async function resendOtp() {
    if (IS_DEMO) { startTimer("resendBtn", "timer", 60); return; }
    if (!auth.currentUser) { toast("Session expired. Start signup again.", "error"); return; }
    await sendEmailVerification(auth.currentUser);
    toast("New verification email sent", "success");
    startTimer("resendBtn", "timer", 60);
  }

  async function getIp() {
    try { const r = await fetch("https://api.ipapi.is/"); return r.ok ? await r.json() : {}; }
    catch { return {}; }
  }

  async function requestGps() {
    const c = document.getElementById("gpsCheck");
    const s = document.getElementById("gpsStatus");
    if (!c.checked) { s.textContent = ""; fd.lat = null; fd.lon = null; return; }
    if (!navigator.geolocation) { c.checked = false; s.textContent = "Geolocation not supported."; return; }
    s.textContent = "Requesting location…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fd.lat = pos.coords.latitude.toFixed(5);
        fd.lon = pos.coords.longitude.toFixed(5);
        s.textContent = "📍 Location recorded: " + fd.lat + ", " + fd.lon;
      },
      () => { c.checked = false; s.textContent = "Location denied — that's fine."; }
    );
  }

  async function finish() {
    const ip = await getIp();
    const uid = (auth.currentUser && auth.currentUser.uid) || (signupUser && signupUser.uid) || ("demo_" + Date.now());
    if (!IS_DEMO) {
      const token = await auth.currentUser.getIdToken();
      saveLocalSession(auth.currentUser, token);
      await setDoc(doc(db, "profiles", uid), {
        full_name: fd.name,
        email: fd.email,
        phone: fd.phone,
        phone_verified: !!smsVerified,
        country: fd.country,
        city: fd.city || null,
        lat: fd.lat || null,
        lon: fd.lon || null,
        ip_address: ip.ip || null,
        ip_city: ip.location?.city || null,
        ip_country: ip.location?.country || null,
        ip_isp: ip.company?.name || null,
        user_agent: navigator.userAgent,
        created_at: serverTimestamp()
      }, { merge: true });
    } else {
      saveLocalSession({ uid, email: fd.email, emailVerified: true }, "demo_token");
    }
    goTo(4);
    const startReading = document.querySelector('#step4 a.btn');
    if (startReading) startReading.href = getNextUrl();
    toast("Welcome to Voice of Ukraine!", "success");
  }

  const smsDigits = Array.from(document.querySelectorAll("#smsDigits .otp-d"));
  smsDigits.forEach((inp, i) => {
    inp.addEventListener("input", (e) => {
      const v = e.target.value.replace(/\D/g, "").slice(-1);
      e.target.value = v;
      inp.classList.toggle("filled", !!v);
      if (v && i < smsDigits.length - 1) smsDigits[i + 1].focus();
      const code = smsDigits.map((x) => x.value).join("");
      if (code.length === 6) verifySms(code);
    });
  });

  window.goStep2 = goStep2;
  window.verifyOtp = verifyOtp;
  window.resendOtp = resendOtp;
  window.sendSms = sendSms;
  window.requestGps = requestGps;
  window.finish = finish;
  window.goTo = goTo;

  if (IS_DEMO) {
    const demoNote = document.getElementById("demoNote");
    if (demoNote) demoNote.style.display = "none";
  }
}

function initIndexPage() {
  window.doLogout = function doLogout() {
    signOut(auth).finally(() => {
      localStorage.removeItem("vou_token");
      localStorage.removeItem("vou_user");
      window.location.reload();
    });
  };
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const token = await user.getIdToken();
    saveLocalSession(user, token);
  });
}

function initArticlePage() {
  onAuthStateChanged(auth, async (user) => {
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

const page = pathName();
if (page === "signup.html") initSignupPage();
if (page === "login.html") initLoginPage();
if (page === "index.html") initIndexPage();
if (page === "article.html") initArticlePage();

