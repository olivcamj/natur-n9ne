import { vi } from 'vitest';

// Kept in its own module (no app imports) so setup.ts can use it before the
// test env vars are in place.
export const fetchMock = vi.fn<typeof fetch>();
