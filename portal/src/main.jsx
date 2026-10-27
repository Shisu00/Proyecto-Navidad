import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { hasSupabaseConfig } from "./lib/env.js";
import { labels } from "./lib/labels.js";

const root = createRoot(document.getElementById("root"));

async function bootstrap() {
  if (!hasSupabaseConfig()) {
    root.render(
      <main className="screen">
        <div className="screen-panel">
          <h1>{labels.config.missingTitle}</h1>
          <p>{labels.config.missingBody}</p>
        </div>
      </main>,
    );
    return;
  }

  // Se importa después de validar el entorno: supabaseClient falla sin variables
  const { default: App } = await import("./App.jsx");
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
