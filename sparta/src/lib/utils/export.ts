import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PlayerLoadData } from "@/lib/actions/load";
import type { SeasonView } from "@/hooks/useSeasonView";
import type { PlayerTrendData, SparklinePoint, FatigueDimension } from "@/lib/actions/trends";
import {
  DIMENSION_ORDER,
  DIMENSION_LABELS,
  DIMENSION_COLORS,
} from "@/components/domain/FatigueSparkline";

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

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

/**
 * Delta (mesmo critério de DeltaIndicator em FatigueTrendRow.tsx): >0.1 = subida
 * (verde), <-0.1 = descida (vermelho), caso contrário = estável (cinza); null = sem
 * dados suficientes. Cores replicam text-green-600/text-red-600 do Tailwind.
 */
function formatDelta(delta: number | null): { text: string; color: [number, number, number] } {
  if (delta === null) return { text: "—", color: [120, 120, 120] };
  if (delta > 0.1) return { text: `+${delta.toFixed(1)}`, color: [22, 163, 74] };
  if (delta < -0.1) return { text: delta.toFixed(1), color: [220, 38, 38] };
  return { text: "~0", color: [120, 120, 120] };
}

/**
 * Desenha uma mini-tendência (sparkline) directamente com as primitivas vectoriais do
 * jsPDF, a partir dos MESMOS pontos (SparklinePoint[]) que alimentam o gráfico Recharts
 * no ecrã — não é uma captura de imagem do DOM (não existe html2canvas/svg-rasterização
 * neste projecto; desenhar a partir dos dados brutos é mais simples e robusto do que
 * rasterizar um <svg> do Recharts, que usa ResponsiveContainer com dimensões relativas).
 *
 * Escala fixa 1–5 (intervalo real de cada dimensão do questionário) em vez de auto-escala
 * por célula — garante que a mesma amplitude visual representa sempre a mesma variação
 * real, tornando as células comparáveis entre jogadores e dimensões no documento impresso.
 */
function drawSparklineInCell(
  doc: jsPDF,
  cell: { x: number; y: number; width: number; height: number },
  points: SparklinePoint[],
  colorHex: string
): void {
  const { x, y, width, height } = cell;

  if (points.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("—", x + width / 2, y + height / 2, { align: "center", baseline: "middle" });
    return;
  }

  const padX = 4;
  const padY = 5;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const MIN_VALUE = 1;
  const MAX_VALUE = 5;

  const toXY = (index: number, value: number): [number, number] => {
    const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
    const px = x + padX + stepX * index;
    const py = y + padY + innerH - ((value - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * innerH;
    return [px, py];
  };

  const [r, g, b] = hexToRgb(colorHex);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.7);

  if (points.length === 1) {
    // Um único ponto: desenhar um pequeno traço horizontal em vez de nada visível.
    const [px, py] = toXY(0, points[0]!.value);
    doc.line(px - 3, py, px + 3, py);
    return;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = toXY(i, points[i]!.value);
    const [x2, y2] = toXY(i + 1, points[i + 1]!.value);
    doc.line(x1, y1, x2, y2);
  }
}

/**
 * Exporta a tabela "Tendências de Fadiga" para PDF, com as 5 mini-tendências desenhadas
 * a cores (mesma cor por dimensão que no ecrã — ver DIMENSION_COLORS) em vez de reduzidas
 * a números. Gerado inteiramente no browser (jsPDF + jspdf-autotable), sem servidor.
 * Inclui legenda das 5 dimensões no topo, tal como no ecrã (FatigueTrendsLegend).
 */
export function exportFatigueTrendsPdf(players: PlayerTrendData[]): void {
  if (players.length === 0) return;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
  const today = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Tendências de Fadiga", 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Últimos 28 dias · Exportado em ${today}`, 40, 56);

  // Legenda das 5 dimensões — quadrado colorido + nome, mesma ordem/cor do ecrã.
  let legendX = 40;
  const legendY = 72;
  doc.setFontSize(8);
  for (const dim of DIMENSION_ORDER) {
    const [r, g, b] = hexToRgb(DIMENSION_COLORS[dim]);
    doc.setFillColor(r, g, b);
    doc.rect(legendX, legendY - 6, 7, 7, "F");
    doc.setTextColor(80);
    const label = DIMENSION_LABELS[dim];
    doc.text(label, legendX + 11, legendY);
    legendX += 11 + doc.getTextWidth(label) + 14;
  }

  const dimensionColumns = DIMENSION_ORDER.map((dim) => ({
    header: DIMENSION_LABELS[dim],
    dataKey: dim,
  }));

  autoTable(doc, {
    startY: 88,
    columns: [
      { header: "Jogador", dataKey: "playerName" },
      { header: "Posição", dataKey: "position" },
      { header: "Escalão", dataKey: "ageGroup" },
      ...dimensionColumns,
      { header: "Delta", dataKey: "delta" },
    ],
    body: players.map(() => ({
      playerName: "",
      position: "",
      ageGroup: "",
      dim_energy: "",
      dim_focus: "",
      dim_sleep: "",
      dim_soreness: "",
      dim_mood: "",
      delta: "",
    })),
    styles: { fontSize: 9, cellPadding: 6, minCellHeight: 32 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: {
      dim_energy: { cellWidth: 70 },
      dim_focus: { cellWidth: 70 },
      dim_sleep: { cellWidth: 70 },
      dim_soreness: { cellWidth: 70 },
      dim_mood: { cellWidth: 70 },
      delta: { cellWidth: 45 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const player = players[data.row.index];
      if (!player) return;

      if (data.column.dataKey === "playerName") data.cell.text = [player.playerName];
      else if (data.column.dataKey === "position") data.cell.text = [player.position];
      else if (data.column.dataKey === "ageGroup") data.cell.text = [player.ageGroup];
      else if (data.column.dataKey === "delta") {
        const { text, color } = formatDelta(player.delta);
        data.cell.text = [text];
        data.cell.styles.textColor = color;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const dim = DIMENSION_ORDER.find((d) => d === data.column.dataKey) as
        | FatigueDimension
        | undefined;
      if (!dim) return;
      const player = players[data.row.index];
      if (!player) return;
      const points = player.hasFatigueData ? player.sparklines[dim] : [];
      drawSparklineInCell(doc, data.cell, points, DIMENSION_COLORS[dim]);
    },
  });

  doc.save(`sparta-tendencias-fadiga-${new Date().toISOString().slice(0, 10)}.pdf`);
}
