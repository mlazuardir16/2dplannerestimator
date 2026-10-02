import { useEffect, useMemo, useRef, useState } from "react";
import { calculateRab, getRabTemplates } from "@/lib/api";
import { buildRabRequest, templateForProject } from "@/lib/rabInputs";

const DEBOUNCE_MS = 300;

// The template catalogue is static seed data — fetch it once per page load.
let catalogPromise = null;
function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = getRabTemplates().catch((e) => {
      catalogPromise = null; // allow a retry on the next mount
      throw e;
    });
  }
  return catalogPromise;
}

// Runs the backend RAB engine for the current project: rebuilds the request
// from the drawing + saved inputs on every change and recalculates after a
// short debounce. Keeps showing the last result while a new one is in flight.
export function useRab(project) {
  const [catalog, setCatalog] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const latest = useRef(0);

  useEffect(() => {
    let alive = true;
    loadCatalog()
      .then((c) => alive && setCatalog(c))
      .catch(() => alive && setError("Gagal memuat data template RAB"));
    return () => {
      alive = false;
    };
  }, []);

  const built = useMemo(
    () => (catalog && project ? buildRabRequest(project, catalog) : null),
    [catalog, project]
  );
  const requestKey = built ? JSON.stringify(built.request) : null;

  useEffect(() => {
    if (!requestKey) return undefined;
    const id = ++latest.current;
    setLoading(true);
    const timer = setTimeout(() => {
      calculateRab(JSON.parse(requestKey))
        .then((r) => {
          if (id !== latest.current) return;
          setResult(r);
          setError(null);
        })
        .catch((e) => {
          if (id !== latest.current) return;
          setError(e?.response?.data?.detail || "Gagal menghitung RAB");
        })
        .finally(() => id === latest.current && setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [requestKey]);

  const template = templateForProject(project);
  return {
    catalog,
    templateInfo: catalog?.templates?.find((t) => t.key === template) || null,
    supported: Boolean(template),
    built,
    // A result for another template (e.g. right after adding a floor) is stale.
    result: result && result.template === template ? result : null,
    loading,
    error,
  };
}
