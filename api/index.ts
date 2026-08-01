import type { Request, Response } from 'express';
import { createApp } from '../server';

const appPromise = createApp();

export default async function handler(req: Request, res: Response) {
  const app = await appPromise;
  const path = typeof req.query.path === 'string' ? req.query.path : '';

  if (path) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'path') continue;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'string') query.append(key, item);
        });
      }
      else if (typeof value === 'string') query.set(key, value);
    }

    req.url = `/api/${path}${query.size ? `?${query}` : ''}`;
  }

  return app(req, res);
}
