import type { CSSProperties } from "react";

// The page registry is the single source of truth. Both shells read it:
//
//   main.tsx      route table  /page1 /page2 /page3  -> StandalonePage shell
//   App.tsx       apps         page1..3               -> window content
//
// A page component never navigates by itself; the shell hands it an onGo
// callback that means "open a window" inside the desktop and "change the
// browser URL" in the standalone route. That is the whole trick: the content
// is atomic, the shell decides what "go to page 2" does.

export interface PageDef {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  heading: string;
  body: string;
}

export const PAGES: PageDef[] = [
  {
    id: "page1",
    name: "Page 1",
    tagline: "Overview",
    accent: "#5b8def",
    heading: "Page 1 · Overview",
    body: "This page renders from one shared component in two shells: http://localhost:5173/page1 shows it standalone and full-screen; the Page 1 app shows the exact same component inside a window.",
  },
  {
    id: "page2",
    name: "Page 2",
    tagline: "Details",
    accent: "#e5a13c",
    heading: "Page 2 · Details",
    body: "Visit this URL directly and you get the full-screen site shell with a real address bar. Click it from inside the desktop and the URL never moves; a window opens instead.",
  },
  {
    id: "page3",
    name: "Page 3",
    tagline: "Contact",
    accent: "#46b26d",
    heading: "Page 3 · Contact",
    body: "Use the buttons below to try page-to-page navigation. Inside a window a click opens or focuses a window and the URL stays put; on the standalone route the same click is a real navigation.",
  },
];

export function pageById(id: string | undefined): PageDef | undefined {
  return PAGES.find((p) => p.id === id);
}

const linkRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 14,
};

export function PageView({ def, onGo }: { def: PageDef; onGo: (id: string) => void }) {
  const others = PAGES.filter((p) => p.id !== def.id);
  return (
    <div style={{ padding: 4 }}>
      <div
        style={{
          background: `${def.accent}26`,
          border: `1px solid ${def.accent}66`,
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, color: def.accent, fontSize: 16 }}>{def.heading}</h3>
        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{def.tagline}</div>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, opacity: 0.88 }}>
        {def.body}
      </p>
      <div style={linkRow}>
        {others.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              onGo(p.id);
            }}
            style={{
              border: `1px solid ${p.accent}88`,
              background: `${p.accent}1f`,
              color: "inherit",
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {p.name} {"->"}
          </button>
        ))}
      </div>
    </div>
  );
}
