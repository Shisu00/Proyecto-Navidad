import { labels } from "../lib/labels.js";

export default function Pager({ page, pages, label, onPage }) {
  if (pages <= 1) return null;

  return (
    <nav className="pager" aria-label={label}>
      <button
        type="button"
        className="button button-quiet"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        {labels.app.pagePrevious}
      </button>
      <span>{labels.app.pageOf(page + 1, pages)}</span>
      <button
        type="button"
        className="button button-quiet"
        disabled={page + 1 >= pages}
        onClick={() => onPage(page + 1)}
      >
        {labels.app.pageNext}
      </button>
    </nav>
  );
}
