import { z } from 'zod';
import { financialPlans, insertFinancialPlanSchema } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  plans: {
    list: {
      method: 'GET' as const,
      path: '/api/clients/:clientId/plans' as const,
      responses: {
        200: z.array(z.custom<typeof financialPlans.$inferSelect>()),
      },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
