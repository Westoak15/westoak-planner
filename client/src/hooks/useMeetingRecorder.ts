import { useState, useRef, useCallback } from "react";
import { api } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type RecordingState = "idle" | "recording" | "processing" | "done" | "error";

export interface MeetingSummary {
  keyFigures: Array<{ label: string; value: string }>;
  goals: string[];
  actionItems: string[];
  recommendedAreas: string[];
  rawSummary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useMeetingRecorder(clientId: number) {
  const [state, setState]       = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary]   = useState<MeetingSummary | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef   = useRef<any>(null);
  const timerRef         = useRef<number | null>(null);
  const finalTranscript  = useRef("");   // accumulates across recognition restarts

  // ── Start ──────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // MediaRecorder – keeps the audio blob available for download
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.start(1000);
      mediaRecorderRef.current = mr;

      // Web Speech API – live rolling transcript
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

        // Chrome stops recognition after ~60 s of silence; auto-restart
        r.onend = () => {
          if (mediaRecorderRef.current?.state === "recording") {
            try { recognitionRef.current?.start(); } catch (_) {}
          }
        };

        r.start();
      }

      // Duration counter
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

    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;   // prevent auto-restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Stop media stream
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }

    const text = finalTranscript.current.trim();

    if (!text) {
      setError("No speech was detected. Please try again.");
      setState("error");
      return;
    }

    try {
      const result = await api.post<MeetingSummary>("/api/ai/meeting-summary", {
        transcript: text,
        clientId,
      });
      setSummary(result);
      setState("done");
    } catch (err: any) {
      setError("Summary generation failed: " + (err.message ?? "unknown error"));
      setState("error");
    }
  }, [clientId]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setState("idle");
    setTranscript("");
    setSummary(null);
    setError(null);
    setDuration(0);
    finalTranscript.current = "";
  }, []);

  return { state, transcript, summary, error, duration, startRecording, stopRecording, reset };
}
