import createClient from 'openapi-fetch';

import type { paths } from './generated/outline-openapi.d.js';

if (!process.env.OUTLINE_API_KEY) {
  throw new Error('OUTLINE_API_KEY is not set');
}

export const outlineClient = createClient<paths>({
  baseUrl: 'https://app.getoutline.com/api',
  headers: {
    Authorization: `Bearer ${process.env.OUTLINE_API_KEY}`,
    'Content-Type': 'application/json',
  },
});
