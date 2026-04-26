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
import {
  AsYouType,
  parsePhoneNumberFromString
} from "https://cdn.jsdelivr.net/npm/libphonenumber-js@1.11.13/+esm";

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
  const countryEl = document.getElementById("country");
  const cityEl = document.getElementById("city");
  const phoneEl = document.getElementById("phone");
  const cityStatus = document.getElementById("city-status");
  const phoneHint = document.getElementById("phone-hint");

  const countryMap = new Map();
  const cityCache = new Map();
  let countryTs = null;
  let cityTs = null;
  let selectedCountry = null;

  function setErr(id, msg) {
    const el = document.getElementById("err-" + id);
    if (el) el.textContent = msg || "";
  }

  function setCityStatus(msg) {
    if (cityStatus) cityStatus.textContent = msg || "";
  }

  function setPhoneHint(msg) {
    if (phoneHint) phoneHint.textContent = msg || "";
  }

  function getCountryValue() {
    return countryTs ? countryTs.getValue() : (countryEl?.value || "");
  }

  function getCityValue() {
    return cityTs ? cityTs.getValue() : (cityEl?.value || "");
  }

  function normalizeCountries(rows) {
    const temp = [];
    for (const c of rows || []) {
      const name = c?.name?.common?.trim();
      const code = (c?.cca2 || "").toUpperCase();
      const root = c?.idd?.root || "";
      const suffixes = Array.isArray(c?.idd?.suffixes) ? c.idd.suffixes : [];
      if (!name || !code || !root || suffixes.length === 0) continue;
      for (const suffix of suffixes) {
        const dialCode = `${root}${suffix}`.replace(/\s+/g, "");
        if (!dialCode.startsWith("+")) continue;
        temp.push({ name, code, dialCode, label: `${name} (${dialCode})` });
      }
    }
    const dedup = new Map();
    for (const row of temp) {
      const prev = dedup.get(row.code);
      if (!prev || row.dialCode.length < prev.dialCode.length) dedup.set(row.code, row);
    }
    return [...dedup.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function resetCities(message) {
    if (cityTs) {
      cityTs.clearOptions();
      cityTs.addOption({ value: "", text: "Select city" });
      cityTs.setValue("", true);
    } else if (cityEl) {
      cityEl.innerHTML = '<option value="">Select city</option>';
    }
    setCityStatus(message || "");
  }

  async function loadCountries() {
    try {
      const r = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2,idd");
      if (!r.ok) throw new Error("countries_api_failed");
      const data = await r.json();
      const countries = normalizeCountries(data);
      countryEl.innerHTML = '<option value="">Select country</option>';
      countries.forEach((c) => {
        countryMap.set(c.code, c);
        const opt = document.createElement("option");
        opt.value = c.code;
        opt.textContent = c.label;
        countryEl.appendChild(opt);
      });
      if (window.TomSelect) {
        countryTs = new window.TomSelect(countryEl, {
          create: false,
          maxOptions: 260,
          placeholder: "Search country..."
        });
        cityTs = new window.TomSelect(cityEl, {
          create: false,
          maxOptions: 2000,
          placeholder: "Search city..."
        });
      }
    } catch (e) {
      countryEl.innerHTML = '<option value="">Could not load countries</option>';
      setErr("country", "Could not load countries. Please refresh.");
    }
  }

  async function loadCities(countryName) {
    if (!countryName) {
      resetCities("Select a country first.");
      return;
    }
    if (cityCache.has(countryName)) {
      const cached = cityCache.get(countryName);
      if (cityTs) {
        cityTs.clearOptions();
        cityTs.addOption(cached.map((v) => ({ value: v, text: v })));
        cityTs.refreshOptions(false);
        cityTs.setValue("", true);
      } else {
        cityEl.innerHTML = '<option value="">Select city</option>';
        cached.forEach((v) => {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = v;
          cityEl.appendChild(opt);
        });
      }
      setCityStatus(`Loaded ${cached.length} cities (cached).`);
      return;
    }
    resetCities("Loading cities...");
    try {
      const r = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: countryName })
      });
      if (!r.ok) throw new Error("cities_api_failed");
      const payload = await r.json();
      const cities = Array.isArray(payload?.data) ? payload.data : [];
      const deduped = [...new Set(cities.map((c) => c.trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
      if (!deduped.length) {
        resetCities("No cities returned for this country.");
        return;
      }
      cityCache.set(countryName, deduped);
      if (cityTs) {
        cityTs.clearOptions();
        cityTs.addOption(deduped.map((v) => ({ value: v, text: v })));
        cityTs.refreshOptions(false);
        cityTs.setValue("", true);
      } else {
        cityEl.innerHTML = '<option value="">Select city</option>';
        deduped.forEach((v) => {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = v;
          cityEl.appendChild(opt);
        });
      }
      setCityStatus(`Loaded ${deduped.length} cities.`);
    } catch (e) {
      resetCities("");
      setErr("city", "Could not load cities. Try changing country or refresh.");
    }
  }

  function applyCountryPhoneUI(country) {
    if (!country) {
      phoneEl.placeholder = "+XXXXXXXXXXX";
      setPhoneHint("");
      return;
    }
    phoneEl.placeholder = `${country.dialCode}XXXXXXXXXX`;
    setPhoneHint(`Country code: ${country.dialCode} (${country.code})`);
    if (!phoneEl.value.trim()) phoneEl.value = country.dialCode;
  }

  function validatePhone(phoneRaw, countryCode) {
    if (!countryCode || !countryMap.has(countryCode)) {
      return { ok: false, message: "Select country first." };
    }
    const parsed = parsePhoneNumberFromString(phoneRaw, countryCode);
    if (!parsed || !parsed.isValid()) {
      return { ok: false, message: "Phone is invalid for selected country." };
    }
    if (parsed.country && parsed.country !== countryCode) {
      return { ok: false, message: "Phone does not match selected country." };
    }
    return { ok: true, e164: parsed.number };
  }

  await loadCountries();
  resetCities("Select country first.");

  countryEl.addEventListener("change", async () => {
    setErr("country", "");
    setErr("city", "");
    setErr("phone", "");
    const countryCode = getCountryValue();
    selectedCountry = countryMap.get(countryCode) || null;
    applyCountryPhoneUI(selectedCountry);
    await loadCities(selectedCountry?.name || "");
  });

  phoneEl.addEventListener("input", () => {
    const countryCode = getCountryValue();
    if (!countryCode) return;
    const formatter = new AsYouType(countryCode);
    phoneEl.value = formatter.input(phoneEl.value);
  });

  phoneEl.addEventListener("blur", () => {
    const countryCode = getCountryValue();
    const phoneRaw = phoneEl.value.trim();
    if (!phoneRaw) return;
    const checked = validatePhone(phoneRaw, countryCode);
    if (!checked.ok) {
      setErr("phone", checked.message);
      return;
    }
    setErr("phone", "");
    phoneEl.value = checked.e164;
  });

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
    const phoneRaw = document.getElementById("phone").value.trim();
    const city = getCityValue().trim();
    const countryCode = getCountryValue().trim().toUpperCase();
    const countryObj = countryMap.get(countryCode) || null;
    const consent = !!document.getElementById("consent")?.checked;

    let ok = true;
    let phone = "";
    if (!fullName || fullName.length < 2) { setErr("name", "Full name is required."); ok = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("email", "Enter a valid email."); ok = false; }
    if (!password || password.length < 6) { setErr("password", "Password must be at least 6 characters."); ok = false; }
    if (!countryObj) { setErr("country", "Country is required."); ok = false; }
    if (!phoneRaw || phoneRaw.length < 7) {
      setErr("phone", "Phone number is required.");
      ok = false;
    } else {
      const checked = validatePhone(phoneRaw, countryCode);
      if (!checked.ok) {
        setErr("phone", checked.message);
        ok = false;
      } else {
        phone = checked.e164;
      }
    }
    if (!city) { setErr("city", "City is required."); ok = false; }
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

      const actionCodeSettings = {
        url: `${window.location.origin}/login.html?verified=1`,
        handleCodeInApp: false
      };

      // Send verification first so profile/network issues never block email delivery.
      try {
        await sendEmailVerification(cred.user, actionCodeSettings);
      } catch (verificationErr) {
        // Fallback for unauthorized continue URL/domain mismatch.
        await sendEmailVerification(cred.user);
      }

      // Best-effort profile save; should not break signup if this fails.
      try {
        const [ip, gps] = await Promise.all([getIp(), getGps()]);
        await setDoc(doc(db, "profiles", cred.user.uid), {
          full_name: fullName,
          email,
          phone,
          city,
          country: countryObj.name,
          country_code: countryObj.code,
          dial_code: countryObj.dialCode,
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
        console.warn("Profile save failed after signup:", profileErr);
      }

      await signOut(auth);

      const next = getNextUrl();
      window.location.href = `verify-waiting.html?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
    } catch (e) {
      const code = e?.code ? ` (${e.code})` : "";
      toast((e?.message || "Signup failed") + code, "error");
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

