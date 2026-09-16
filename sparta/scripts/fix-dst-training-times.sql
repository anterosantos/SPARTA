-- ─────────────────────────────────────────────────────────────────────────────
-- Corrige treinos cuja hora "saltou" 1h por causa da mudança de hora
-- (fim do horário de verão: domingo 25/10/2026 em Portugal).
--
-- Causa: até à correção em src/lib/actions/sessions.ts, a repetição semanal
-- avançava 7×24h fixos em milissegundos — mantinha o instante UTC, não a hora
-- de parede. As ocorrências geradas para depois da mudança de hora ficam 1h
-- mais cedo (ex.: treino às 19:45 aparece às 18:45 a partir de 27/10).
-- Ver AGENTS.md regra 20 e scripts/fix-dst-session-times.mjs.
--
-- Estratégia (v2): NÃO infere a hora "certa" a partir de séries — a versão
-- anterior falhava quando todas as ocorrências scheduled de uma série já eram
-- posteriores à mudança (ex.: treinos de terça/quarta). Aqui a regra é directa
-- e idempotente: todo o treino agendado a partir do cutoff cuja hora de parede
-- em Europe/Lisbon é WRONG_TIME passa a RIGHT_TIME (mesmo dia local, +1h).
--
-- PRESSUPOSTO: os treinos deste clube são sempre às 19:45. Se houver treinos
-- legitimamente às 18:45, filtra melhor (por equipa, intervalo de datas, etc.)
-- antes de aplicar.
--
-- Constantes (edita se necessário):
--   cutoff     = 2026-10-24 00:00  (hora local de Lisboa)
--   WRONG_TIME = 18:45
--   RIGHT_TIME = 19:45   (= WRONG_TIME + 1h)
--
-- Como correr:
--   1. PASSO 1 (SELECT) — confirma a lista.
--   2. PASSO 2 (transação) — revê o RETURNING; depois `COMMIT;` ou `ROLLBACK;`.
--   psql:  psql "$DATABASE_URL" -f scripts/fix-dst-training-times.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ PASSO 1 — PRÉ-VISUALIZAÇÃO (só leitura) ═════════════════════════════════
SELECT
  id,
  scheduled_at                                              AS antes_utc,
  (scheduled_at AT TIME ZONE 'Europe/Lisbon')               AS antes_lisboa,
  scheduled_at + interval '1 hour'                          AS depois_utc,
  ((scheduled_at + interval '1 hour') AT TIME ZONE 'Europe/Lisbon') AS depois_lisboa
FROM sessions
WHERE type = 'training'                        -- remove p/ abranger todos os tipos
  AND status = 'scheduled'
  AND scheduled_at >= (timestamp '2026-10-24 00:00:00' AT TIME ZONE 'Europe/Lisbon')
  AND (scheduled_at AT TIME ZONE 'Europe/Lisbon')::time = time '18:45'
ORDER BY scheduled_at;


-- ═══ PASSO 2 — APLICAÇÃO (em transação; termina em COMMIT ou ROLLBACK) ═══════
BEGIN;

UPDATE sessions
SET scheduled_at = scheduled_at + interval '1 hour'
WHERE type = 'training'
  AND status = 'scheduled'
  AND scheduled_at >= (timestamp '2026-10-24 00:00:00' AT TIME ZONE 'Europe/Lisbon')
  AND (scheduled_at AT TIME ZONE 'Europe/Lisbon')::time = time '18:45'
RETURNING
  id,
  (scheduled_at - interval '1 hour')            AS antes_utc,
  ((scheduled_at - interval '1 hour') AT TIME ZONE 'Europe/Lisbon') AS antes_lisboa,
  scheduled_at                                  AS depois_utc,
  (scheduled_at AT TIME ZONE 'Europe/Lisbon')   AS depois_lisboa;

-- Revê o RETURNING. Depois executa uma das duas:
--   COMMIT;
--   ROLLBACK;
ROLLBACK;
