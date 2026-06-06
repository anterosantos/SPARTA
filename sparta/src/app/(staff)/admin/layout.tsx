/**
 * Admin Module Layout (Story 8.7)
 *
 * Wraps all admin pages with:
 * - Navigation tabs (Dashboard, Rosters, Teams, Players, Coaches, Loans)
 * - Responsive design
 * - Staff-only gate (enforced by middleware)
 */

import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen">
      {/* Header with breadcrumb */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Administração</h1>
          <p className="text-sm text-gray-500">Gestão de rosters, equipas, jogadores e empréstimos</p>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav className="border-b bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-8 overflow-x-auto">
            <a
              href="/admin"
              className="px-0 py-4 border-b-2 border-blue-600 text-blue-600 whitespace-nowrap"
            >
              Dashboard
            </a>
            <a
              href="/admin/rosters"
              className="px-0 py-4 border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap"
            >
              Rosters
            </a>
            <a
              href="/admin/teams"
              className="px-0 py-4 border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap"
            >
              Equipas
            </a>
            <a
              href="/admin/players"
              className="px-0 py-4 border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap"
            >
              Jogadores
            </a>
            <a
              href="/admin/coaches"
              className="px-0 py-4 border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap"
            >
              Treinadores
            </a>
            <a
              href="/admin/loans"
              className="px-0 py-4 border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap"
            >
              Empréstimos
            </a>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto p-4">{children}</div>
      </main>
    </div>
  );
}
