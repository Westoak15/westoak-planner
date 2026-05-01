/**
 * server/routes/ai-voice.ts
 *
 * Endpoints:
 *   POST /api/ai/voice-fill   — AI maps spoken text to plan field values
 *   POST /api/ai/meeting-summary — transcribe + summarise a recorded meeting
 *
 * Mount in server/routes.ts:
 *   import aiVoiceRouter from "./routes/ai-voice.js";
 *   app.use("/api/ai", aiVoiceRouter);
 */

import { Router } from "express";
import OpenAI from "openai";
import type { AuthRequest } from "../auth/index.js";

const r = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware — mirrors your reports.ts pattern
// ─────────────────────────────────────────────────────────────────────────────
r.use((req: any, res, next) => {
  // Token-in-query fallback for EventSource / download links
  if (!req.session?.staffId && req.query?.token) {
    req.session = req.session || {};
    req.session.staffId = req.query.token;
  }
  if (!req.session?.staffId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/voice-fill
// Body: { text: string, moduleId: string, fieldSchema: string[] }
// Returns: { fields: Record<string, string> }
// ─────────────────────────────────────────────────────────────────────────────
r.post("/voice-fill", async (req: AuthRequest, res) => {
  try {
    const { text, moduleId, fieldSchema } = req.body as {
      text: string;
      moduleId: string;
      fieldSchema: string[];
    };

    if (!text || !fieldSchema?.length) {
      return res.status(400).json({ message: "text and fieldSchema are required" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a financial planning assistant helping a Canadian advisor fill out a ${moduleId} section.
The advisor has spoken naturally. Extract values for the following fields: ${fieldSchema.join(", ")}.
Return ONLY a JSON object where keys are field names from the schema and values are the extracted strings.
For monetary values, return numbers only (no $ or commas). For percentages, return the number only.
Omit fields that were not mentioned. Do not invent values.`,
        },
        { role: "user", content: text },
      ],
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const fields = JSON.parse(raw);
    res.json({ fields });
  } catch (err) {
    console.error("[ai-voice] voice-fill error:", err);
    res.status(500).json({ message: "Failed to process voice input" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/meeting-summary
// Body: { audio?: string (base64 webm), transcript?: string, clientId, clientName }
// Returns: { summary, actionItems, fieldSuggestions, transcript }
// ─────────────────────────────────────────────────────────────────────────────
r.post("/meeting-summary", async (req: AuthRequest, res) => {
  try {
    const { audio, transcript: browserTranscript, clientId, clientName } = req.body as {
      audio?: string;
      transcript?: string;
      clientId: number;
      clientName: string;
    };

    let transcript = browserTranscript ?? "";

    // If audio provided and transcript is thin, run Whisper
    if (audio && transcript.split(" ").length < 20) {
      const audioBuffer = Buffer.from(audio, "base64");
      const audioFile = new File([audioBuffer], "recording.webm", { type: "audio/webm" });
      const whisperRes = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: audioFile,
        language: "en",
      });
      transcript = whisperRes.text;
    }

    if (!transcript) {
      return res.status(400).json({ message: "No transcript available to summarise" });
    }

    // AI summary + field extraction
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a Canadian financial planning assistant. Analyse this advisor-client meeting transcript and return a JSON object with:
{
  "summary": "2-4 sentence plain-language summary of key planning points discussed",
  "actionItems": ["action item 1", "action item 2", ...],
  "fieldSuggestions": [
    { "module": "net-worth", "field": "primaryResidence", "value": "850000" },
    { "module": "cash-flow", "field": "annualIncome", "value": "185000" },
    ...
  ]
}

Available modules: net-worth, cash-flow, tax, rrsp, tfsa, retirement, insurance, estate, goals, education.
For fieldSuggestions, only include values clearly stated or strongly implied. Monetary values as numbers only.
Action items should be specific next steps for the advisor.`,
        },
        {
          role: "user",
          content: `Client: ${clientName} (ID: ${clientId})\n\nTranscript:\n${transcript}`,
        },
      ],
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);

    res.json({
      transcript,
      summary: parsed.summary ?? "",
      actionItems: parsed.actionItems ?? [],
      fieldSuggestions: parsed.fieldSuggestions ?? [],
    });
  } catch (err) {
    console.error("[ai-voice] meeting-summary error:", err);
    res.status(500).json({ message: "Failed to process meeting recording" });
  }
});

export default r;
