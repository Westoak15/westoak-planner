//import { Turnstile } from '@marsidev/react-turnstile'
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { api } from "../lib/api";

const INPUT = "fp-input";

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "What was the make of your first car?",
  "What is your oldest sibling's middle name?",
  "What street did you grow up on?",
  "What was your childhood nickname?",
];

function PasswordStrength({ password }: { password: string }) {
  const rules = [
    { label: "At least 8 characters",          ok: password.length >= 8 },
    { label: "At least one uppercase letter",  ok: /[A-Z]/.test(password) },
    { label: "At least one lowercase letter",  ok: /[a-z]/.test(password) },
    { label: "At least one number",            ok: /\d/.test(password) },
    { label: "At least one special character", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = rules.filter(r => r.ok).length;
  const strength = score <= 1 ? "Weak" : score <= 3 ? "Fair" : score === 4 ? "Good" : "Strong";
  const barColor = score <= 1 ? "bg-red-400" : score <= 3 ? "bg-amber-400" : score === 4 ? "bg-blue-500" : "bg-emerald-500";
  if (!password) return null;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${(score / 5) * 100}%` }} />
        </div>
        <span className={`text-xs font-semibold ${score <= 1 ? "text-red-500" : score <= 3 ? "text-amber-500" : score === 4 ? "text-blue-600" : "text-emerald-600"}`}>{strength}</span>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {rules.map(r => (
          <div key={r.label} className="flex items-center gap-1.5">
            {r.ok ? <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" /> : <X className="w-3 h-3 text-slate-300 flex-shrink-0" />}
            <span className={`text-xs ${r.ok ? "text-emerald-600" : "text-slate-400"}`}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Mode = "login" | "register" | "forgot-email" | "forgot-question" | "forgot-reset" | "forgot-done";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode]   = useState<Mode>("login");
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy]   = useState(false);
   const [form, setForm] = useState({
    email: "", password: "", firstName: "", lastName: "", firmName: "",
    securityQuestion: SECURITY_QUESTIONS[0], securityAnswer: "",
  });

  const [forgotEmail, setForgotEmail]       = useState("");
  const [forgotQuestion, setForgotQuestion] = useState("");
  const [forgotAnswer, setForgotAnswer]     = useState("");
  const [newPassword, setNewPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const u = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const reset = () => { setError(""); };

  const pwRules = [
    { ok: form.password.length >= 8 },
    { ok: /[A-Z]/.test(form.password) },
    { ok: /[a-z]/.test(form.password) },
    { ok: /\d/.test(form.password) },
    { ok: /[^A-Za-z0-9]/.test(form.password) },
  ];
  const pwOk = pwRules.every(r => r.ok);

  const newPwRules = [
    { ok: newPassword.length >= 8 },
    { ok: /[A-Z]/.test(newPassword) },
    { ok: /[a-z]/.test(newPassword) },
    { ok: /\d/.test(newPassword) },
    { ok: /[^A-Za-z0-9]/.test(newPassword) },
  ];
  const newPwOk = newPwRules.every(r => r.ok);
  const pwMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  async function submitLogin() {
    reset(); setBusy(true);
    try { await login(form.email, form.password); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function submitRegister() {
    reset(); setBusy(true);
    try {
      await register({
       email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        firmName: form.firmName || undefined,
        securityQuestion: form.securityQuestion,
        securityAnswer: form.securityAnswer
     });
  }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function submitForgotEmail() {
    reset(); setBusy(true);
    try {
      const res = await api.post<{ question: string | null }>("/api/auth/forgot/question", { email: forgotEmail });
      if (!res.question) {
        setError("No security question found for this email. Please contact your administrator.");
      } else {
        setForgotQuestion(res.question);
        setMode("forgot-question");
      }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function submitForgotAnswer() {
    reset(); setBusy(true);
    try {
      if (!forgotAnswer.trim()) { setError("Please enter your security answer."); setBusy(false); return; }
      setMode("forgot-reset");
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function submitForgotReset() {
    reset(); setBusy(true);
    try {
      await api.post("/api/auth/forgot/reset", {
        email: forgotEmail,
        securityAnswer: forgotAnswer,
        newPassword,
      });
      setMode("forgot-done");
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  const submitBtn =
    "w-full bg-brand-gradient hover:bg-brand-gradient-hover disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm shadow-sm transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-100">
      {/* Soft ambient gradient backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 20% 20%, rgba(37, 99, 235, 0.10) 0%, rgba(37, 99, 235, 0) 70%), radial-gradient(50% 40% at 80% 80%, rgba(6, 182, 212, 0.10) 0%, rgba(6, 182, 212, 0) 70%)",
        }}
      />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/koc-logo.png" alt="Knights of Columbus" className="w-20 h-20 object-contain mx-auto mb-3" />
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-brand-gradient">Financial Planning Suite</div>
        </div>

        <div className="fp-card fp-card-accent shadow-xl shadow-slate-300/30 p-8">
          <form autoComplete="off" onSubmit={e => e.preventDefault()}>

          {(mode === "login" || mode === "register") && (
            <>
              <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                {(["login","register"] as const).map(m => (
                  <button key={m} onClick={() => { setMode(m); reset(); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? "bg-white shadow text-slate-900" : "text-slate-400 hover:text-slate-600"}`}>
                    {m === "login" ? "Sign In" : "Register"}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {mode === "register" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="First name" autoComplete="off" value={form.firstName} onChange={e => u("firstName", e.target.value)} className={INPUT} />
                      <input placeholder="Last name" autoComplete="off" value={form.lastName}  onChange={e => u("lastName",  e.target.value)} className={INPUT} />
                    </div>
                    <input placeholder="Firm / Council name (optional)" value={form.firmName} onChange={e => u("firmName", e.target.value)} className={INPUT} />
                  </>
                )}

                <input type="email" placeholder="Email address" autoComplete="off" value={form.email} onChange={e => u("email", e.target.value)} className={INPUT} />

                <div className="relative">
                  <input type={showPw ? "text" : "password"} placeholder="Password" autoComplete="new-password" value={form.password}
                    onChange={e => u("password", e.target.value)}
                    onKeyDown={e => e.key === "Enter" && mode === "login" && submitLogin()}
                    className={INPUT + " pr-11"} />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {mode === "register" && <PasswordStrength password={form.password} />}

                {mode === "register" && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Security Question (used for password recovery)</p>
                    <select value={form.securityQuestion} onChange={e => u("securityQuestion", e.target.value)}
                      className={INPUT + " mb-2"}>
                      {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                    <input placeholder="Your answer" value={form.securityAnswer} onChange={e => u("securityAnswer", e.target.value)} className={INPUT} />
                    <p className="text-xs text-slate-400 mt-1">Answer is case-insensitive and stored securely.</p>
                  </div>
                )}

                {mode === "login" && (
                  <div className="text-right -mt-1">
                    <button onClick={() => { setMode("forgot-email"); reset(); }}
                      className="text-xs text-cyan-600 hover:text-cyan-800 font-semibold">
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

                <button
                  onClick={mode === "login" ? submitLogin : submitRegister}
                  disabled={busy || (mode === "register" && (!pwOk || !form.securityAnswer))}
                  className={submitBtn}>
                  {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
                </button>
              </div>
            </>
          )}

          {mode === "forgot-email" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Reset Password</h2>
                <p className="text-sm text-slate-500 mt-1">Enter your email to retrieve your security question.</p>
              </div>
              <input type="email" placeholder="Email address" autoComplete="off" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className={INPUT} />
              {error && <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
              <button onClick={submitForgotEmail} disabled={busy || !forgotEmail} className={submitBtn}>
                {busy ? "Please wait…" : "Continue"}
              </button>
              <button onClick={() => { setMode("login"); reset(); }} className="w-full text-sm text-slate-400 hover:text-slate-600 text-center">← Back to Sign In</button>
            </div>
          )}

          {mode === "forgot-question" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Security Question</h2>
                <p className="text-sm text-slate-500 mt-1">Answer your security question to continue.</p>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-cyan-200/70 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{forgotQuestion}</p>
              </div>
              <input placeholder="Your answer" value={forgotAnswer} onChange={e => setForgotAnswer(e.target.value)} className={INPUT} />
              <p className="text-xs text-slate-400 -mt-2">Answers are not case-sensitive.</p>
              {error && <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
              <button onClick={submitForgotAnswer} disabled={busy || !forgotAnswer} className={submitBtn}>
                {busy ? "Verifying…" : "Continue"}
              </button>
              <button onClick={() => { setMode("forgot-email"); reset(); }} className="w-full text-sm text-slate-400 hover:text-slate-600 text-center">← Back</button>
            </div>
          )}

          {mode === "forgot-reset" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Set New Password</h2>
                <p className="text-sm text-slate-500 mt-1">Choose a strong new password.</p>
              </div>
              <div className="relative">
                <input type={showNewPw ? "text" : "password"} placeholder="New password" autoComplete="new-password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} className={INPUT + " pr-11"} />
                <button type="button" onClick={() => setShowNewPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={newPassword} />
              <div>
                <input type="password" placeholder="Confirm new password" autoComplete="new-password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className={`${INPUT} ${confirmPassword && !pwMatch ? "border-red-300" : ""}`} />
                {confirmPassword && !pwMatch && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
                {confirmPassword && pwMatch  && <p className="text-xs text-emerald-600 mt-1">✓ Passwords match</p>}
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
              <button onClick={submitForgotReset} disabled={busy || !newPwOk || !pwMatch} className={submitBtn}>
                {busy ? "Saving…" : "Reset Password"}
              </button>
              <button onClick={() => { setMode("forgot-question"); reset(); }} className="w-full text-sm text-slate-400 hover:text-slate-600 text-center">← Back</button>
            </div>
          )}

          {mode === "forgot-done" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-cyan-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Password Reset!</h2>
              <p className="text-sm text-slate-500">Your password has been changed successfully. You can now sign in.</p>
              <button onClick={() => { setMode("login"); reset(); setForgotEmail(""); setForgotAnswer(""); setNewPassword(""); setConfirmPassword(""); }}
                className={submitBtn}>
                Sign In
              </button>
            </div>
          )}

          </form>
        </div>

        <div className="text-center mt-6 text-[11px] text-slate-400">
          © Knights of Columbus · Financial Planning Suite
        </div>
      </div>
    </div>
  );
}
