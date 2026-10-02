import type { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SideNav, type SideItem } from "@/components/SideNav";

const icon = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  let isPublic: boolean | null = null;
  try {
    if (session?.user?.id) {
      const s = await prisma.publishSettings.findUnique({ where: { userId: session.user.id }, select: { isPublic: true } });
      isPublic = s?.isPublic ?? false;
    }
  } catch {
    /* the page itself shows the database notice */
  }

  const items: SideItem[] = [
    { href: "/dashboard", label: "Overview", exact: true, icon: icon("M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-3H4z") },
    { href: "/dashboard/collector", label: "Connect tools", icon: icon("M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0zM12 17v4") },
    ...(session?.user?.handle ? [{ href: "/dashboard/preview", label: "Profile preview", icon: icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0") }] : []),
    { href: "/", label: "Leaderboard", exact: true, icon: icon("M6 20V10M12 20V4M18 20v-7") },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[1.75rem] bg-surface-muted/70 p-3 lg:min-h-[420px] lg:p-4">
          <SideNav items={items} />
          {isPublic !== null && (
            <div className="mt-4 hidden rounded-2xl bg-surface p-3.5 text-xs shadow-[0_1px_2px_rgba(20,20,20,0.06)] lg:block">
              <div className="eyebrow">Visibility</div>
              <div className="mt-1.5 flex items-center gap-2 font-medium">
                <span className={`h-2 w-2 rounded-full ${isPublic ? "bg-positive" : "bg-foreground-muted/50"}`} />
                {isPublic ? "Public on the board" : "Private"}
              </div>
            </div>
          )}
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
