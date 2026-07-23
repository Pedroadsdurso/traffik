"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { sx } from "@/lib/sx";
import type { AuthFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AuthForm({
  action,
  mode,
}: {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  mode: "login" | "signup";
}) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {});

  return (
    <form action={formAction} style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      {mode === "signup" && (
        <div className="field">
          <label htmlFor="name">Nome</label>
          <input className="input" id="name" name="name" autoComplete="name" required />
        </div>
      )}

      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="password">Senha</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={mode === "signup" ? "Mínimo de 8 caracteres" : "••••••••"}
          required
        />
      </div>

      {state.error && (
        <p
          role="alert"
          style={sx(
            "margin:0;font-size:13px;color:#ff9a9a;background:color-mix(in srgb, #ff5a5a 12%, transparent);border:1px solid color-mix(in srgb, #ff5a5a 35%, transparent);border-radius:var(--radius-md);padding:8px 10px",
          )}
        >
          {state.error}
        </p>
      )}

      <SubmitButton
        label={mode === "signup" ? "Criar conta" : "Entrar"}
        pendingLabel={mode === "signup" ? "Criando…" : "Entrando…"}
      />
    </form>
  );
}
