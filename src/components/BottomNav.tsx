"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BillIcon, CashIcon, ChartIcon, RouteIcon, UsersIcon } from "./icons";

const items = [
  { href: "/", label: "Route", Icon: RouteIcon },
  { href: "/customers", label: "Customers", Icon: UsersIcon },
  { href: "/payments", label: "Payments", Icon: CashIcon },
  { href: "/bills", label: "Bills", Icon: BillIcon },
  { href: "/dashboard", label: "Dashboard", Icon: ChartIcon },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-brand" : "text-slate-600"}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-6" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
