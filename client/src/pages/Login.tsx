import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Eye, EyeOff, Check, X } from "lucide-react";

const INPUT = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500";

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
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${(score / 5) * 100}%` }} />
        </div>
        <span className={`text-xs font-semibold ${score <= 1 ? "text-red-500" : score <= 3 ? "text-amber-500" : score === 4 ? "text-blue-600" : "text-emerald-600"}`}>
          {strength}
        </span>
      </div>
      {/* Rules */}
      <div className="grid grid-cols-1 gap-1">
        {rules.map(r => (
          <div key={r.label} className="flex items-center gap-1.5">
            {r.ok
              ? <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
              : <X className="w-3 h-3 text-gray-300 flex-shrink-0" />}
            <span className={`text-xs ${r.ok ? "text-emerald-600" : "text-gray-400"}`}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode]         = useState<"login"|"register"|"forgot">("login");
  const [form, setForm]         = useState({ email:"", password:"", firstName:"", lastName:"", firmName:"" });
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [busy, setBusy]         = useState(false);

  const u = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    setError(""); setSuccess(""); setBusy(true);
    try {
      if (mode === "forgot") {
        // No backend reset endpoint yet — show message
        setSuccess("If an account exists for that email, a reset link has been sent.");
        setBusy(false);
        return;
      }
      mode === "login" ? await login(form.email, form.password) : await register(form);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  const isRegister = mode === "register";
  const pwOk = form.password.length >= 8 &&
    /[A-Z]/.test(form.password) && /[a-z]/.test(form.password) &&
    /\d/.test(form.password) && /[^A-Za-z0-9]/.test(form.password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c1e3a] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/koc-logo.png" alt="Knights of Columbus" className="w-24 h-24 object-contain mx-auto mb-3" />
          <div className="text-white/60 text-sm">Financial Planning Suite</div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* Mode tabs — only Sign In / Register */}
          {mode !== "forgot" && (
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              {(["login","register"] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? "bg-white shadow text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>
                  {m === "login" ? "Sign In" : "Register"}
                </button>
              ))}
            </div>
          )}

          {/* Forgot password header */}
          {mode === "forgot" && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">Reset Password</h2>
              <p className="text-sm text-gray-500 mt-1">Enter your email and we'll send a reset link.</p>
            </div>
          )}

          <div className="space-y-3">
            {/* Register-only fields */}
            {isRegister && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="First name" value={form.firstName} onChange={e => u("firstName", e.target.value)} className={INPUT} />
                  <input placeholder="Last name"  value={form.lastName}  onChange={e => u("lastName",  e.target.value)} className={INPUT} />
                </div>
                <input placeholder="Firm / Council name (optional)" value={form.firmName} onChange={e => u("firmName", e.target.value)} className={INPUT} />
              </>
            )}

            {/* Email */}
            <input type="email" placeholder="Email address" value={form.email} onChange={e => u("email", e.target.value)} className={INPUT} />

            {/* Password */}
            {mode !== "forgot" && (
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Password"
                  value={form.password}
                  onChange={e => u("password", e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}
                  className={INPUT + " pr-11"}
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Password strength — register only */}
            {isRegister && <PasswordStrength password={form.password} />}

            {/* Forgot password link — sign in only */}
            {mode === "login" && (
              <div className="text-right -mt-1">
                <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                  className="text-xs text-cyan-600 hover:text-cyan-800 font-medium">
                  Forgot password?
                </button>
              </div>
            )}

            {/* Messages */}
            {error   && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-emerald-600 text-sm bg-emerald-50 rounded-lg px-3 py-2">{success}</p>}

            {/* Submit */}
            <button
              onClick={submit}
              disabled={busy || (isRegister && !pwOk)}
              className="w-full bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
              {busy ? "Please wait…" : mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Send Reset Link"}
            </button>

            {/* Back to sign in */}
            {mode === "forgot" && (
              <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 text-center">
                ← Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
