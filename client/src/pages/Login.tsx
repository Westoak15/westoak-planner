import { useState } from "react";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login"|"register">("login");
  const [form, setForm] = useState({ email:"", password:"", firstName:"", lastName:"", firmName:"" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const u = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    setError(""); setBusy(true);
    try {
      mode === "login" ? await login(form.email, form.password) : await register(form);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c1e3a]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-yellow-400 font-black text-2xl tracking-tight">Knights of Columbus</div>
          <div className="text-white/60 text-sm mt-1">Financial Planning Suite</div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {(["login","register"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? "bg-white shadow text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="First name" value={form.firstName} onChange={e => u("firstName", e.target.value)}
                    className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500" />
                  <input placeholder="Last name" value={form.lastName} onChange={e => u("lastName", e.target.value)}
                    className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500" />
                </div>
                <input placeholder="Firm name (optional)" value={form.firmName} onChange={e => u("firmName", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500" />
              </>
            )}
            <input type="email" placeholder="Email" value={form.email} onChange={e => u("email", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500" />
            <input type="password" placeholder="Password" value={form.password} onChange={e => u("password", e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500" />
            {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={submit} disabled={busy}
              className="w-full bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
              {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
