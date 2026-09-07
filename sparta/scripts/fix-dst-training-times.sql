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
-- Estratégia: as sessões de uma série de repetição são inseridas na mesma
-- transação, por isso partilham `created_at`. A hora de parede pretendida é a
-- da 1ª ocorrência da série (anterior à mudança). Para cada ocorrência seguinte
-- recalcula-se o instante UTC cuja leitura em Europe/Lisbon é essa mesma hora.
-- Só ajusta linhas com desvio de exatamente +1h e status 'scheduled'.
--
-- Como correr:
--   1. Executa o PASSO 1 (SELECT) e confirma a lista de sessões a corrigir.
--   2. Executa o PASSO 2 (transação com UPDATE ... RETURNING).
--   3. Revê o RETURNING; se estiver certo executa `COMMIT;`, senão `ROLLBACK;`.
--   psql:  psql "$DATABASE_URL" -f scripts/fix-dst-training-times.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Vista partilhada pelos dois passos: id + hora actual + hora corrigida.
-- (Para abranger todos os tipos de sessão, remove `AND s2.type = 'training'`.)

-- ═══ PASSO 1 — PRÉ-VISUALIZAÇÃO (só leitura) ═════════════════════════════════
SELECT
  f.id,
  f.old_at                                       AS antes_utc,
  (f.old_at AT TIME ZONE 'Europe/Lisbon')        AS antes_lisboa,
  f.new_at                                       AS depois_utc,
  (f.new_at AT TIME ZONE 'Europe/Lisbon')        AS depois_lisboa
FROM (
  SELECT
    b.id,
    b.scheduled_at AS old_at,
    (
      (b.scheduled_at AT TIME ZONE 'Europe/Lisbon')::date
      + (b.first_at   AT TIME ZONE 'Europe/Lisbon')::time
    ) AT TIME ZONE 'Europe/Lisbon' AS new_at
  FROM (
    SELECT
      s2.id,
      s2.scheduled_at,
      first_value(s2.scheduled_at) OVER (
        PARTITION BY s2.club_id, s2.type, s2.duration_min, s2.created_by, s2.created_at
        ORDER BY s2.scheduled_at
      ) AS first_at
    FROM sessions s2
    WHERE s2.status = 'scheduled'
      AND s2.type = 'training'
  ) b
) f
WHERE f.new_at - f.old_at = interval '1 hour'
  AND f.old_at >= (timestamp '2026-10-24 00:00:00' AT TIME ZONE 'Europe/Lisbon')
ORDER BY f.old_at;


-- ═══ PASSO 2 — APLICAÇÃO (em transação; termina em COMMIT ou ROLLBACK) ═══════
BEGIN;

UPDATE sessions s
SET scheduled_at = f.new_at
FROM (
  SELECT
    b.id,
    b.scheduled_at AS old_at,
    (
      (b.scheduled_at AT TIME ZONE 'Europe/Lisbon')::date
      + (b.first_at   AT TIME ZONE 'Europe/Lisbon')::time
    ) AT TIME ZONE 'Europe/Lisbon' AS new_at
  FROM (
    SELECT
      s2.id,
      s2.scheduled_at,
      first_value(s2.scheduled_at) OVER (
        PARTITION BY s2.club_id, s2.type, s2.duration_min, s2.created_by, s2.created_at
        ORDER BY s2.scheduled_at
      ) AS first_at
    FROM sessions s2
    WHERE s2.status = 'scheduled'
      AND s2.type = 'training'
  ) b
) f
WHERE s.id = f.id
  AND f.new_at - f.old_at = interval '1 hour'
  AND f.old_at >= (timestamp '2026-10-24 00:00:00' AT TIME ZONE 'Europe/Lisbon')
RETURNING
  s.id,
  f.old_at                                       AS antes_utc,
  (f.old_at AT TIME ZONE 'Europe/Lisbon')        AS antes_lisboa,
  s.scheduled_at                                 AS depois_utc,
  (s.scheduled_at AT TIME ZONE 'Europe/Lisbon')  AS depois_lisboa;

-- Revê o RETURNING. Depois executa uma das duas:
--   COMMIT;
--   ROLLBACK;
ROLLBACK;
