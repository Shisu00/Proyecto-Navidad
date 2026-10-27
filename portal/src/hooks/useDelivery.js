import * as deliveriesService from "../services/deliveriesService.js";
import { useAsyncAction } from "./useAsyncAction.js";

export function useConfirmDelivery() {
  return useAsyncAction(deliveriesService.confirmDelivery);
}

export function useVoidDelivery() {
  return useAsyncAction(deliveriesService.voidDelivery);
}
