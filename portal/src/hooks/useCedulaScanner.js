import { useCallback, useEffect, useRef, useState } from "react";
import { createCodeReader, firstRun } from "../lib/cedulaScanner.js";

const NO_CONTROLS = { zoom: null, torch: false, torchOn: false, canRefocus: false };
const IDLE_STATE = {
  status: "idle",
  errorCode: null,
  hasUnreadableCode: false,
  controls: NO_CONTROLS,
};
const SCAN_INTERVAL_MS = 350;
const REFOCUS_SETTLE_MS = 1200;

async function applyAdvanced(track, constraint) {
  try {
    await track.applyConstraints({ advanced: [constraint] });
    return true;
  } catch {
    return false;
  }
}

// Qué puede ajustar esta cámara (cambia según el teléfono y el navegador)
function readControls(track) {
  const capabilities = track.getCapabilities?.() ?? {};
  return {
    zoom: capabilities.zoom
      ? {
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          step: capabilities.zoom.step || 0.1,
          value: track.getSettings?.().zoom ?? capabilities.zoom.min,
        }
      : null,
    torch: Boolean(capabilities.torch),
    torchOn: false,
    canRefocus: Boolean(capabilities.focusMode?.includes("single-shot")),
  };
}

// Abre la cámara trasera y lee códigos hasta encontrar un RUN válido
export function useCedulaScanner(onRun) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const trackRef = useRef(null);
  const torchRef = useRef(false);
  const onRunRef = useRef(onRun);
  const [state, setState] = useState(IDLE_STATE);

  useEffect(() => {
    onRunRef.current = onRun;
  });

  const stop = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    trackRef.current = null;
    torchRef.current = false;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState(IDLE_STATE);
  }, []);

  const start = useCallback(async () => {
    setState({ ...IDLE_STATE, status: "starting" });
    try {
      const reader = await createCodeReader();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      // Enfoque continuo: con un código pequeño y cercano el enfoque fijo lo deja borroso
      await applyAdvanced(track, { focusMode: "continuous" });

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setState({ ...IDLE_STATE, status: "scanning", controls: readControls(track) });

      let busy = false;
      let tick = 0;
      timerRef.current = setInterval(async () => {
        if (busy) return;
        busy = true;
        tick += 1;
        try {
          // El respaldo (ZXing) pesa más: se usa cada dos cuadros
          const values = await reader.read(video, { useFallback: tick % 2 === 0 });
          const run = firstRun(values);
          if (run) {
            stop();
            onRunRef.current(run);
            return;
          }
          // Se leyó un código, pero no trae un RUN válido (otro código o lectura dañada)
          if (values.length > 0) setState((previous) => ({ ...previous, hasUnreadableCode: true }));
        } catch {
          // Cuadro sin imagen todavía: se reintenta
        } finally {
          busy = false;
        }
      }, SCAN_INTERVAL_MS);
    } catch (error) {
      stop();
      const isDenied = error?.name === "NotAllowedError";
      setState({
        ...IDLE_STATE,
        status: "error",
        errorCode: isDenied ? "CAMERA_DENIED" : "CAMERA_UNAVAILABLE",
      });
    }
  }, [stop]);

  const setZoom = useCallback(async (value) => {
    const track = trackRef.current;
    if (!track || !(await applyAdvanced(track, { zoom: value }))) return;
    setState((previous) =>
      previous.controls.zoom
        ? { ...previous, controls: { ...previous.controls, zoom: { ...previous.controls.zoom, value } } }
        : previous,
    );
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchRef.current;
    if (!(await applyAdvanced(track, { torch: next }))) return;
    torchRef.current = next;
    setState((previous) => ({ ...previous, controls: { ...previous.controls, torchOn: next } }));
  }, []);

  // Pide un enfoque nuevo y vuelve al continuo cuando termina
  const refocus = useCallback(async () => {
    const track = trackRef.current;
    if (!track || !(await applyAdvanced(track, { focusMode: "single-shot" }))) return;
    setTimeout(() => {
      if (trackRef.current === track) applyAdvanced(track, { focusMode: "continuous" });
    }, REFOCUS_SETTLE_MS);
  }, []);

  return { videoRef, state, start, stop, setZoom, toggleTorch, refocus };
}
