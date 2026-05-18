/**
 * server/routes/ai-voice.ts
 *
 * Mount in server/routes.ts (same as reports):
 *   import aiVoiceRouter from "./routes/ai-voice.js";
 *   app.use("/api/ai", aiVoiceRouter);
 */

import type { Response } from "express";
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";

const r = Router();

r.use((req: any, res: any, next: any) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return isAuthenticated(req, res, next);
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/meeting-summary
// Body: { transcript: string, clientId: number }
// ─────────────────────────────────────────────────────────────────────────────
r.post("/meeting-summary", async (req: AuthRequest, res: Response) => {
  const { transcript } = req.body as { transcript: string; clientId: number };

  if (!transcript?.trim()) {
    return res.status(400).json({ message: "transcript is required" });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: `You are a financial planning assistant. Extract and structure key planning information from a meeting transcript between a Canadian financial advisor and their client.

Return ONLY valid JSON — no markdown, no prose — in this exact shape:
{
  "keyFigures": [{ "label": "Annual Income", "value": "$120,000" }],
  "goals": ["Retire at 62 with $80,000/year income"],
  "actionItems": ["Review RRSP contribution room"],
  "recommendedAreas": ["Retirement Planning", "Tax Planning"],
  "rawSummary": "One-paragraph plain-English summary."
}

Guidelines:
- keyFigures: dollar amounts, ages, rates, balances mentioned
- goals: client's stated financial, retirement, or life goals
- actionItems: concrete next steps agreed to by advisor or client
- recommendedAreas: choose only from — Retirement Planning, Tax Planning, Estate Planning, Insurance, Education Planning, Net Worth, Debt Management, Cash Flow, Investment Planning, Pension Analysis
- rawSummary: 2–4 sentences
- Return empty arrays if nothing relevant was mentioned`,
      messages: [{ role: "user", content: `Meeting transcript:\n\n${transcript}` }],
    });

    const raw   = (message.content[0] as any).text ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const summary = JSON.parse(clean);

    res.json(summary);
  } catch (err) {
    console.error("meeting-summary error:", err);
    res.status(500).json({ message: "Failed to generate summary" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/voice-field
// Body: { speech, fieldKey, fieldLabel, fieldType, sectionContext }
// ─────────────────────────────────────────────────────────────────────────────
r.post("/voice-field", async (req: AuthRequest, res: Response) => {
  const { speech, fieldKey, fieldLabel, fieldType, sectionContext } =
    req.body as {
      speech: string;
      fieldKey: string;
      fieldLabel: string;
      fieldType: string;
      sectionContext: string;
    };

  if (!speech?.trim()) {
    return res.status(400).json({ message: "speech is required" });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 128,
      system: `You are a data-entry assistant for a Canadian financial planning app.
Extract just the field value from natural speech. Return ONLY valid JSON: { "value": "<extracted value>" }
- number fields: bare number string ("80000" not "$80,000")
- date fields: ISO format "YYYY-MM-DD"
- text fields: clean normalised text
Never return prose — only the JSON object.`,
      messages: [{
        role: "user",
        content: `Field: "${fieldLabel}" (key: ${fieldKey}, type: ${fieldType})\nSection: ${sectionContext || "Financial Planning"}\nSpoken input: "${speech}"`,
      }],
    });

    const raw   = (message.content[0] as any).text ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const { value } = JSON.parse(clean);

    res.json({ value: String(value ?? speech) });
  } catch (err) {
    console.error("voice-field error:", err);
    // Graceful fallback — raw speech beats a blank field
    res.json({ value: speech });
  }
});

export default r;
