import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PlayerLoadData } from "@/lib/actions/load";
import type { SeasonView } from "@/hooks/useSeasonView";

function escapeCSV(val: unknown): string {
  const s = String(val ?? "");
  // Formula injection prevention
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function exportLoadCsv(players: PlayerLoadData[], view: SeasonView): void {
  if (players.length === 0) return;

  // Collect all months across all players
  const allMonthsSet = new Set<string>();
  for (const p of players) {
    const monthly = view === "current" ? p.currentSeasonMonthly : p.allTimeMonthly;
    for (const m of monthly) {
      allMonthsSet.add(m.month);
    }
  }
  const allMonths = Array.from(allMonthsSet).sort();

  // Build CSV header
  const headers = ["Nome", "Posição", "Escalão", "Carga Total", "Sessões", ...allMonths];
  const rows: string[][] = [headers];

  for (const p of players) {
    const load = view === "current" ? p.currentSeasonLoad : p.totalLoad;
    const sessions = view === "current" ? p.currentSeasonSessions : p.totalSessions;
    const monthly = view === "current" ? p.currentSeasonMonthly : p.allTimeMonthly;

    const monthMap = new Map<string, number>();
    for (const m of monthly) {
      monthMap.set(m.month, m.load);
    }

    // Note: Missing months are filled with 0 (intentional). If no data exists for a month, it represents zero load that month.
    const monthCols = allMonths.map((month) => String(monthMap.get(month) ?? 0));

    rows.push([
      escapeCSV(p.playerName),
      escapeCSV(p.position),
      escapeCSV(p.ageGroup),
      escapeCSV(load),
      escapeCSV(sessions),
      ...monthCols,
    ]);
  }

  const csvContent = rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sparta-carga-${today}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Estado (Carga baixa/normal/alta) — réplica exacta do critério visual de
 * PlayerLoadRow.tsx (>1.5x a média = alta; <0.5x = baixa; caso contrário = normal;
 * sem dados/sessões/média = sem badge). Não existe como campo em PlayerLoadData —
 * é calculado no ecrã a partir da média da época, por isso replicamos aqui para o
 * PDF mostrar o mesmo estado que o utilizador vê na tabela.
 */
function loadStatusLabel(load: number, sessions: number, seasonAvg: number): string {
  const hasData = load > 0 && sessions > 0 && seasonAvg > 0;
  if (!hasData) return "—";
  if (load < seasonAvg * 0.5) return "Carga baixa";
  if (load > seasonAvg * 1.5) return "Carga alta";
  return "Carga normal";
}

/**
 * Exporta a tabela "Carga Acumulada" para PDF, gerado inteiramente no browser
 * (jsPDF + jspdf-autotable) — mesmo espírito de exportLoadCsv (sem servidor, sem
 * Edge Function). Colunas replicam exactamente o que a tabela no ecrã mostra
 * (Nome/Posição/Escalão/Carga Total/Sessões/Estado); a coluna "Por mês" é um
 * mini-gráfico, não dados tabulares, por isso fica de fora do PDF.
 */
export function exportLoadPdf(
  players: PlayerLoadData[],
  view: SeasonView,
  seasonAvg: number,
  seasonLabel: string | null
): void {
  if (players.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
  const today = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });

  doc.setFontSize(14);
  doc.text("Carga Acumulada", 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(100);
  const subtitle = seasonLabel
    ? `Época ${seasonLabel} · ${view === "current" ? "Época actual" : "Cumulativo"} · Exportado em ${today}`
    : `${view === "current" ? "Época actual" : "Cumulativo"} · Exportado em ${today}`;
  doc.text(subtitle, 40, 56);

  const body = players.map((p) => {
    const load = view === "current" ? p.currentSeasonLoad : p.totalLoad;
    const sessions = view === "current" ? p.currentSeasonSessions : p.totalSessions;
    return [
      p.playerName,
      p.position,
      p.ageGroup,
      String(load),
      String(sessions),
      loadStatusLabel(load, sessions, seasonAvg),
    ];
  });

  autoTable(doc, {
    startY: 72,
    head: [["Nome", "Posição", "Escalão", "Carga Total", "Sessões", "Estado"]],
    body,
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(`sparta-carga-${new Date().toISOString().slice(0, 10)}.pdf`);
}
