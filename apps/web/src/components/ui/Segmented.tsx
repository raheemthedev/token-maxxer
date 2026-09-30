import Link from "next/link";

/** Link-based segmented control (server-friendly): the active option gets aria-current. */
export function Segmented({ options, active }: { options: { label: string; href: string; key: string }[]; active: string }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <Link key={o.key} href={o.href} scroll={false} aria-current={o.key === active ? "true" : undefined}>
          {o.label}
        </Link>
      ))}
    </div>
  );
}
