import { useState, useRef, useCallback } from "react";
import { api } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Types — MUST match the server response in /server/routes/ai-voice.ts
// ─────────────────────────────────────────────────────────────────────────────
export type RecordingState = "idle" | "recording" | "processing" | "done" | "error";

export interface MeetingSummary {
  rawSummary: string;
  keyFigures: Array<{ label: string; value: string }>;
  goals: string[];
  actionItems: string[];
  recommendedAreas: string[];
}

export interface ExtractedAsset      { category: string; name: string; value: string; owner: string; }
export interface ExtractedLiability  { category: string; name: string; value: string; owner: string; }
export interface ExtractedGoal       { title: string; goalType: string; targetAmount: string; targetDate?: string; notes?: string; }
export interface ExtractedEducation  { childName: string; childDob?: string; currentRespBalance?: string; annualContribution?: string; targetAmount?: string; notes?: string; }

export interface ExtractedRecords {
  assets:      ExtractedAsset[];
  liabilities: ExtractedLiability[];
  goals:       ExtractedGoal[];
  education:   ExtractedEducation[];
}

interface MeetingResponse {
  transcript: string;
  summary:    MeetingSummary;
  records:    ExtractedRecords;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useMeetingRecorder(clientId: number, clientName: string) {
  const [state, setState]           = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary]       = useState<MeetingSummary | null>(null);
  const [records, setRecords]       = useState<ExtractedRecords | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [duration, setDuration]     = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const recognitionRef   = useRef<any>(null);
  const timerRef         = useRef<number | null>(null);
  const finalTranscript  = useRef("");

  // ── Start ──────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // MediaRecorder — keeps audio for Whisper fallback
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(1000);
      mediaRecorderRef.current = mr;

      // Web Speech API — live transcript
      const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        r.continuous = true;
        r.interimResults = true;
        r.lang = "en-CA";
        recognitionRef.current = r;
        finalTranscript.current = "";

        r.onresult = (ev: any) => {
          let interim = "";
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            if (ev.results[i].isFinal) {
              finalTranscript.current += ev.results[i][0].transcript + " ";
            } else {
              interim += ev.results[i][0].transcript;
            }
          }
          setTranscript(finalTranscript.current + interim);
        };

        r.onend = () => {
          if (mediaRecorderRef.current?.state === "recording") {
            try { recognitionRef.current?.start(); } catch (_) {}
          }
        };

        r.start();
      }

      setDuration(0);
      timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);
      setState("recording");
      setError(null);
    } catch {
      setError("Microphone access denied. Please allow microphone access and try again.");
      setState("error");
    }
  }, []);

  // ── Stop ───────────────────────────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    setState("processing");
    if (timerRef.current) clearInterval(timerRef.current);

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Stop MediaRecorder and WAIT for the final chunk
    let audioBase64: string | undefined;
    if (mediaRecorderRef.current) {
      const mr = mediaRecorderRef.current;
      const stopped = new Promise<void>((resolve) => {
        mr.onstop = () => resolve();
      });
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
      await stopped;
      try {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const buf  = await blob.arrayBuffer();
        let bin    = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
        audioBase64 = btoa(bin);
      } catch (e) {
        console.warn("[meetingRecorder] failed to encode audio:", e);
      }
    }

    const text = finalTranscript.current.trim();

    if (!text && !audioBase64) {
      setError("No speech was detected. Please try again.");
      setState("error");
      return;
    }

    try {
      const result = await api.post<MeetingResponse>("/api/ai/meeting-summary", {
        transcript: text,
        audio: audioBase64,
        clientId,
        clientName,
      });
      setTranscript(result.transcript || text);
      setSummary(result.summary);
      setRecords(result.records);
      setState("done");
    } catch (err: any) {
      setError("Summary generation failed: " + (err.message ?? "unknown error"));
      setState("error");
    }
  }, [clientId, clientName]);

  // ── Discard ────────────────────────────────────────────────────────────────
  // Stops the mic and clears all buffers WITHOUT uploading the audio
  // or transcript anywhere. Used when the user closes the dialog
  // mid-recording (privacy: do not transmit a discarded conversation).
  const discardRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; } catch (_) {}
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current) {
      const mr = mediaRecorderRef.current;
      try { mr.onstop = null; } catch (_) {}
      try { mr.ondataavailable = null; } catch (_) {}
      if (mr.state !== "inactive") {
        try { mr.stop(); } catch (_) {}
      }
      try { mr.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      mediaRecorderRef.current = null;
    }

    audioChunksRef.current  = [];
    finalTranscript.current = "";
    setTranscript("");
    setSummary(null);
    setRecords(null);
    setError(null);
    setDuration(0);
    setState("idle");
  }, []);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setState("idle");
    setTranscript("");
    setSummary(null);
    setRecords(null);
    setError(null);
    setDuration(0);
    finalTranscript.current = "";
    audioChunksRef.current = [];
  }, []);

  return { state, transcript, summary, records, error, duration, startRecording, stopRecording, discardRecording, reset };
}
