import { sx } from "@/lib/sx";

/**
 * Stand-in for the Claude Design preview's `<image-slot>` custom element.
 * Renders a placeholder block until real creative thumbnails come from the
 * Facebook Marketing API (see roadmap Fase 7/9).
 */
export function ImageSlot({ label }: { label: string }) {
  return (
    <div
      style={sx(
        "width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px;font-size:10px;line-height:1.2;background:var(--color-neutral-900);color:var(--color-neutral-500)"
      )}
    >
      {label}
    </div>
  );
}
