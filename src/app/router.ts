export type AppRoute =
  | { view: "gallery" }
  | { view: "editor"; mockupId?: string };

export function parseRoute(hash = location.hash): AppRoute {
  const path = hash.replace(/^#/, "") || "/";

  if (path === "/" || path === "") {
    return { view: "gallery" };
  }

  const editMatch = path.match(/^\/edit(?:\/([a-f0-9-]+))?$/i);
  if (editMatch) {
    return { view: "editor", mockupId: editMatch[1] };
  }

  return { view: "gallery" };
}

export function routeToHash(route: AppRoute): string {
  if (route.view === "gallery") return "#/";
  if (route.mockupId) return `#/edit/${route.mockupId}`;
  return "#/edit";
}

export function navigate(route: AppRoute, replace = false): void {
  const hash = routeToHash(route);
  if (location.hash === hash) return;

  if (replace) {
    history.replaceState(null, "", hash);
  } else {
    location.hash = hash;
  }
}
