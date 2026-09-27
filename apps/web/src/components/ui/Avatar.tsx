export function Avatar({ src, alt, size = 32 }: { src: string | null; alt: string; size?: number }) {
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} style={style} className="rounded-full object-cover" />;
  }
  return (
    <span
      style={style}
      className="flex items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
    >
      {alt.slice(0, 1).toUpperCase()}
    </span>
  );
}
