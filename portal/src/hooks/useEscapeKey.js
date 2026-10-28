import { useEffect } from "react";

// Cierra un menú o panel con la tecla Escape mientras está abierto
export function useEscapeKey(isActive, onEscape) {
  useEffect(() => {
    if (!isActive) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onEscape();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isActive, onEscape]);
}
