// Where the server is. Empty in development, so requests go through the Vite proxy; in production
// VITE_API_URL points the Vercel site at the Render server.

export function apiBase(): string {
  return (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')
}

/** WebSocket URL for a server path, on the API host or else this page's host. */
export function socketUrl(path: string): string {
  const base = apiBase()
  const url = new URL(path, base || window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
