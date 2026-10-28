import { useState } from "react";
import { useEscapeKey } from "../hooks/useEscapeKey.js";
import { labels } from "../lib/labels.js";
import Icon from "./Icon.jsx";

// Barra inferior del teléfono: el trabajo diario y, si corresponde, el menú de Administración
export default function MobileNav({ topItems, sideItems, activeView, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  useEscapeKey(isOpen, () => setIsOpen(false));

  const isAdminView = sideItems.some((item) => item.key === activeView);

  function go(key) {
    setIsOpen(false);
    onNavigate(key);
  }

  return (
    <>
      {isOpen ? (
        <>
          <button
            type="button"
            className="mobile-backdrop"
            aria-label={labels.nav.closeMenu}
            tabIndex={-1}
            onClick={() => setIsOpen(false)}
          />
          <div className="mobile-sheet" role="group" aria-label={labels.nav.admin}>
            <p className="mobile-sheet-title">{labels.nav.admin}</p>
            {sideItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className="mobile-sheet-item"
                aria-current={item.key === activeView ? "page" : undefined}
                onClick={() => go(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <nav className="mobile-nav" aria-label={labels.nav.main}>
        {topItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className="mobile-nav-item"
            aria-current={item.key === activeView ? "page" : undefined}
            onClick={() => go(item.key)}
          >
            <Icon name={item.icon} />
            <span>{item.shortLabel ?? item.label}</span>
          </button>
        ))}
        {sideItems.length > 0 ? (
          <button
            type="button"
            className="mobile-nav-item"
            aria-expanded={isOpen}
            aria-current={isAdminView && !isOpen ? "page" : undefined}
            onClick={() => setIsOpen((previous) => !previous)}
          >
            <Icon name="menu" />
            <span>{labels.nav.adminShort}</span>
          </button>
        ) : null}
      </nav>
    </>
  );
}
