import type { z } from 'zod';

import type { Config } from '@src/types/config.js';

import { configSchema } from '@src/types/config.js';

export function createMockConfig(
  config: z.input<typeof configSchema> = {},
): Config {
  return configSchema.parse(config);
}
