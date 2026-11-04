// The app's pages. Keep in step with PAGES in server/app/assistant/knowledge.py; a server test fails if they drift.

export const pages = [
  { id: "home", title: "Home" },
  { id: "learn", title: "Learn the sounds" },
  { id: "listen", title: "Listen" },
  { id: "compare", title: "Compare two dates" },
  { id: "about", title: "About the data" },
] as const;

export type Page = (typeof pages)[number]["id"];

export function isPage(value: string): value is Page {
  return pages.some(page => page.id === value);
}
