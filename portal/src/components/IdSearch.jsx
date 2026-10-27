import { useState } from "react";
import { normalizeIdNumber } from "../lib/identification.js";
import { labels } from "../lib/labels.js";
import Field from "./Field.jsx";

const MIN_SEARCH_LENGTH = 3;

export default function IdSearch({ onSearch, hasActiveSearch }) {
  const [text, setText] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const normalized = normalizeIdNumber(text);
    if (normalized.length >= MIN_SEARCH_LENGTH) onSearch(normalized);
  }

  function handleClear() {
    setText("");
    onSearch("");
  }

  return (
    <form className="search" onSubmit={handleSubmit} role="search">
      <Field label={labels.inscription.searchLabel} hint={labels.inscription.searchHint}>
        {(props) => (
          <input
            {...props}
            type="search"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        )}
      </Field>
      <div className="search-actions">
        <button type="submit" className="button button-primary">
          {labels.inscription.searchSubmit}
        </button>
        {hasActiveSearch ? (
          <button type="button" className="button button-quiet" onClick={handleClear}>
            {labels.inscription.searchClear}
          </button>
        ) : null}
      </div>
    </form>
  );
}
