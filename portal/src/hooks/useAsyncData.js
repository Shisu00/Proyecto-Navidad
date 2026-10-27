import { useCallback, useEffect, useRef, useState } from "react";
import { toBusinessError } from "../lib/errors.js";

const INITIAL_STATE = { status: "idle", data: null, errorCode: null };

// Lectura por dependencias. Conserva los datos previos mientras recarga y descarta
// respuestas de peticiones antiguas.
export function useAsyncData(fetcher, deps) {
  const [state, setState] = useState(INITIAL_STATE);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setState((previous) => ({ status: "pending", data: previous.data, errorCode: null }));
    try {
      const data = await fetcher();
      if (requestId === requestIdRef.current) {
        setState({ status: "success", data, errorCode: null });
      }
    } catch (caught) {
      if (requestId === requestIdRef.current) {
        setState({ status: "error", data: null, errorCode: toBusinessError(caught).code });
      }
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
