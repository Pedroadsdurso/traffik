import type { CSSProperties } from "react";

/**
 * Parses a plain CSS declaration string (as used in the original Claude
 * Design handoff's `style="..."` attributes) into a React style object.
 * Keeps this port close to the original markup instead of hand-converting
 * every inline style to camelCase.
 */
export function sx(css: string | undefined | null): CSSProperties {
  if (!css) return {};
  const style: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const trimmed = decl.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;
    const prop = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();
    if (!prop || !value) continue;
    const key = prop.startsWith("--")
      ? prop
      : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[key] = value;
  }
  return style as CSSProperties;
}
