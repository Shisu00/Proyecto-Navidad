import { enumLabels } from "../lib/labels.js";

export default function StatusChip({ displayStatus }) {
  return (
    <span className={`chip chip-${displayStatus.toLowerCase()}`}>
      {enumLabels.displayStatus[displayStatus] ?? displayStatus}
    </span>
  );
}
