/* =========================================================
   AKADEMIA 3D — wspólna logika aplikacji
   Przechowywanie stanu: localStorage (offline, bez konta/chmury)
   ========================================================= */

const Akademia = (() => {
  const STORE_KEY = "akademia3d_state_v1";

  const defaultState = () => ({
    uczen: { imie: "Odkrywco", awatar: "🧑‍🚀", poziom: 1, xp: 0 },
    punkty: 0,
    gwiazdkiZlote: 0,
    gwiazdkiSrebrne: 0,
    medale: [],
    odznaki: [],
    postepy: {},        // { "klasa1/angielski/lekcja1": { procent, gwiazdki } }
    historia: [],        // ostatnie ukończone lekcje
    feedback: [],         // { lekcjaId, ocena: 1|2|3, komentarz, data }
    czasNaukiMin: 0,
    motyw: "auto",
    trybProjektora: false
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
    } catch (e) {
      console.warn("Nie udało się odczytać stanu, tworzę nowy.", e);
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  let state = load();

  function get() { return state; }

  function addPunkty(n) {
    state.punkty += n;
    state.uczen.xp += n;
    while (state.uczen.xp >= poziomProg(state.uczen.poziom)) {
      state.uczen.xp -= poziomProg(state.uczen.poziom);
      state.uczen.poziom += 1;
    }
    save(state);
    renderTopbarStats();
  }

  function poziomProg(poziom) { return 100 + (poziom - 1) * 40; }

  function ukonczLekcje(id, procent, gwiazdki) {
    state.postepy[id] = { procent, gwiazdki, data: new Date().toISOString() };
    state.historia.unshift({ id, data: new Date().toISOString() });
    state.historia = state.historia.slice(0, 20);
    if (gwiazdki >= 3) state.gwiazdkiZlote += 1;
    else if (gwiazdki >= 1) state.gwiazdkiSrebrne += 1;
    addPunkty(10 * gwiazdki + 5);
    save(state);
  }

  function przyznajOdznake(nazwa) {
    if (!state.odznaki.includes(nazwa)) {
      state.odznaki.push(nazwa);
      save(state);
    }
  }

  /* ---------- Feedback od ucznia (po każdej lekcji) ---------- */
  function zapiszFeedback(lekcjaId, ocena, komentarz) {
    state.feedback.unshift({
      lekcjaId, ocena, komentarz: (komentarz || "").slice(0, 500),
      data: new Date().toISOString()
    });
    state.feedback = state.feedback.slice(0, 200); // limit lokalnej historii
    save(state);
  }

  // Aktualizuje najświeższy wpis feedbacku (np. gdy uczeń dopisuje komentarz po ocenie) zamiast duplikować wpisy.
  function aktualizujOstatniFeedback(ocena, komentarz) {
    if (state.feedback.length === 0) { zapiszFeedback("", ocena, komentarz); return; }
    state.feedback[0].ocena = ocena;
    state.feedback[0].komentarz = (komentarz || "").slice(0, 500);
    save(state);
  }

  function eksportujFeedback() {
    const naglowek = "data,lekcja,ocena,komentarz\n";
    const wiersze = state.feedback.map(f => {
      const kom = (f.komentarz || "").replace(/"/g, '""');
      return `"${f.data}","${f.lekcjaId}",${f.ocena},"${kom}"`;
    }).join("\n");
    const blob = new Blob([naglowek + wiersze], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `akademia3d-feedback-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- Tryb projektora: duże elementy, nawigacja klawiaturą ---------- */
  function applyProjector(wlaczony) {
    document.documentElement.classList.toggle("tryb-projektora", !!wlaczony);
  }

  function toggleProjector() {
    state.trybProjektora = !state.trybProjektora;
    applyProjector(state.trybProjektora);
    save(state);
    return state.trybProjektora;
  }

  // Strzałki + Enter/Spacja po siatce kafli — do użycia na dużym ekranie bez myszy/dotyku.
  function wlaczNawigacjeKlawiatura(selektorSiatki) {
    const siatka = document.querySelector(selektorSiatki);
    if (!siatka) return;
    const elementy = () => [...siatka.querySelectorAll("a, button")].filter(el => el.offsetParent !== null);

    document.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) return;
      const lista = elementy();
      if (lista.length === 0) return;
      const aktywny = document.activeElement;
      let idx = lista.indexOf(aktywny);
      if (idx === -1) { lista[0].focus(); e.preventDefault(); return; }

      // Przybliżona liczba kolumn na podstawie szerokości siatki i pierwszego elementu
      const szerSiatki = siatka.getBoundingClientRect().width;
      const szerElementu = lista[0].getBoundingClientRect().width || 1;
      const kolumny = Math.max(1, Math.round(szerSiatki / szerElementu));

      if (e.key === "ArrowRight") idx = Math.min(lista.length - 1, idx + 1);
      else if (e.key === "ArrowLeft") idx = Math.max(0, idx - 1);
      else if (e.key === "ArrowDown") idx = Math.min(lista.length - 1, idx + kolumny);
      else if (e.key === "ArrowUp") idx = Math.max(0, idx - kolumny);
      else if (e.key === "Enter" || e.key === " ") { aktywny.click(); e.preventDefault(); return; }

      lista[idx].focus();
      e.preventDefault();
    });
  }

  /* ---------- Motyw jasny / ciemny ---------- */
  function applyTheme(pref) {
    const root = document.documentElement;
    if (pref === "auto") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", pref);
    }
  }

  function toggleTheme() {
    const order = ["auto", "light", "dark"];
    const i = order.indexOf(state.motyw);
    state.motyw = order[(i + 1) % order.length];
    if (state.motyw === "light") document.documentElement.setAttribute("data-theme", "light");
    else applyTheme(state.motyw);
    save(state);
  }

  /* ---------- Render wspólnych elementów topbaru ---------- */
  function renderTopbarStats() {
    const pEl = document.querySelector("[data-stat='punkty']");
    if (pEl) pEl.textContent = state.punkty;
    const lEl = document.querySelector("[data-stat='poziom']");
    if (lEl) lEl.textContent = state.uczen.poziom;
  }

  /* ---------- Rejestracja Service Workera (offline) ---------- */
  function registerSW() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch((e) => {
          console.warn("Rejestracja Service Workera nie powiodła się:", e);
        });
      });
    }
  }

  /* ---------- Wykrywanie i inicjalizacja WebXR (VR/AR) ---------- */
  async function xrStatus() {
    const out = { vr: false, ar: false };
    if (navigator.xr) {
      try { out.vr = await navigator.xr.isSessionSupported("immersive-vr"); } catch (e) {}
      try { out.ar = await navigator.xr.isSessionSupported("immersive-ar"); } catch (e) {}
    }
    return out;
  }

  function init() {
    applyTheme(state.motyw);
    applyProjector(state.trybProjektora);
    registerSW();
    document.addEventListener("DOMContentLoaded", renderTopbarStats);
  }

  return {
    get, addPunkty, ukonczLekcje, przyznajOdznake,
    zapiszFeedback, aktualizujOstatniFeedback, eksportujFeedback,
    toggleTheme, toggleProjector, wlaczNawigacjeKlawiatura,
    xrStatus, init
  };
})();

Akademia.init();
