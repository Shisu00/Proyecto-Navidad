import { useEffect } from "react";
import { useCedulaScanner } from "../hooks/useCedulaScanner.js";
import { labels } from "../lib/labels.js";
import Notice from "./Notice.jsx";

export default function DeliveryScanner({ onRun, onClose }) {
  const { videoRef, state, start, stop, setZoom, toggleTorch, refocus } = useCedulaScanner(onRun);
  const { zoom, torch, torchOn, canRefocus } = state.controls;

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
      <div className="scanner-frame">
        {/* Tocar la imagen pide un enfoque nuevo */}
        <video
          ref={videoRef}
          className="scanner-video"
          playsInline
          muted
          onClick={canRefocus ? refocus : undefined}
        />
        <div className="scanner-guide" aria-hidden="true" />
      </div>
      {state.status === "starting" ? <p>{labels.delivery.scanStarting}</p> : null}
      {state.status === "scanning" ? <p>{labels.delivery.scanning}</p> : null}
      {state.status === "scanning" ? (
        <p className="field-hint">{labels.delivery.scanTips}</p>
      ) : null}

      {state.status === "scanning" && (zoom || torch || canRefocus) ? (
        <div className="scanner-controls">
          {zoom ? (
            <label className="field">
              <span className="field-label">{labels.delivery.zoom}</span>
              <input
                type="range"
                min={zoom.min}
                max={zoom.max}
                step={zoom.step}
                value={zoom.value}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
          ) : null}
          {canRefocus ? (
            <button type="button" className="button" onClick={refocus}>
              {labels.delivery.refocus}
            </button>
          ) : null}
          {torch ? (
            <button type="button" className="button" aria-pressed={torchOn} onClick={toggleTorch}>
              {torchOn ? labels.delivery.torchOff : labels.delivery.torchOn}
            </button>
          ) : null}
        </div>
      ) : null}

      {state.hasUnreadableCode ? (
        <Notice tone="warning">{labels.delivery.unreadableCode}</Notice>
      ) : null}
      {state.status === "error" ? <Notice tone="warning">{errorText}</Notice> : null}
      <button type="button" className="button button-quiet" onClick={onClose}>
        {labels.delivery.stopScan}
      </button>
    </div>
  );
}
