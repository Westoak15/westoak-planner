/**
 * server/routes/ai-voice.ts
 *
 * Endpoints (all require Bearer auth):
 *   POST /api/ai/voice-field    — parse a single spoken value for one form field
 *   POST /api/ai/voice-fill     — parse a free-form sentence into a structured draft
 *   POST /api/ai/meeting-summary — transcribe a recording (Whisper) + summarise + extract records
 */

import { Router } from "express";
import OpenAI from "openai";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";

const r = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

r.use(isAuthenticated);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/voice-field
// Body: { speech, fieldKey, fieldLabel, fieldType, sectionContext }
// Returns: { value: string }
// Used by the inline mic button next to a single form field.
// ─────────────────────────────────────────────────────────────────────────────
r.post("/voice-field", async (req: AuthRequest, res) => {
  try {
    const { speech, fieldKey, fieldLabel, fieldType, sectionContext } = req.body as {
      speech: string;
      fieldKey: string;
      fieldLabel: string;
      fieldType?: string;
      sectionContext?: string;
    };

    if (!speech) return res.status(400).json({ message: "speech is required" });
    if (!process.env.OPENAI_API_KEY) {
      // No key — just return the raw transcription so the field still gets a value
      return res.json({ value: speech.trim() });
    }

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are helping a Canadian financial advisor fill the "${fieldLabel}" field${sectionContext ? ` in the ${sectionContext} section` : ""}.
The expected type is "${fieldType ?? "text"}".
Extract the intended value from the user's spoken phrase.
Rules:
- For monetary values: return number only (no $ or commas). "two hundred thousand" → "200000".
- For percentages: number only. "five percent" → "5".
- For dates: ISO format YYYY-MM-DD when possible.
- For text: return cleaned text (trim filler words like "um", "uh", "like").
Return ONLY a JSON object: { "value": "..." }`,
        },
        { role: "user", content: speech },
      ],
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);
    res.json({ value: String(parsed.value ?? speech).trim() });
  } catch (err: any) {
    console.error("[ai-voice] voice-field error:", err);
    // Graceful fallback — just use the raw speech
    res.json({ value: String(req.body?.speech ?? "").trim() });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/voice-fill
// Body: { text, moduleId, fieldSchema: { key, label?, description?, enum? }[] }
//   OR (legacy): { text, moduleId, fieldSchema: string[] }
// Returns: { fields: Record<string, string> }
// Used by the "Voice Add ___" dialog: one utterance → multiple field values.
// ─────────────────────────────────────────────────────────────────────────────
r.post("/voice-fill", async (req: AuthRequest, res) => {
  try {
    const { text, moduleId, fieldSchema } = req.body as {
      text: string;
      moduleId: string;
      fieldSchema: any[];
    };

    if (!text || !fieldSchema?.length) {
      return res.status(400).json({ message: "text and fieldSchema are required" });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ message: "OPENAI_API_KEY is not configured on the server" });
    }

    // Normalise schema (legacy: string[] → object[])
    const normSchema = fieldSchema.map((f: any) =>
      typeof f === "string" ? { key: f } : f,
    );

    const schemaText = normSchema.map((f: any) => {
      const parts = [`- ${f.key}`];
      if (f.label) parts.push(`(label: "${f.label}")`);
      if (f.description) parts.push(`— ${f.description}`);
      if (f.enum) parts.push(`— must be one of: ${(f.enum as string[]).join(", ")}`);
      return parts.join(" ");
    }).join("\n");

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a Canadian financial planning assistant helping an advisor fill a "${moduleId}" form by voice.
The advisor has spoken naturally. Extract values for these fields:
${schemaText}

Rules:
- Return ONLY a JSON object whose keys are field keys above.
- Monetary values: numbers only, no $ or commas (e.g. "250000").
- Percentages: number only (e.g. "5").
- Dates: ISO format "YYYY-MM-DD" when possible.
- For enum fields: pick the closest matching option exactly as written above.
- OMIT fields that were not mentioned. Do not invent values.
- For owner fields, use exactly: "primary", "spouse", or "joint".`,
        },
        { role: "user", content: text },
      ],
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const fields = JSON.parse(raw);
    res.json({ fields });
  } catch (err: any) {
    console.error("[ai-voice] voice-fill error:", err);
    res.status(500).json({ message: "Failed to process voice input: " + (err?.message ?? err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/meeting-summary
// Body: { audio?: base64-webm, transcript?, clientId, clientName }
// Returns:
//   {
//     transcript,
//     summary: { rawSummary, keyFigures, goals, actionItems, recommendedAreas },
//     records: { assets[], liabilities[], goals[], education[] }
//   }
// ─────────────────────────────────────────────────────────────────────────────
r.post("/meeting-summary", async (req: AuthRequest, res) => {
  try {
    const { audio, transcript: browserTranscript, clientId, clientName } = req.body as {
      audio?: string;
      transcript?: string;
      clientId: number;
      clientName: string;
    };

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ message: "OPENAI_API_KEY is not configured on the server" });
    }

    let transcript = (browserTranscript ?? "").trim();

    // If audio provided and transcript is thin, run Whisper
    if (audio && transcript.split(/\s+/).filter(Boolean).length < 20) {
      try {
        const audioBuffer = Buffer.from(audio, "base64");
        const audioFile = new File([audioBuffer], "recording.webm", { type: "audio/webm" });
        const whisperRes = await getOpenAI().audio.transcriptions.create({
          model: "whisper-1",
          file: audioFile,
          language: "en",
        });
        transcript = whisperRes.text;
      } catch (e: any) {
        console.error("[ai-voice] whisper failed:", e?.message ?? e);
        // fall through with browser transcript
      }
    }

    if (!transcript) {
      return res.status(400).json({ message: "No transcript available to summarise" });
    }

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a Canadian financial planning assistant. Analyse this advisor-client meeting transcript and return a JSON object with TWO top-level sections: "summary" (for human display) and "records" (structured data the advisor can save directly).

Schema:
{
  "summary": {
    "rawSummary": "2-4 sentence plain-language summary of the meeting",
    "keyFigures": [{ "label": "Annual income", "value": "$185,000" }, ...],
    "goals": ["Retire at 60", "Save for child's university"],
    "actionItems": ["Review beneficiary on TFSA", ...],
    "recommendedAreas": ["Retirement planning", "Estate"]
  },
  "records": {
    "assets": [
      { "category": "TFSA|RRSP|Non-Registered|Cash / Bank|Principal Residence|Real Estate (other)|Business|Employer Stock Options|Other Asset",
        "name": "TD TFSA",
        "value": "30000",
        "owner": "primary|spouse|joint" }
    ],
    "liabilities": [
      { "category": "Mortgage|HELOC|Car Loan|Credit Card|Student Loan|Line of Credit|Other Liability",
        "name": "RBC Mortgage",
        "value": "320000",
        "owner": "primary|spouse|joint" }
    ],
    "goals": [
      { "title": "Retire at 60",
        "goalType": "retirement|savings|debt|education|home|travel|other",
        "targetAmount": "1500000",
        "targetDate": "2045-01-01",
        "notes": "" }
    ],
    "education": [
      { "childName": "Sarah",
        "childDob": "2015-06-12",
        "currentRespBalance": "12000",
        "annualContribution": "2500",
        "targetAmount": "60000",
        "notes": "" }
    ]
  }
}

Rules:
- Only include records that were CLEARLY mentioned. Don't invent values.
- Monetary values: numbers only, no $ or commas.
- Dates: "YYYY-MM-DD".
- Owner: "primary" for the main client, "spouse" for partner, "joint" for jointly held.
- Empty arrays are fine. Empty strings are fine. Just don't make things up.`,
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
      summary: {
        rawSummary:       parsed.summary?.rawSummary ?? "",
        keyFigures:       Array.isArray(parsed.summary?.keyFigures)       ? parsed.summary.keyFigures       : [],
        goals:            Array.isArray(parsed.summary?.goals)            ? parsed.summary.goals            : [],
        actionItems:      Array.isArray(parsed.summary?.actionItems)      ? parsed.summary.actionItems      : [],
        recommendedAreas: Array.isArray(parsed.summary?.recommendedAreas) ? parsed.summary.recommendedAreas : [],
      },
      records: {
        assets:      Array.isArray(parsed.records?.assets)      ? parsed.records.assets      : [],
        liabilities: Array.isArray(parsed.records?.liabilities) ? parsed.records.liabilities : [],
        goals:       Array.isArray(parsed.records?.goals)       ? parsed.records.goals       : [],
        education:   Array.isArray(parsed.records?.education)   ? parsed.records.education   : [],
      },
    });
  } catch (err: any) {
    console.error("[ai-voice] meeting-summary error:", err);
    res.status(500).json({ message: "Failed to process meeting recording: " + (err?.message ?? err) });
  }
});

export default r;
