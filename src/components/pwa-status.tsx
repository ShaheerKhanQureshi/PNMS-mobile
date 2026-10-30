import { useEffect, useState } from "react";
import { Download, RefreshCw, Share, WifiOff } from "lucide-react";
import {
  INSTALL_EVENT,
  PWA_UPDATE_EVENT,
  canPromptInstall,
  installDismissedRecently,
  isIosSafari,
  isStandalone,
  promptInstall,
  rememberInstallDismissed,
  type PwaUpdateDetail,
} from "../lib/pwa";

/**
 * Two small, non-blocking banners:
 *  - "update available": the user decides when to refresh (never forced while a scan or report is in progress);
 *  - "connection required": reports are never queued offline, so say so instead of letting a submission look saved.
 */
export default function PwaStatus() {
  const [apply, setApply] = useState<(() => void) | undefined>();
  const [dismissed, setDismissed] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [canInstall, setCanInstall] = useState(canPromptInstall);
  const [installHidden, setInstallHidden] = useState(
    () => isStandalone() || installDismissedRecently(),
  );
  // iOS Safari has no install prompt: show "Add to Home Screen" guidance instead (production builds only).
  const showIosHint = import.meta.env.PROD && isIosSafari() && !installHidden;
  useEffect(() => {
    const onInstall = () => {
      setCanInstall(canPromptInstall());
      if (isStandalone()) setInstallHidden(true);
    };
    window.addEventListener(INSTALL_EVENT, onInstall);
    return () => window.removeEventListener(INSTALL_EVENT, onInstall);
  }, []);
  useEffect(() => {
    const onUpdate = (event: Event) => {
      setApply(() => (event as CustomEvent<PwaUpdateDetail>).detail.apply);
      setDismissed(false);
    };
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener(PWA_UPDATE_EVENT, onUpdate);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener(PWA_UPDATE_EVENT, onUpdate);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return (
    <div className="pwa-banners">
      {!online && (
        <div className="pwa-banner offline" role="alert">
          <WifiOff size={18} aria-hidden="true" />
          <span>
            No internet connection. Reports cannot be submitted until you are
            back online; nothing is saved offline.
          </span>
        </div>
      )}
      {canInstall && !installHidden && (
        <div className="pwa-banner install" role="region" aria-label="Install app">
          <Download size={18} aria-hidden="true" />
          <span>Install PNMS on this device for quick access.</span>
          <button
            className="button small"
            onClick={async () => {
              const outcome = await promptInstall();
              if (outcome !== "unavailable") setInstallHidden(true);
            }}
          >
            Install
          </button>
          <button
            className="text-button"
            onClick={() => {
              rememberInstallDismissed();
              setInstallHidden(true);
            }}
            aria-label="Dismiss install suggestion"
          >
            Not now
          </button>
        </div>
      )}
      {showIosHint && (
        <div className="pwa-banner install" role="region" aria-label="Install app">
          <Share size={18} aria-hidden="true" />
          <span>
            To install: tap the Share button, then &ldquo;Add to Home Screen&rdquo;.
          </span>
          <button
            className="text-button"
            onClick={() => {
              rememberInstallDismissed();
              setInstallHidden(true);
            }}
            aria-label="Dismiss install guidance"
          >
            Got it
          </button>
        </div>
      )}
      {apply && !dismissed && (
        <div className="pwa-banner update" role="status">
          <RefreshCw size={18} aria-hidden="true" />
          <span>
            A new version is available. Finish any report in progress, then
            refresh.
          </span>
          <button className="button small" onClick={apply}>
            Refresh
          </button>
          <button
            className="text-button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss update notice"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}
