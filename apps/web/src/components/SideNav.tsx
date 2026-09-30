"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export interface SideItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  exact?: boolean;
}

export function SideNav({ items }: { items: SideItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Dashboard">
      {items.map((i) => {
        const active = i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all ${
              active
                ? "bg-surface text-foreground shadow-[0_1px_3px_rgba(20,20,20,0.14)]"
                : "text-foreground-muted hover:bg-surface/60 hover:text-foreground"
            }`}
          >
            <span className={active ? "text-accent" : ""}>{i.icon}</span>
            {i.label}
            {i.badge && <span className="ml-auto rounded-lg bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{i.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
