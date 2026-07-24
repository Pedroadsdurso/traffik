"use server";

import { randomBytes } from "node:crypto";

import { auth } from "@/auth";
import { decryptSecret, encryptSecret, secretLookupHash } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/prisma";

export interface ApiCredentialDTO {
  id: string;
  name: string;
  /** Chave mascarada para listagem (ex.: `trk_live_••••3f9a`). */
  keyMasked: string;
  revoked: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

/** DTO retornado na criação — inclui a chave completa (exibida uma única vez). */
export interface ApiCredentialCreatedDTO extends ApiCredentialDTO {
  key: string;
}

/** Recebe a chave JÁ decriptada. */
function maskKey(key: string): string {
  const last4 = key.slice(-4);
  return `trk_live_••••${last4}`;
}

function toDTO(c: {
  id: string;
  name: string;
  key: string;
  revoked: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}): ApiCredentialDTO {
  return {
    id: c.id,
    name: c.name,
    keyMasked: maskKey(decryptSecret(c.key)),
    revoked: c.revoked,
    createdAt: c.createdAt.toISOString(),
    lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
  };
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

export async function listApiCredentials(): Promise<ApiCredentialDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.apiCredential.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function createApiCredential(name: string): Promise<ApiCredentialCreatedDTO> {
  const userId = await requireUserId();
  const key = `trk_live_${randomBytes(24).toString("hex")}`;
  const created = await prisma.apiCredential.create({
    // A chave em texto puro só existe aqui e na resposta desta chamada (exibida
    // uma única vez). No banco vai o ciphertext + o hash usado na autenticação.
    data: {
      userId,
      name: name.trim() || "Credencial de API",
      key: encryptSecret(key),
      keyHash: secretLookupHash(key),
    },
  });
  return { ...toDTO(created), key };
}

/** Revela a chave completa de uma credencial (para o botão "revelar"). */
export async function revealApiCredential(id: string): Promise<{ key: string }> {
  const userId = await requireUserId();
  const cred = await prisma.apiCredential.findFirst({ where: { id, userId }, select: { key: true } });
  if (!cred) throw new Error("Credencial não encontrada.");
  return { key: decryptSecret(cred.key) };
}

export async function revokeApiCredential(id: string): Promise<ApiCredentialDTO> {
  const userId = await requireUserId();
  const current = await prisma.apiCredential.findFirst({ where: { id, userId } });
  if (!current) throw new Error("Credencial não encontrada.");
  const updated = await prisma.apiCredential.update({
    where: { id },
    data: { revoked: true },
  });
  return toDTO(updated);
}

export async function deleteApiCredential(id: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  const current = await prisma.apiCredential.findFirst({ where: { id, userId }, select: { id: true } });
  if (!current) throw new Error("Credencial não encontrada.");
  await prisma.apiCredential.delete({ where: { id } });
  return { id };
}
