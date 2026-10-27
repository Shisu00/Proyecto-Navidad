import { useCallback, useEffect, useRef, useState } from "react";
import { createDetector, extractRun } from "../lib/cedulaScanner.js";

const IDLE_STATE = { status: "idle", errorCode: null };
const SCAN_INTERVAL_MS = 300;

// Abre la cámara trasera y lee códigos hasta encontrar un RUN válido
export function useCedulaScanner(onRun) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
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
    if (videoRef.current) videoRef.current.srcObject = null;
    setState(IDLE_STATE);
  }, []);

  const start = useCallback(async () => {
    setState({ status: "starting", errorCode: null });
    try {
      const detector = createDetector();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setState({ status: "scanning", errorCode: null });

      timerRef.current = setInterval(async () => {
        try {
          const codes = await detector.detect(video);
          for (const code of codes) {
            const run = extractRun(code.rawValue);
            if (run) {
              stop();
              onRunRef.current(run);
              return;
            }
          }
        } catch {
          // El detector falla mientras la cámara aún no entrega imagen: se reintenta
        }
      }, SCAN_INTERVAL_MS);
    } catch (error) {
      stop();
      const isDenied = error?.name === "NotAllowedError";
      setState({ status: "error", errorCode: isDenied ? "CAMERA_DENIED" : "CAMERA_UNAVAILABLE" });
    }
  }, [stop]);

  return { videoRef, state, start, stop };
}
