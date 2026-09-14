/* AKADEMIA 3D — Service Worker
   Strategia: cache-first dla powłoki aplikacji (app shell),
   network-first z fallbackiem do cache dla danych lekcji (dane/*.json),
   dzięki czemu aplikacja działa w pełni offline po pierwszym uruchomieniu. */

const CACHE_NAME = "akademia3d-shell-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./klasa.html",
  "./przedmiot.html",
  "./lekcja.html",
  "./osiagniecia.html",
  "./podroz.html",
  "./panel-rodzica.html",
  "./panel-nauczyciela.html",
  "./vr-klasa.html",
  "./ar-model.html",
  "./css/style.css",
  "./js/app.js",
  "./js/tts.js",
  "./manifest.json",
  "./vendor/fonts.css",
  "./vendor/aframe.min.js",
  "./vendor/aframe-troika-text.min.js",
  "./vendor/model-viewer.min.js",
  "./dane/index.json",
  "./dane/klasa1-angielski.json",
  "./dane/klasa1-polski.json",
  "./dane/klasa1-matematyka.json",
  "./dane/klasa1-przyroda.json",
  "./dane/klasa1-historia.json",
  "./dane/klasa1-geografia.json",
  "./dane/klasa1-informatyka.json",
  "./dane/klasa1-plastyka.json",
  "./dane/klasa1-muzyka.json",
  "./modele/szescian.glb",
  "./modele/kula.glb",
  "./modele/stozek.glb",
  "./modele/walec.glb",
  "./modele/ostroslup.glb",
  "./modele/graniastoslup.glb",
  "./modele/komorka_roslinna.glb",
  "./modele/uklad-sloneczny.glb"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isData = url.pathname.includes("/dane/");

  if (isData) {
    // network-first, fallback do cache (dane lekcji mogą się aktualizować)
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // cache-first dla powłoki aplikacji (szybkość na słabszych urządzeniach)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return resp;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
