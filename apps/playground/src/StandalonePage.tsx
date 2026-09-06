import { useNavigate } from "react-router-dom";
import { PageView, pageById } from "./pages";

// The standalone shell is nothing but the page itself, rendered full-screen
// at /pageN. Identical content to the window; the only difference is what
// "go to Page N" means here: a real route change.

export function StandalonePage({ pageId }: { pageId: string }) {
  const navigate = useNavigate();
  const def = pageById(pageId);
  if (!def) return null;
  return (
    <div style={{ padding: 24 }}>
      <PageView
        def={def}
        onGo={(id) => {
          navigate(`/${id}`);
        }}
      />
    </div>
  );
}
