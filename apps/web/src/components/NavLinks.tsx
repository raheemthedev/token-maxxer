"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <>
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
              active ? "bg-surface-muted text-foreground" : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
