/**
 * Corrige sessões cuja hora "saltou" 1h por causa da mudança de hora (fim do
 * horário de verão, último domingo de outubro).
 *
 * Contexto: até esta correção, a repetição semanal de sessões avançava 7×24h
 * fixos em milissegundos, mantendo o instante UTC em vez da hora de parede. As
 * ocorrências geradas para depois da mudança de hora aparecem 1h mais cedo
 * (ex.: um treino às 19:45 passa a mostrar 18:45 a partir de 27/10).
 *
 * O que faz: agrupa as sessões geradas em conjunto (mesmo created_at + clube +
 * tipo + duração + autor), toma a hora de parede da 1ª ocorrência da série como
 * a intenção correta e, para cada ocorrência seguinte, recalcula o instante UTC
 * cuja leitura em Europe/Lisbon é essa mesma hora. Só ajusta quando a diferença
 * é exatamente ±1h (assinatura de mudança de hora) e o status é "scheduled".
 *
 * Uso (a partir de sparta/):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/fix-dst-session-times.mjs
 *   ... node scripts/fix-dst-session-times.mjs --apply          # grava
 *   ... node scripts/fix-dst-session-times.mjs --from=2026-10-26 # só ajusta datas >=
 *   ... node scripts/fix-dst-session-times.mjs --club=<uuid>     # limita a um clube
 *
 * Sem --apply é um dry-run: lista o que mudaria, sem escrever.
 */
import { createClient } from "@supabase/supabase-js";
import process from "node:process";

const TZ_DEFAULT = "Europe/Lisbon";
const HOUR_MS = 60 * 60 * 1000;

// ─── args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TZ = (args.find((a) => a.startsWith("--tz=")) ?? "").split("=")[1] || TZ_DEFAULT;
const CLUB = (args.find((a) => a.startsWith("--club=")) ?? "").split("=")[1] || null;
const FROM = (args.find((a) => a.startsWith("--from=")) ?? "").split("=")[1] || null;
const fromMs = FROM ? new Date(`${FROM}T00:00:00.000Z`).getTime() : null;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Faltam variáveis. Define SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (chave service_role, não a anon)."
  );
  process.exit(1);
}

// ─── helpers de timezone (espelham src/lib/session-time.ts) ──────────────────
function timeZoneOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUTC - date.getTime();
}

function zonedParts(date, timeZone) {
  const local = new Date(date.getTime() + timeZoneOffsetMs(date, timeZone));
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

function zonedWallClockToUtc(year, month, day, hour, minute, timeZone) {
  const naiveUTC = Date.UTC(year, month - 1, day, hour, minute);
  const offset = timeZoneOffsetMs(new Date(naiveUTC), timeZone);
  let result = new Date(naiveUTC - offset);
  const refined = timeZoneOffsetMs(result, timeZone);
  if (refined !== offset) result = new Date(naiveUTC - refined);
  return result;
}

function lisbonStamp(iso) {
  return new Date(iso).toLocaleString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
}

// ─── main ───────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  let query = supabase
    .from("sessions")
    .select("id, club_id, type, duration_min, created_by, created_at, scheduled_at, status")
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: true });
  if (CLUB) query = query.eq("club_id", CLUB);

  const { data: sessions, error } = await query;
  if (error) {
    console.error("Erro ao ler sessões:", error.message);
    process.exit(1);
  }

  // Agrupa por série de repetição: inseridas juntas → created_at idêntico.
  const groups = new Map();
  for (const s of sessions ?? []) {
    const key = [s.club_id, s.type, s.duration_min, s.created_by, s.created_at].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const fixes = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue; // não é série de repetição
    group.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

    // Hora de parede pretendida = a da 1ª ocorrência (anterior à mudança de hora).
    const canon = zonedParts(new Date(group[0].scheduled_at), TZ);

    for (const s of group) {
      const cur = new Date(s.scheduled_at);
      const local = zonedParts(cur, TZ);
      const expected = zonedWallClockToUtc(
        local.year,
        local.month,
        local.day,
        canon.hour,
        canon.minute,
        TZ
      );
      const delta = expected.getTime() - cur.getTime();
      if (delta === 0) continue;
      if (Math.abs(delta) !== HOUR_MS) continue; // só ajustes de mudança de hora
      if (fromMs !== null && cur.getTime() < fromMs) continue;

      fixes.push({
        id: s.id,
        club_id: s.club_id,
        type: s.type,
        from: s.scheduled_at,
        to: expected.toISOString(),
      });
    }
  }

  if (fixes.length === 0) {
    console.log("Nada a corrigir — nenhuma sessão com salto de hora detetado.");
    return;
  }

  console.log(`${fixes.length} sessão(ões) a corrigir:\n`);
  for (const f of fixes) {
    console.log(
      `  ${f.id}  [${f.type}]  ${lisbonStamp(f.from)}  →  ${lisbonStamp(f.to)}`
    );
  }
  console.log();

  if (!APPLY) {
    console.log("Dry-run. Repete com --apply para gravar.");
    return;
  }

  let done = 0;
  for (const f of fixes) {
    const { error: updErr } = await supabase
      .from("sessions")
      .update({ scheduled_at: f.to })
      .eq("id", f.id)
      .eq("status", "scheduled");
    if (updErr) {
      console.error(`  falha ${f.id}: ${updErr.message}`);
    } else {
      done++;
    }
  }
  console.log(`\n${done}/${fixes.length} sessões atualizadas.`);
}

run().catch((e) => {
  console.error("Erro inesperado:", e);
  process.exit(1);
});
