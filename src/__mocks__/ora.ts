import { vi } from 'vitest';

export default function ora(): {
  start: () => {
    text: string;
    succeed: ReturnType<typeof vi.fn>;
    fail: ReturnType<typeof vi.fn>;
  };
} {
  return {
    start: () => ({
      text: '',
      succeed: vi.fn(),
      fail: vi.fn(),
    }),
  };
}
