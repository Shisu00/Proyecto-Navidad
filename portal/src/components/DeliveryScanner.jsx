import { useEffect } from "react";
import { useCedulaScanner } from "../hooks/useCedulaScanner.js";
import { labels } from "../lib/labels.js";
import Notice from "./Notice.jsx";

export default function DeliveryScanner({ onRun, onClose }) {
  const { videoRef, state, start, stop } = useCedulaScanner(onRun);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  const errorText =
    state.errorCode === "CAMERA_DENIED"
      ? labels.delivery.cameraDenied
      : labels.delivery.cameraUnavailable;

  return (
    <div className="scanner stack">
      <video ref={videoRef} className="scanner-video" playsInline muted />
      {state.status === "starting" ? <p>{labels.delivery.scanStarting}</p> : null}
      {state.status === "scanning" ? <p>{labels.delivery.scanning}</p> : null}
      {state.status === "error" ? <Notice tone="warning">{errorText}</Notice> : null}
      <button type="button" className="button button-quiet" onClick={onClose}>
        {labels.delivery.stopScan}
      </button>
    </div>
  );
}
