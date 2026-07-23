export function NavIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 256 256" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}
