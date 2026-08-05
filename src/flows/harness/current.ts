import type { FakeServer } from './server';

/** The server the mocked edge client talks to, swapped per test by makeApp(). */
let server: FakeServer | null = null;

export function setServer(next: FakeServer): void {
  server = next;
}

export function currentServer(): FakeServer {
  if (!server) throw new Error('no FakeServer — call makeApp() first');
  return server;
}
