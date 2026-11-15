// The app's pages. Keep in step with PAGES in server/app/assistant/knowledge.py; a server test fails if they drift.
// `shortTitle` is the visible label in the mobile navigation bar. It must be the start of `title`, so that what
// people see is part of what screen readers and voice control hear (WCAG 2.5.3).

export const pages = [
  { id: "home", title: "Home", shortTitle: "Home" },
  { id: "learn", title: "Learn the sounds", shortTitle: "Learn" },
  { id: "listen", title: "Listen", shortTitle: "Listen" },
  { id: "about", title: "About the data", shortTitle: "About" },
] as const;

export type Page = (typeof pages)[number]["id"];

export function isPage(value: string): value is Page {
  return pages.some(page => page.id === value);
}
