import { labels } from "../lib/labels.js";
import ReasonDialog from "./ReasonDialog.jsx";

export default function DuplicateJustificationDialog({
  isSameCouncil,
  isPending,
  errorCode,
  onConfirm,
  onCancel,
}) {
  const where = isSameCouncil
    ? labels.inscription.duplicateSameCouncil
    : labels.inscription.duplicateOtherCouncil;

  return (
    <ReasonDialog
      title={labels.inscription.duplicateTitle}
      description={`${where} ${labels.inscription.duplicateDescription}`}
      reasonLabel={labels.inscription.duplicateReason}
      confirmLabel={labels.inscription.duplicateConfirm}
      isRequired
      isPending={isPending}
      errorCode={errorCode}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
