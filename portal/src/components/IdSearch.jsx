import { useState } from "react";
import { labels } from "../lib/labels.js";
import { parseSearchText } from "../lib/searchQuery.js";
import Field from "./Field.jsx";

export default function IdSearch({ onSearch, hasActiveSearch }) {
  const [text, setText] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const query = parseSearchText(text);
    if (query) onSearch(query);
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
