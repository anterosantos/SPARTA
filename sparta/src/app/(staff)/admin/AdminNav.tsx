"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/rosters", label: "Rosters" },
  { href: "/admin/teams", label: "Equipas" },
  { href: "/admin/players", label: "Jogadores" },
  { href: "/admin/coaches", label: "Treinadores" },
  { href: "/admin/loans", label: "Empréstimos" },
  { href: "/admin/audit-trail", label: "Auditoria" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-8 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-0 py-4 border-b-2 whitespace-nowrap text-sm font-medium ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
