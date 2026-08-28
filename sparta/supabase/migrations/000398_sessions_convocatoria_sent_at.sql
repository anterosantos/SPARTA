-- Migration: 000398_sessions_convocatoria_sent_at
-- Purpose: Distinguir "convocatória guardada (rascunho, só staff)" de
-- "convocatória enviada (jogadores notificados)".
--
-- Bug corrigido: getPlayerNotifications() (ver AGENTS.md padrão #13) mostra um item
-- "convocado" no ecrã Hoje do jogador para QUALQUER linha em match_lineups da sessão,
-- sem distinguir se veio de submitLineup() ("Guardar, só staff") ou de
-- sendConvocatoria() ("Enviar convocatória"). Resultado: um simples "Guardar" já
-- tornava a convocatória visível aos jogadores, antes de ser realmente enviada.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS convocatoria_sent_at timestamptz;

COMMENT ON COLUMN sessions.convocatoria_sent_at IS
  'Momento em que sendConvocatoria() foi executado com sucesso (jogadores '
  'notificados). NULL enquanto só houver um "Guardar (só staff)" — nesse estado, '
  'match_lineups já pode ter linhas, mas getPlayerNotifications() não deve mostrar '
  'nada aos jogadores até este campo estar preenchido.';
