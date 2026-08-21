"use client";

import { FormEvent, useEffect, useState } from "react";
import "./auth.css";

type Mode = "login" | "register";

function messageForFailure(response: Response, data: { error?: string }) {
  if (response.status === 401) return "E-mail ou senha incorretos.";
  if (response.status === 409) return "Este e-mail já está cadastrado. Entre com sua senha.";
  if (response.status >= 500) return "Não foi possível conectar ao servidor. Tente novamente.";
  return data.error || "Não foi possível concluir sua solicitação.";
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("error");
    if (!message) return;
    const timer = window.setTimeout(() => setError(message), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selectMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, displayName, password }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(messageForFailure(response, data));
      window.location.assign("/");
    } catch (submissionError) {
      setError(submissionError instanceof TypeError ? "Não foi possível conectar ao servidor. Tente novamente." : submissionError instanceof Error ? submissionError.message : "Não foi possível concluir sua solicitação.");
      setSaving(false);
    }
  };

  const continueWithGoogle = () => {
    setGoogleLoading(true);
    window.location.assign("/api/auth/google");
  };

  return <main className="auth-page">
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-mark" aria-hidden="true">✦</div>
      <p className="auth-eyebrow">VERBO · SUA JORNADA</p>
      <h1 id="auth-title">{mode === "login" ? "Que bom ter você de volta." : "Comece sua jornada."}</h1>
      <p className="auth-lead">{mode === "login" ? "Entre para continuar lendo, crescendo e registrando seu caminho na Palavra." : "Crie sua conta para guardar seu progresso e avançar em cada leitura."}</p>

      <div className="auth-tabs" role="tablist" aria-label="Acesso à conta">
        <button className={mode === "login" ? "active" : ""} type="button" role="tab" aria-selected={mode === "login"} onClick={() => selectMode("login")}>Entrar</button>
        <button className={mode === "register" ? "active" : ""} type="button" role="tab" aria-selected={mode === "register"} onClick={() => selectMode("register")}>Criar conta</button>
      </div>

      <button className="google-submit" type="button" onClick={continueWithGoogle} disabled={googleLoading || saving}>
        <span className="google-mark" aria-hidden="true">G</span>
        {googleLoading ? "Abrindo Google…" : "Continuar com Google"}
      </button>

      <div className="auth-divider"><span>ou use seu e-mail</span></div>

      <form className="auth-form" onSubmit={submit} noValidate>
        {mode === "register" && <label>Nome
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={24} autoComplete="name" placeholder="Como podemos chamar você?" required />
        </label>}
        <label>E-mail
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" inputMode="email" placeholder="voce@exemplo.com" required />
        </label>
        <label>Senha
          <span className="password-field">
            <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} placeholder="Mínimo de 8 caracteres" required />
            <button type="button" className="password-toggle" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Ocultar" : "Mostrar"}</button>
          </span>
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={saving || googleLoading}>{saving ? "Entrando…" : mode === "login" ? "Entrar" : "Criar minha conta"}<span aria-hidden="true">→</span></button>
      </form>

      <p className="auth-note">Seus dados de acesso são protegidos e a senha nunca fica visível no aplicativo.</p>
    </section>
  </main>;
}
