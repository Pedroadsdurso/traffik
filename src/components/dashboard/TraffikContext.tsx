"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { TraffikView } from "./useTraffikState";

const TraffikContext = createContext<TraffikView | null>(null);

/** Disponibiliza o estado do dashboard para todas as rotas filhas. */
export function TraffikProvider({ value, children }: { value: TraffikView; children: ReactNode }) {
  return <TraffikContext.Provider value={value}>{children}</TraffikContext.Provider>;
}

export function useTraffik(): TraffikView {
  const v = useContext(TraffikContext);
  if (!v) throw new Error("useTraffik precisa estar dentro de <TraffikProvider>.");
  return v;
}
