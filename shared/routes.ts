import { z } from "zod";

const any = z.any();
const anyArr = z.array(z.any());

export const errorSchemas = {
  400: { description: "Bad Request" },
  401: { description: "Unauthorized" },
  404: { description: "Not Found" },
  500: { description: "Internal Server Error" },
};

export const api = {
  plans: {
    list: {
      method: "GET" as const,
      path: "/api/clients/:clientId/plans",
      responses: { 200: anyArr },
    },
    create: {
      method: "POST" as const,
      path: "/api/clients/:clientId/plans",
      responses: { 201: any },
    },
  },
} as const;

const BASE = "";

export function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return path;
  let url = path;
  const remaining: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (url.includes(`:${k}`)) {
      url = url.replace(`:${k}`, String(v));
    } else {
      remaining[k] = String(v);
    }
  }
  const qs = Object.entries(remaining).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return qs ? `${url}?${qs}` : url;
}
