"use client";

import { FormEvent, useState } from "react";
import "./auth.css";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, displayName, password }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível entrar.");
      window.location.href = "/";
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Não foi possível entrar.");
      setSaving(false);
    }
  };

  return <main className="auth-page"><div className="auth-mark">✦</div><p className="auth-eyebrow">VERBO · SUA JORNADA</p><h1>{mode === "login" ? "Volte para a Palavra" : "Comece sua jornada"}</h1><p className="auth-lead">Seu progresso, sua constância e suas conquistas em um só lugar.</p><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} type="button" onClick={() => { setMode("login"); setError(""); }}>Entrar</button><button className={mode === "register" ? "active" : ""} type="button" onClick={() => { setMode("register"); setError(""); }}>Criar conta</button></div><form className="auth-form" onSubmit={submit}>{mode === "register" && <label>Nome<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={24} required /></label>}<label>E-mail<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label><label>Senha<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={saving}>{saving ? "Aguarde..." : mode === "login" ? "Entrar na jornada" : "Criar minha conta"}</button></form><small className="auth-note">Sua senha é protegida e nunca fica visível no navegador.</small></main>;
}
