import { useCallback, useEffect, useRef, useState } from "react";
import { toBusinessError } from "../lib/errors.js";

const IDLE_STATE = { status: "idle", data: null, error: null };

// Acciones del usuario. run() resuelve siempre con { status, data | error } para que
// el llamador reaccione al código de negocio sin depender del estado asíncrono.
export function useAsyncAction(action) {
  const [state, setState] = useState(IDLE_STATE);
  const actionRef = useRef(action);

  useEffect(() => {
    actionRef.current = action;
  });

  const run = useCallback(async (...args) => {
    setState({ status: "pending", data: null, error: null });
    try {
      const data = await actionRef.current(...args);
      setState({ status: "success", data, error: null });
      return { status: "success", data };
    } catch (caught) {
      const error = toBusinessError(caught);
      setState({ status: "error", data: null, error });
      return { status: "error", error };
    }
  }, []);

  const reset = useCallback(() => setState(IDLE_STATE), []);

  return { state, run, reset };
}
