import { enumLabels } from "../lib/labels.js";

export default function StatusChip({ status }) {
  return (
    <span className={`chip chip-${status.toLowerCase()}`}>
      {enumLabels.inscriptionStatus[status] ?? status}
    </span>
  );
}
