import { useState } from "react";
import { Mic, MicOff, Square, X, Download, Copy, Check, Loader2, FileText, Target, ListChecks, LayoutGrid, Database, Plus } from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { useMeetingRecorder, type MeetingSummary, type ExtractedRecords } from "../hooks/useMeetingRecorder";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtDuration(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function totalRecords(r: ExtractedRecords): number {
  return r.assets.length + r.liabilities.length + r.goals.length + r.education.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enum allow-lists — keep in sync with NW_ASSET_CATS / NW_LIAB_CATS
// (in MultiEntryTabs.tsx) and the goal type list in GoalsTab.tsx. Used to
// snap LLM-returned values to known categories before persisting, so an
// invalid model output never lands in the DB.
// ─────────────────────────────────────────────────────────────────────────────
const ASSET_CATS = ["Principal Residence", "Real Estate (other)", "RRSP", "TFSA", "Non-Registered", "Cash / Bank", "Business", "Employer Stock Options", "Other Asset"] as const;
const LIAB_CATS  = ["Mortgage", "HELOC", "Car Loan", "Credit Card", "Student Loan", "Line of Credit", "Other Liability"] as const;
const OWNERS     = ["primary", "spouse", "joint"] as const;
const GOAL_TYPES = ["retirement", "savings", "debt", "education", "home", "travel", "other"] as const;

function snapEnum<T extends string>(value: string | undefined | null, allowed: readonly T[], fallback: T): T {
  if (!value) return fallback;
  const v = String(value).trim().toLowerCase();
  const hit = allowed.find(a => a.toLowerCase() === v);
  return (hit ?? fallback) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pill trigger button — placed in the App header bar
// ─────────────────────────────────────────────────────────────────────────────
interface MeetingRecorderTriggerProps {
  clientId: number;
  clientName: string;
  onRecordsCreated?: () => void;
}

export function MeetingRecorderTrigger({ clientId, clientName, onRecordsCreated }: MeetingRecorderTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Record meeting"
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#0c1e3a] border border-gray-200 hover:border-gray-300 px-2.5 py-1 rounded-lg transition-colors"
      >
        <Mic className="w-3.5 h-3.5" />
        Record
      </button>

      {open && (
        <MeetingRecorderModal
          clientId={clientId}
          clientName={clientName}
          onClose={() => setOpen(false)}
          onRecordsCreated={onRecordsCreated}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────
interface ModalProps {
  clientId: number;
  clientName: string;
  onClose: () => void;
  onRecordsCreated?: () => void;
}

function MeetingRecorderModal({ clientId, clientName, onClose, onRecordsCreated }: ModalProps) {
  const { state, transcript, summary, records, error, duration, startRecording, stopRecording, discardRecording, reset } =
    useMeetingRecorder(clientId, clientName);

  const [copied, setCopied] = useState(false);

  function handleClose() {
    if (state === "recording") {
      if (!confirm("Recording in progress. Stop and discard? The audio will NOT be uploaded or summarised.")) return;
      // Privacy: discardRecording stops the mic and clears all buffers
      // WITHOUT calling /api/ai/meeting-summary.
      discardRecording();
    } else {
      reset();
    }
    onClose();
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadTranscript() {
    const blob = new Blob([transcript], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `meeting-${clientName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              state === "recording" ? "bg-red-100" : "bg-[#0c1e3a]/10"
            )}>
              <Mic className={cn("w-4 h-4", state === "recording" ? "text-red-500" : "text-[#0c1e3a]")} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Meeting Recorder</h2>
              <p className="text-xs text-gray-400">{clientName}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-300 hover:text-gray-600 transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {state === "idle" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 bg-[#0c1e3a]/5 rounded-full flex items-center justify-center mb-4">
                <Mic className="w-7 h-7 text-[#0c1e3a]" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">Ready to record</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-sm">
                Hit record to start capturing the meeting. The AI will transcribe in real time
                and extract any assets, liabilities, goals or RESP data into editable records.
              </p>
              <button
                onClick={startRecording}
                className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                <Mic className="w-4 h-4" /> Start Recording
              </button>
            </div>
          )}

          {state === "recording" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold text-red-600">Recording</span>
                  <span className="text-sm text-gray-400 tabular-nums">{fmtDuration(duration)}</span>
                </div>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                >
                  <Square className="w-3.5 h-3.5 fill-white" /> Stop & Summarise
                </button>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 min-h-[180px] max-h-[280px] overflow-y-auto">
                {transcript ? (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{transcript}</p>
                ) : (
                  <p className="text-sm text-gray-300 italic">Listening — speak to see transcript appear here…</p>
                )}
              </div>
            </>
          )}

          {state === "processing" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-8 h-8 text-[#0c1e3a] animate-spin mb-3" />
              <p className="text-sm font-semibold text-gray-700">Generating AI summary…</p>
              <p className="text-xs text-gray-400 mt-1">Transcribing audio and extracting records</p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                <MicOff className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-sm font-semibold text-red-600 mb-1">Something went wrong</p>
              <p className="text-xs text-gray-400 mb-5">{error}</p>
              <button onClick={reset} className="text-sm font-semibold text-[#0c1e3a] hover:underline">Try again</button>
            </div>
          )}

          {state === "done" && summary && records && (
            <SummaryView
              summary={summary}
              records={records}
              transcript={transcript}
              clientId={clientId}
              copied={copied}
              onCopy={copyText}
              onDownload={downloadTranscript}
              onReset={reset}
              onRecordsCreated={() => { onRecordsCreated?.(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary View — shows summary + extracted records with Create button
// ─────────────────────────────────────────────────────────────────────────────
interface SummaryViewProps {
  summary: MeetingSummary;
  records: ExtractedRecords;
  transcript: string;
  clientId: number;
  copied: boolean;
  onCopy: (t: string) => void;
  onDownload: () => void;
  onReset: () => void;
  onRecordsCreated: () => void;
}

function SummaryView({ summary, records, transcript, clientId, copied, onCopy, onDownload, onReset, onRecordsCreated }: SummaryViewProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [creating, setCreating]             = useState(false);
  const [created, setCreated]               = useState<{ count: number; errors: string[] } | null>(null);

  // Per-record selection — start with everything selected
  const [selected, setSelected] = useState({
    assets:      records.assets.map((_, i) => i),
    liabilities: records.liabilities.map((_, i) => i),
    goals:       records.goals.map((_, i) => i),
    education:   records.education.map((_, i) => i),
  });

  function toggle(kind: keyof typeof selected, i: number) {
    setSelected(s => ({
      ...s,
      [kind]: s[kind].includes(i) ? s[kind].filter(x => x !== i) : [...s[kind], i],
    }));
  }

  const totalSelected = selected.assets.length + selected.liabilities.length + selected.goals.length + selected.education.length;
  const totalAvailable = totalRecords(records);

  async function createRecords() {
    setCreating(true);
    const errors: string[] = [];
    let count = 0;

    // Helper: strip $/commas/text and keep just digits + decimal
    const numOnly = (v: any) => String(v ?? "").replace(/[^0-9.]/g, "");

    try {
      // Assets — snap category & owner to known enums
      for (const i of selected.assets) {
        const a = records.assets[i];
        const category = snapEnum(a.category, ASSET_CATS, "Other Asset");
        const owner    = snapEnum(a.owner,    OWNERS,     "primary");
        try {
          await api.post(`/api/clients/${clientId}/net-worth`, {
            type: "asset", category,
            name:  a.name || category,
            owner,
            value: numOnly(a.value) || "0",
            notes: "From meeting recorder",
            metadata: {},
          });
          count++;
        } catch (e: any) { errors.push(`Asset "${a.name}": ${e.message ?? e}`); }
      }
      // Liabilities
      for (const i of selected.liabilities) {
        const l = records.liabilities[i];
        const category = snapEnum(l.category, LIAB_CATS, "Other Liability");
        const owner    = snapEnum(l.owner,    OWNERS,    "primary");
        try {
          await api.post(`/api/clients/${clientId}/net-worth`, {
            type: "liability", category,
            name:  l.name || category,
            owner,
            value: numOnly(l.value) || "0",
            notes: "From meeting recorder",
            metadata: {},
          });
          count++;
        } catch (e: any) { errors.push(`Liability "${l.name}": ${e.message ?? e}`); }
      }
      // Goals
      for (const i of selected.goals) {
        const g = records.goals[i];
        const goalType = snapEnum(g.goalType, GOAL_TYPES, "other");
        try {
          await api.post(`/api/clients/${clientId}/goals`, {
            title: g.title || "Untitled Goal",
            goalType,
            targetAmount: numOnly(g.targetAmount) || null,
            targetDate:   g.targetDate || null,
            notes:        g.notes || "From meeting recorder",
          });
          count++;
        } catch (e: any) { errors.push(`Goal "${g.title}": ${e.message ?? e}`); }
      }
      // Education
      for (const i of selected.education) {
        const e2 = records.education[i];
        if (!e2.childName) { errors.push(`Education record skipped (no child name)`); continue; }
        try {
          await api.post(`/api/clients/${clientId}/education`, {
            childName:          e2.childName,
            childDob:           e2.childDob || "",
            currentRespBalance: numOnly(e2.currentRespBalance),
            annualContribution: numOnly(e2.annualContribution) || "2500",
            targetAmount:       numOnly(e2.targetAmount),
            notes:              e2.notes || "From meeting recorder",
          });
          count++;
        } catch (e: any) { errors.push(`Education "${e2.childName}": ${e.message ?? e}`); }
      }

      setCreated({ count, errors });
      if (count > 0) onRecordsCreated();
    } finally {
      setCreating(false);
    }
  }

  const fullText = [
    "MEETING SUMMARY",
    "═══════════════",
    "",
    summary.rawSummary,
    "",
    "KEY FIGURES",
    summary.keyFigures.map(f => `• ${f.label}: ${f.value}`).join("\n"),
    "",
    "CLIENT GOALS",
    summary.goals.map(g => `• ${g}`).join("\n"),
    "",
    "ACTION ITEMS",
    summary.actionItems.map(a => `• ${a}`).join("\n"),
    "",
    "RECOMMENDED PLANNING AREAS",
    summary.recommendedAreas.map(r => `• ${r}`).join("\n"),
    "",
    "─────────────",
    "FULL TRANSCRIPT",
    transcript,
  ].join("\n");

  return (
    <div className="space-y-4">
      {summary.rawSummary && (
        <div className="bg-[#0c1e3a]/5 border border-[#0c1e3a]/10 rounded-xl p-4">
          <p className="text-sm text-gray-700 leading-relaxed">{summary.rawSummary}</p>
        </div>
      )}

      {/* ── Extracted Records — the new part ───────────────────────────────── */}
      {totalAvailable > 0 && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-100">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-700" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-cyan-700">
                AI extracted {totalAvailable} record{totalAvailable === 1 ? "" : "s"}
              </h3>
            </div>
            {!created && (
              <button
                onClick={createRecords}
                disabled={creating || totalSelected === 0}
                className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                {creating
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Creating…</>
                  : <><Plus className="w-3 h-3" /> Create {totalSelected} record{totalSelected === 1 ? "" : "s"}</>}
              </button>
            )}
            {created && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Check className="w-3.5 h-3.5" /> {created.count} created
              </span>
            )}
          </div>
          <div className="p-3 space-y-2">
            {(["assets", "liabilities", "goals", "education"] as const).map(kind => {
              const list = records[kind];
              if (!list.length) return null;
              return (
                <div key={kind}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-600 mb-1">{kind}</p>
                  <ul className="space-y-1">
                    {list.map((rec: any, i: number) => {
                      const isSel = selected[kind].includes(i);
                      return (
                        <li key={i} className="flex items-start gap-2 bg-white border border-cyan-100 rounded-lg px-3 py-2">
                          {!created && (
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggle(kind, i)}
                              className="mt-1 w-3.5 h-3.5 rounded accent-cyan-600 flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800">
                              {kind === "goals"     ? rec.title :
                               kind === "education" ? rec.childName :
                                                      `${rec.category} — ${rec.name}`}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {kind === "assets" || kind === "liabilities"
                                ? `$${Number(rec.value || 0).toLocaleString()} · ${rec.owner ?? "primary"}`
                                : kind === "goals"
                                ? [rec.targetAmount && `target $${Number(rec.targetAmount).toLocaleString()}`,
                                   rec.targetDate, rec.goalType].filter(Boolean).join(" · ")
                                : [rec.currentRespBalance && `balance $${Number(rec.currentRespBalance).toLocaleString()}`,
                                   rec.annualContribution && `$${Number(rec.annualContribution).toLocaleString()}/yr`,
                                   rec.targetAmount && `target $${Number(rec.targetAmount).toLocaleString()}`].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {created?.errors?.length ? (
              <div className="mt-2 bg-red-50 border border-red-100 rounded-lg p-2">
                <p className="text-[10px] font-bold uppercase text-red-700 mb-1">{created.errors.length} error{created.errors.length === 1 ? "" : "s"}</p>
                <ul className="text-[11px] text-red-600 space-y-0.5">
                  {created.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Display sections (existing) ───────────────────────────────────── */}
      {summary.keyFigures.length > 0 && (
        <Section icon={<LayoutGrid className="w-3.5 h-3.5" />} title="Key Figures" color="blue">
          <div className="grid grid-cols-2 gap-2 mt-2">
            {summary.keyFigures.map((f, i) => (
              <div key={i} className="bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-blue-400 uppercase tracking-wide font-semibold">{f.label}</p>
                <p className="text-sm font-bold text-blue-900">{f.value}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {summary.goals.length > 0 && (
        <Section icon={<Target className="w-3.5 h-3.5" />} title="Client Goals" color="emerald">
          <ul className="mt-2 space-y-1">
            {summary.goals.map((g, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>{g}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.actionItems.length > 0 && (
        <Section icon={<ListChecks className="w-3.5 h-3.5" />} title="Action Items" color="amber">
          <ul className="mt-2 space-y-1">
            {summary.actionItems.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">□</span>{a}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.recommendedAreas.length > 0 && (
        <Section icon={<FileText className="w-3.5 h-3.5" />} title="Recommended Planning Areas" color="purple">
          <div className="flex flex-wrap gap-1.5 mt-2">
            {summary.recommendedAreas.map((r, i) => (
              <span key={i} className="bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                {r}
              </span>
            ))}
          </div>
        </Section>
      )}

      <button
        onClick={() => setShowTranscript(!showTranscript)}
        className="text-xs text-gray-400 hover:text-gray-600 font-medium underline underline-offset-2"
      >
        {showTranscript ? "Hide" : "Show"} full transcript
      </button>

      {showTranscript && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 max-h-52 overflow-y-auto">
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{transcript}</p>
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t border-gray-100">
        <button
          onClick={() => onCopy(fullText)}
          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={onDownload}
          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Download
        </button>
        <button
          onClick={onReset}
          className="ml-auto flex items-center gap-1.5 text-sm text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg transition-colors"
        >
          <Mic className="w-3.5 h-3.5" /> New Recording
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny section wrapper
// ─────────────────────────────────────────────────────────────────────────────
const colorMap: Record<string, string> = {
  blue:    "text-blue-600 bg-blue-50 border-blue-100",
  emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
  amber:   "text-amber-600 bg-amber-50 border-amber-100",
  purple:  "text-purple-600 bg-purple-50 border-purple-100",
};

function Section({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-4", colorMap[color])}>
      <div className="flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-bold uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}
