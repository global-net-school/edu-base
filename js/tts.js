/* =========================================================
   AKADEMIA 3D — moduł TTS (Web Speech API)
   Ten sam sprawdzony wzorzec co w aplikacji Różaniec:
   - scoring głosów faworyzujący Natural/Neural/Premium,
   - keep-alive (Chrome ucina długie wypowiedzi po ~15s bez tego),
   - działa offline (silniki TTS wbudowane w system/przeglądarkę,
     bez wysyłania danych do chmury).
   ========================================================= */

const AkademiaTTS = (() => {
  let glosy = [];
  let keepAliveTimer = null;
  let aktywnyPrzycisk = null;

  function wczytajGlosy() {
    glosy = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  }

  if (window.speechSynthesis) {
    wczytajGlosy();
    window.speechSynthesis.onvoiceschanged = wczytajGlosy;
  }

  // Im wyższy wynik, tym lepszy głos (naturalność brzmienia)
  function ocenGlosu(v) {
    const n = (v.name || "").toLowerCase();
    let wynik = 0;
    if (n.includes("natural")) wynik += 5;
    if (n.includes("neural")) wynik += 5;
    if (n.includes("premium")) wynik += 4;
    if (n.includes("enhanced")) wynik += 3;
    if (v.localService) wynik += 2; // głosy offline preferowane (szybsze, działają bez sieci)
    if (n.includes("google")) wynik += 1;
    return wynik;
  }

  function wybierzGlos(langPrefix) {
    const kandydaci = glosy.filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
    if (kandydaci.length === 0) return null;
    return kandydaci.sort((a, b) => ocenGlosu(b) - ocenGlosu(a))[0];
  }

  // Chrome (desktop i Android) przerywa syntezę po ok. 15s ciszy w kolejce —
  // regularne "budzenie" silnika zapobiega ucinaniu dłuższych wypowiedzi.
  function startKeepAlive() {
    stopKeepAlive();
    keepAliveTimer = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 4000);
  }
  function stopKeepAlive() {
    if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  }

  /**
   * Odczytuje tekst na głos.
   * @param {string} text  - tekst do przeczytania
   * @param {string} lang  - kod języka, np. "en-US" albo "pl-PL"
   * @param {HTMLElement} [btn] - opcjonalny przycisk, dostaje klasę "speaking" na czas mowy
   */
  function mow(text, lang = "pl-PL", btn = null) {
    if (!window.speechSynthesis || !text) return;

    window.speechSynthesis.cancel(); // przerwij poprzednią wypowiedź
    if (aktywnyPrzycisk) aktywnyPrzycisk.classList.remove("speaking");

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.92;   // lekko wolniej — łatwiej zrozumieć dzieciom
    utter.pitch = 1.05;

    const glos = wybierzGlos(lang.split("-")[0].toLowerCase());
    if (glos) utter.voice = glos;

    if (btn) { btn.classList.add("speaking"); aktywnyPrzycisk = btn; }

    utter.onend = () => { stopKeepAlive(); if (btn) btn.classList.remove("speaking"); };
    utter.onerror = () => { stopKeepAlive(); if (btn) btn.classList.remove("speaking"); };

    startKeepAlive();
    window.speechSynthesis.speak(utter);
  }

  function czyDostepne() {
    return "speechSynthesis" in window;
  }

  return { mow, czyDostepne };
})();
