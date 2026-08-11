---
title: 'Palestras sem questionário de fadiga + "Hoje" mostra todas as sessões da semana'
type: 'bugfix'
created: '2026-08-08'
status: 'done'
route: 'plan-code-review'
context: []
---

# Palestras sem questionário de fadiga + "Hoje" mostra todas as sessões da semana

## Intent

**Problem:** Duas questões relacionadas no ecrã "Hoje" do jogador: (1) uma sessão do tipo Palestra abria o questionário de fadiga pré-sessão — o questionário só deve existir para Treino, Jogo e Jogo amigável; (2) o ecrã só mostrava a sessão mais próxima, quando devia listar todas as sessões dos próximos 7 dias.

**Approach:**
- Novo `requiresFatigueQuestionnaire(type)` em `schemas/sessions.ts` (allowlist: training/match/friendly) — fonte única de verdade, usada em todos os pontos onde uma palestra podia acabar associada a um questionário:
  - `SessionCard`: para palestra, o jogador vai para o detalhe da sessão (`/agenda/[id]`) em vez do questionário; sem badge "Respondido".
  - Página `/questionario/[sessionId]/[phase]`: guarda explícita — mesmo por acesso directo ao link (ex.: notificação push já enviada antes desta correção), mostra erro em vez de renderizar o formulário.
  - Edge function `schedule-session-pushes`: deixa de agendar pushes `fatigue_pre`/`fatigue_post` para sessões do tipo `lecture`.
- `hoje/page.tsx` deixa de pegar só em `result.data[0]` — usa a lista completa de sessões da janela de 7 dias. Estado de "respondido" passa a ser um mapa `sessionId → boolean`, calculado só para as sessões elegíveis (evita chamadas desnecessárias para palestras). A escolha de "Sessão recente" (prompt de questionário pós-sessão) também passa a excluir palestras.
- `TodayPageContent`: troca `nextSession`/`nextSessionAnswered` (um item) por `upcomingSessions`/`answeredMap` (lista); título passa de "Próxima sessão" para "Próximos 7 dias".

## Suggested Review Order

- Fonte única de verdade do tipo de sessão elegível para questionário.
  [`schemas/sessions.ts`](../../sparta/src/lib/schemas/sessions.ts)
- `SessionCard` — link/badge condicionais ao tipo.
  [`session-card.tsx:35`](../../sparta/src/components/ui/session-card.tsx#L35)
- Guarda na própria página do questionário (rede de segurança).
  [`questionario/[sessionId]/[phase]/page.tsx:95`](../../sparta/src/app/(player)/questionario/[sessionId]/[phase]/page.tsx#L95)
- Edge function deixa de agendar push de fadiga para palestras.
  [`schedule-session-pushes/index.ts:33`](../../sparta/supabase/functions/schedule-session-pushes/index.ts#L33)
- `hoje/page.tsx` — lista completa + mapa de respondidos + exclusão de palestras da "sessão recente".
  [`hoje/page.tsx`](../../sparta/src/app/(player)/hoje/page.tsx)
- `TodayPageContent` — renderiza lista em vez de card único.
  [`today-page-content.tsx`](../../sparta/src/components/app/today-page-content.tsx)
- Testes: helper, SessionCard com palestra, `/hoje` com várias sessões e com palestra, guarda da página do questionário.
  [`sessions.test.ts`](../../sparta/src/__tests__/lib/schemas/sessions.test.ts), [`session-card.test.tsx`](../../sparta/src/__tests__/components/session-card.test.tsx), [`hoje.test.tsx`](../../sparta/src/__tests__/app/hoje.test.tsx), [`today-page-content.test.tsx`](../../sparta/src/components/app/__tests__/today-page-content.test.tsx), [`questionario page.test.tsx`](../../sparta/src/app/(player)/questionario/[sessionId]/[phase]/__tests__/page.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/app/hoje.test.tsx src/components/app/__tests__/today-page-content.test.tsx src/__tests__/components/session-card.test.tsx src/components/ui/__tests__/session-card.test.tsx src/__tests__/lib/schemas/sessions.test.ts "src/app/(player)/questionario/[sessionId]/[phase]/__tests__/page.test.tsx"` -- expected: 73 testes a passar
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois

**Não verificável sem ambiente Supabase real:** a alteração à edge function `schedule-session-pushes` (Deno) não pode ser executada localmente — a correção segue o mesmo padrão já usado noutros filtros de query dessa função.
