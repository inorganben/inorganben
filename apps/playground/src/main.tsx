import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import { PAGES } from "./pages";
import { StandalonePage } from "./StandalonePage";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element in index.html");

// Two shells, one page registry. /pageN renders the page full-screen; every
// other path (including /) renders the desktop. In production, static hosting
// needs an SPA fallback rewrite so a direct /page2 request serves index.html.
createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {PAGES.map((p) => (
          <Route
            key={p.id}
            path={`/${p.id}`}
            element={<StandalonePage pageId={p.id} />}
          />
        ))}
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
