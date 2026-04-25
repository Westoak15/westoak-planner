import { z } from "zod";
export const errorSchemas = {
    validation: z.object({ message: z.string(), field: z.string().optional() }),
    notFound: z.object({ message: z.string() }),
    internal: z.object({ message: z.string() }),
};
export const api = {
    plans: {
        list: {
            method: "GET",
            path: "/api/clients/:clientId/plans",
            responses: { 200: z.array(z.any()) },
        },
        create: {
            method: "POST",
            path: "/api/clients/:clientId/plans",
            responses: { 201: z.any() },
        },
    },
};
export function buildUrl(path, params) {
    let url = path;
    const remaining = {};
    for (const [k, v] of Object.entries(params ?? {})) {
        if (v === undefined)
            continue;
        if (url.includes(`:${k}`)) {
            url = url.replace(`:${k}`, String(v));
        }
        else {
            remaining[k] = String(v);
        }
    }
    const qs = Object.entries(remaining).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    return qs ? `${url}?${qs}` : url;
}
