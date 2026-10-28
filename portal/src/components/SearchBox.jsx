import { labels } from "../lib/labels.js";
import Icon from "./Icon.jsx";

// Campo de búsqueda en forma de píldora con lupa y botón para borrar
export default function SearchBox({
  value,
  onChange,
  onClear,
  onBlur,
  label,
  placeholder,
  describedBy,
  inputRef,
  disabled,
  inputMode,
}) {
  return (
    <div className="searchbox">
      <Icon name="search" />
      <input
        ref={inputRef}
        type="search"
        autoComplete="off"
        inputMode={inputMode}
        aria-label={label}
        aria-describedby={describedBy}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
      />
      {value && !disabled ? (
        <button
          type="button"
          className="searchbox-clear"
          aria-label={labels.app.clearSearch}
          onClick={onClear}
        >
          <Icon name="close" />
        </button>
      ) : null}
    </div>
  );
}
