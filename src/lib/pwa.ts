/**
 * Service-worker registration (production builds only; the dev server must never be cached).
 * An updated worker WAITS: nothing reloads until the user presses "Refresh" in the update banner, so a nurse or
 * pharmacist scanning a patient or filling a report is never interrupted and no unsaved form data is discarded.
 */
export const PWA_UPDATE_EVENT = "pnms:update-available";
export interface PwaUpdateDetail {
  apply: () => void;
}
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  let reloading = false;
  // Fires only after the user accepted the update (the waiting worker was told to SKIP_WAITING).
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        const announce = () => {
          const waiting = registration.waiting;
          // First install has no controller: nothing to "update", the worker simply becomes active.
          if (!waiting || !navigator.serviceWorker.controller) return;
          window.dispatchEvent(
            new CustomEvent<PwaUpdateDetail>(PWA_UPDATE_EVENT, {
              detail: {
                apply: () => waiting.postMessage({ type: "SKIP_WAITING" }),
              },
            }),
          );
        };
        announce();
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed") announce();
          });
        });
        // Look for a new version periodically while the app stays open.
        window.setInterval(() => void registration.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(() => {
        /* The app works normally without a service worker. */
      });
  });
}

/* ------------------------------- Installation ------------------------------- */
export const INSTALL_EVENT = "pnms:install-available";
const DISMISS_KEY = "pnms:install-dismissed-at";
const DISMISS_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let deferredPrompt: BeforeInstallPromptEvent | undefined;

/** Call once at startup: the browser may fire beforeinstallprompt before React has mounted. */
export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // we show our own, dismissible, accessible prompt instead of the mini-infobar
    deferredPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(INSTALL_EVENT));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = undefined;
    window.dispatchEvent(new Event(INSTALL_EVENT));
  });
}
export const canPromptInstall = () => !!deferredPrompt;
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  deferredPrompt = undefined; // a prompt can only be used once
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "dismissed") rememberInstallDismissed();
  window.dispatchEvent(new Event(INSTALL_EVENT));
  return outcome;
}
export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
/** iOS Safari never fires beforeinstallprompt; users must use Share -> Add to Home Screen. */
export function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}
/** Only a timestamp is stored (no personal or clinical data); storage failures simply mean "ask again". */
export function installDismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}
export function rememberInstallDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
