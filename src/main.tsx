import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LOCALE_PATHS, localeFromPath } from "./i18n";
import "./styles.css";

const initialLocale = localeFromPath();
const localizedPath = LOCALE_PATHS[initialLocale];

if (window.location.pathname === "/" && localizedPath !== "/") {
  window.location.replace(
    `${localizedPath}${window.location.search}${window.location.hash}`,
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
