import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Camera, Flashlight, ScanLine, ShieldCheck } from "lucide-react";
import { ErrorNotice, Field } from "../components/ui";
import { policy, validMR } from "../lib/validation";
export default function Scanner({
  onDetected,
}: {
  onDetected: (mr: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | undefined>(undefined);
  const detected = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [running, setRunning] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<unknown>();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState("");
  const [manual, setManual] = useState("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  // Torch (where the camera and browser support it; typically Android Chrome rear cameras).
  type TorchTrack = MediaStreamTrack & {
    getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean };
  };
  const videoTrack = () =>
    (video.current?.srcObject as MediaStream | null)?.getVideoTracks()[0] as
      | TorchTrack
      | undefined;
  async function toggleTorch() {
    const track = videoTrack();
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
      });
      setTorchOn(!torchOn);
    } catch {
      setTorchSupported(false);
    }
  }
  useEffect(() => {
    if (!running || !video.current) return;
    let cancelled = false;
    detected.current = false;
    setRequesting(true);
    setError(undefined);
    const reader = new BrowserQRCodeReader();
    reader
      .decodeFromConstraints(
        {
          video: device
            ? { deviceId: { exact: device } }
            : { facingMode: { ideal: "environment" } },
          audio: false,
        },
        video.current,
        (result, _error, scanner) => {
          if (!result || cancelled || detected.current) return;
          const value = result.getText();
          if (!validMR(value)) {
            setError(
              new Error(
                "This QR code does not contain a valid MR Number. Use the hospital patient QR code.",
              ),
            );
            return;
          }
          detected.current = true;
          scanner.stop();
          setRunning(false);
          onDetectedRef.current(value);
        },
      )
      .then(async (scanner) => {
        if (cancelled || detected.current) {
          scanner.stop();
          return;
        }
        controls.current = scanner;
        setRequesting(false);
        setTorchOn(false);
        setTorchSupported(
  Boolean(
    (
      videoTrack()?.getCapabilities?.() as
        (MediaTrackCapabilities & { torch?: boolean }) | undefined
    )?.torch
  )
);
        // setTorchSupported(Boolean(videoTrack()?.getCapabilities?.()?.torch));
        const cameras = await BrowserQRCodeReader.listVideoInputDevices();
        if (!cancelled) setDevices(cameras);
      })
      .catch((err) => {
        if (cancelled) return;
        setRequesting(false);
        setRunning(false);
        setError(
          new Error(
            err?.name === "NotAllowedError"
              ? "Camera access was denied. Allow camera access in your browser settings, then try again."
              : err?.name === "NotFoundError"
                ? "No camera was found on this device."
                : "The camera could not start. Close other applications using it and check that you are on a secure HTTPS connection.",
          ),
        );
      });
    const element = video.current;
    return () => {
      cancelled = true;
      setTorchOn(false);
      setTorchSupported(false);
      controls.current?.stop();
      controls.current = undefined;
      const stream = element.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      element.srcObject = null;
    };
  }, [running, device]);
  return (
    <div className="scanner">
      <div className="camera-preview">
        {running ? (
          <>
            <video
              ref={video}
              muted
              playsInline
              autoPlay
              aria-label="Patient QR camera preview"
            />
            <div className="scan-target" aria-hidden="true" />
            <span className="camera-status">
              {requesting
                ? "Requesting camera access…"
                : "Position the QR code inside the frame"}
            </span>
          </>
        ) : (
          <div className="camera-idle">
            <ScanLine size={58} strokeWidth={1} />
            <h3>Ready to scan</h3>
            <p>
              Use the existing QR code on the patient record.
              <br />
              Only the MR Number will be read.
            </p>
            <button
              className="button scan-start"
              onClick={() => setRunning(true)}
            >
              <Camera size={20} />
              Enable camera
            </button>
            <p className="camera-help">
              Your browser will ask to use the camera: choose{" "}
              <strong>Allow</strong>. If it was blocked earlier, open the site
              settings of this app and allow Camera.
            </p>
          </div>
        )}
      </div>
      <ErrorNotice error={error} />
      {running && (
        <div className="actions">
          {devices.length > 1 && (
            <label className="field">
              Camera
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value)}
              >
                <option value="">Rear camera (preferred)</option>
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {torchSupported && (
            <button
              className="button secondary"
              aria-pressed={torchOn}
              onClick={() => void toggleTorch()}
            >
              <Flashlight size={18} />
              {torchOn ? "Torch off" : "Torch on"}
            </button>
          )}
          <button
            className="button secondary"
            onClick={() => setRunning(false)}
          >
            Stop camera
          </button>
        </div>
      )}
      <p className="hint icon-line">
        <ShieldCheck size={15} /> Camera frames are processed on your device,
        not uploaded.
      </p>
      {policy.manualEntry && (
        <details className="manual-entry">
          <summary>Enter MR Number manually</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!validMR(manual)) {
                setError(
                  new Error(
                    "Enter an MR Number that matches the hospital format.",
                  ),
                );
                return;
              }
              controls.current?.stop();
              setRunning(false);
              onDetected(manual);
            }}
          >
            <Field
              label="MR Number"
              name="manualMR"
              autoComplete="off"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <button className="button secondary">Verify MR Number</button>
          </form>
        </details>
      )}
    </div>
  );
}
