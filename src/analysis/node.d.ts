// The few Node calls the test-only PNG reader and its test use. Declared here, not loaded from @types/node, which would
// change the type of setTimeout for the whole app.

declare module 'node:zlib' {
  export function inflateSync(data: Uint8Array): Uint8Array
}

declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array
  export function readFileSync(path: string, encoding: 'utf8'): string
}

declare module 'node:path' {
  export function resolve(...parts: string[]): string
}

declare module 'node:url' {
  export function fileURLToPath(url: string): string
}
