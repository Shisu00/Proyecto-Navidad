import { useEffect, useId, useRef, useState } from "react";
import { labels } from "../lib/labels.js";
import { parseSearchText } from "../lib/searchQuery.js";
import SearchBox from "./SearchBox.jsx";

const SEARCH_DELAY_MS = 400;

// Busca mientras se escribe, sin una consulta por tecla. Si el texto queda corto o vacío,
// la búsqueda se quita de inmediato.
export default function IdSearch({ onSearch }) {
  const hintId = useId();
  const [text, setText] = useState("");
  const query = parseSearchText(text);
  const onSearchRef = useRef(onSearch);
  const lastRef = useRef("");
  onSearchRef.current = onSearch;

  useEffect(() => {
    if (query === lastRef.current) return undefined;
    // Quitar la búsqueda es inmediato; aplicar una nueva espera a que termine de escribir
    const delay = query === "" ? 0 : SEARCH_DELAY_MS;
    const timer = setTimeout(() => {
      lastRef.current = query;
      onSearchRef.current(query);
    }, delay);
    return () => clearTimeout(timer);
  }, [query]);

  const isTooShort = text.trim() !== "" && query === "";

  return (
    <div className="search-block" role="search">
      <SearchBox
        value={text}
        onChange={(event) => setText(event.target.value)}
        onClear={() => setText("")}
        label={labels.inscription.searchLabel}
        placeholder={labels.inscription.searchPlaceholder}
        describedBy={hintId}
      />
      <p id={hintId} className={isTooShort ? "field-hint" : "visually-hidden"}>
        {isTooShort ? labels.inscription.searchTooShort : labels.inscription.searchHint}
      </p>
    </div>
  );
}
