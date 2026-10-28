import { useCallback, useState } from "react";
import { readRunFromImage } from "../lib/cedulaScanner.js";

// Lee el RUN desde una foto tomada con la cámara del teléfono (enfoca mejor que la vista en vivo)
export function useCedulaPhoto(onRun) {
  const [status, setStatus] = useState("idle");

  const readFile = useCallback(
    async (file) => {
      if (!file) return;
      setStatus("reading");
      try {
        const run = await readRunFromImage(file);
        if (run) {
          setStatus("idle");
          onRun(run);
        } else {
          setStatus("unreadable");
        }
      } catch {
        setStatus("unreadable");
      }
    },
    [onRun],
  );

  return { status, readFile };
}
