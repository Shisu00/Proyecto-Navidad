import { useEffect, useRef } from "react";
import * as deliveriesService from "../services/deliveriesService.js";

const DEBOUNCE_MS = 400;

// Agrupa ráfagas de eventos (varias entregas seguidas) en una sola recarga
export function useRealtimeDeliveries(campaignId, onChange) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!campaignId) return undefined;
    let timer = null;
    const unsubscribe = deliveriesService.subscribeToDeliveries(campaignId, () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [campaignId]);
}
