import { labels } from "../lib/labels.js";

export default function DetailItem({ term, fallback, children }) {
  return (
    <div className="detail-item">
      <dt>{term}</dt>
      <dd>{children || fallback || labels.inscription.detailNotProvided}</dd>
    </div>
  );
}
