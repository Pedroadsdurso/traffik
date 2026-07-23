"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AuthFormState = { error?: string };

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Informe e-mail e senha." };

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    // signIn sinaliza sucesso lançando o redirect do Next — só as falhas de
    // autenticação chegam aqui como AuthError.
    if (error instanceof AuthError) return { error: "E-mail ou senha inválidos." };
    throw error;
  }
  return {};
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Informe seu nome." };
  if (!email.includes("@")) return { error: "Informe um e-mail válido." };
  if (password.length < 8) return { error: "A senha precisa ter ao menos 8 caracteres." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Já existe uma conta com este e-mail." };

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      notificationSettings: { create: {} },
      dashboardPreference: { create: {} },
    },
  });

  // Toda conta nova nasce com um webhook pronto para receber vendas.
  await prisma.webhook.create({
    data: { userId: user.id, name: "Webhook principal", platform: "CUSTOM" },
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Conta criada, mas o login falhou. Tente entrar." };
    throw error;
  }
  return {};
}
