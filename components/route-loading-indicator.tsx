"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteLoadingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reset = window.setTimeout(() => setLoading(false), 180);
    return () => window.clearTimeout(reset);
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleInteraction(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      if (link) {
        const href = link.getAttribute("href");
        const targetWindow = link.getAttribute("target");

        if (!href || href.startsWith("#") || targetWindow === "_blank") {
          return;
        }

        setLoading(true);
        return;
      }

      const submitButton = target.closest("button[type='submit']") as HTMLButtonElement | null;
      if (submitButton && !submitButton.disabled) {
        setLoading(true);
      }
    }

    window.addEventListener("click", handleInteraction, true);
    return () => window.removeEventListener("click", handleInteraction, true);
  }, []);

  if (!loading) {
    return null;
  }

  return (
    <div className="route-loading" aria-live="polite" aria-label="Pagina wordt geladen">
      <div className="route-loading-card">
        <span className="route-spinner" aria-hidden="true" />
        <strong>Even wachten...</strong>
      </div>
    </div>
  );
}
