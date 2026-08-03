---
title: 'Adicionar tipo de sessão "Palestra"'
type: 'feature'
created: '2026-08-03'
status: 'done'
context: []
baseline_commit: 'ad75061e6323cc2a56dae254b42948ef4e6dd99b'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O campo "Tipo de sessão" no modal "Nova sessão" só permite Treino, Jogo e Jogo amigável. Não existe forma de agendar uma palestra (sessão sem componente físico).

**Approach:** Adicionar `"lecture"` como novo valor válido de `SessionType` (BD + Zod + todos os mapas de label/ícone), propagando-o a todos os pontos que hoje enumeram os 3 tipos existentes. Palestra herda o comportamento de Treino em todo o lado onde o código atualmente ramifica por tipo (sem convocatória, sem restrição a 1 equipa, conta como "Treino" nos filtros de presença e no filtro do analista), exceto o seu próprio label/ícone.

## Boundaries & Constraints

**Always:**
- Valor interno (BD, Zod, `SessionType`) é `"lecture"`; label em UI é sempre "Palestra".
- Onde o código hoje testa `type === "training"` (ou o inverso, "não é match/friendly") para decidir comportamento, `"lecture"` segue o mesmo ramo que `"training"`.
- Todo `Record<SessionType, ...>` (labels, ícones, cores) ganha uma entrada `lecture` — o compilador TypeScript deve fechar sem `any`/cast extra.
- Nova migration numerada sequencialmente em `sparta/supabase/migrations/` (não editar a `000120_sessions.sql` histórica).

**Ask First:**
- Se o nome da constraint `CHECK` gerada por omissão pelo Postgres não for `sessions_type_check` (confirmar antes de aplicar `DROP CONSTRAINT`).

**Never:**
- Não alterar `ReportScope` (`sparta/src/lib/actions/reports.ts`) nem o CHECK de `pdf_reports.scope` — é um enum não relacionado que reutiliza as palavras "match"/"training".
- Não adicionar bucket de filtro próprio para Palestra (nem em `PresencasTab` nem em `/sessoes`) — dobra sempre sobre "Treinos" nesta iteração.
- Não tocar no pipeline de push notifications / cálculo de sRPE-ACWR — já opera por `session_id`, não por `type`, logo não precisa de alteração.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Criar sessão Palestra | Modal "Nova sessão", tipo = Palestra, dados válidos | Sessão criada com `type = 'lecture'`, sem limite de 1 equipa | N/A |
| BD rejeita valor antigo inválido | Tentativa de insert direto com `type` fora da lista | Erro de constraint CHECK (comportamento inalterado) | Erro Postgres 23514 propagado como hoje |
| Convocatória em sessão Palestra | Staff navega para `/sessoes/[id]/convocatoria` de uma sessão `lecture` | Redirect para `/sessoes/[id]?toast=training-no-lineup`, igual a Treino | N/A |
| Filtro presenças do jogador | `PresencasTab`, filtro "Treinos" ativo, jogador tem sessão `lecture` | Sessão Palestra aparece na lista | N/A |
| Filtro sessões do analista | `/sessoes?tipo=training` | Sessões `lecture` incluídas nos resultados | N/A |

</frozen-after-approval>

## Code Map

- `sparta/supabase/migrations/000393_sessions_lecture_type.sql` -- NOVO: `ALTER TABLE sessions DROP CONSTRAINT sessions_type_check, ADD CONSTRAINT sessions_type_check CHECK (type IN ('training','match','friendly','lecture'))`
- `sparta/src/lib/schemas/sessions.ts:3` -- `SESSION_TYPES` fonte da verdade; adicionar `"lecture"`
- `sparta/src/lib/actions/sessions.ts:38` -- `SessionFiltersSchema.type` espelha `SESSION_TYPES`
- `sparta/src/app/(staff)/calendario/session-form.tsx:23-27` -- `SESSION_TYPE_LABELS`; alimenta os `<select>` de criar (linha 152) e editar (linha 411) via `Object.entries`; `isSingleTeamType` (linhas 73, 330) já exclui `lecture` por construção
- `sparta/src/components/ui/session-card.tsx:10-17` -- `TYPE_CONFIG` (label + ícone lucide-react); escolher ícone, ex. `Presentation`
- `sparta/src/lib/constants/session-colors.ts:9-13` -- `SESSION_TYPE_COLORS` (bg/bgDark/label), consumido por calendário/agenda
- `sparta/src/components/ui/fatigue-questionnaire.tsx:37,82-89` -- prop `sessionType` + `formatSessionType`
- `sparta/src/components/domain/FatigueTable.tsx:44-48` -- `SESSION_TYPE_LABELS` (tabela sRPE staff)
- `sparta/src/app/(staff)/plantel/[id]/perfil/PresencasTab.tsx:21-25,115-116` -- label map + filtro `treinos`/`jogos`: linha 115 passa a testar `s.session_type === "training" || s.session_type === "lecture"`
- `sparta/src/app/(staff)/sessoes/[id]/convocatoria/page.tsx:60-63` -- redirect: `if (session.type === "training" || session.type === "lecture")`
- `sparta/src/app/(staff)/sessoes/page.tsx:96-116` -- filtro "matches" já usa OR client-side; ramo "training" (linhas 104-110) usa `.eq` na query — trocar por fetch sem filtro de tipo + filtro client-side `(s.type === "training" || s.type === "lecture")`, espelhando o padrão do ramo "matches"

## Tasks & Acceptance

**Execution:**
- [x] `sparta/supabase/migrations/000393_sessions_lecture_type.sql` -- criar migration -- desbloqueia o valor `lecture` na BD
- [x] `sparta/src/lib/schemas/sessions.ts` -- adicionar `"lecture"` a `SESSION_TYPES` -- fonte da verdade do tipo, propaga erro de compilação a todos os `Record<SessionType,...>` por atualizar
- [x] `sparta/src/lib/actions/sessions.ts` -- espelhar em `SessionFiltersSchema` -- mantém validação de filtros consistente
- [x] `sparta/src/app/(staff)/calendario/session-form.tsx` -- adicionar `lecture: "Palestra"` a `SESSION_TYPE_LABELS` -- opção aparece nos dois `<select>` (criar/editar)
- [x] `sparta/src/components/ui/session-card.tsx` -- adicionar entrada `lecture` a `TYPE_CONFIG` com ícone próprio -- cartão de sessão renderiza Palestra corretamente
- [x] `sparta/src/lib/constants/session-colors.ts` -- adicionar entrada `lecture` a `SESSION_TYPE_COLORS` -- calendário/agenda pintam Palestra com cor própria
- [x] `sparta/src/components/ui/fatigue-questionnaire.tsx` -- alargar união `sessionType` e `formatSessionType` -- questionário mostra "Palestra" no cabeçalho
- [x] `sparta/src/components/domain/FatigueTable.tsx` -- adicionar `lecture: "Palestra"` -- tabela de fadiga do staff mostra label correto
- [x] `sparta/src/app/(staff)/plantel/[id]/perfil/PresencasTab.tsx` -- adicionar label + incluir `lecture` na condição do filtro `treinos` (linha 115) -- Palestra conta como Treino nas presenças
- [x] `sparta/src/app/(staff)/sessoes/[id]/convocatoria/page.tsx` -- incluir `lecture` na condição de redirect -- Palestra nunca mostra ecrã de convocatória
- [x] `sparta/src/app/(staff)/sessoes/page.tsx` -- incluir `lecture` no ramo de filtro "training" -- Palestra aparece no filtro "Treinos" do analista

**Acceptance Criteria:**
- Given o modal "Nova sessão" aberto, when o utilizador abre o dropdown "Tipo de sessão", then vê a opção "Palestra" entre as existentes.
- Given uma sessão criada com tipo Palestra, when o staff acede a `/sessoes/[id]/convocatoria`, then é redirecionado sem ver o ecrã de convocatória (igual a Treino).
- Given uma sessão Palestra e o filtro "Treinos" ativo, when o jogador ou staff vê o separador de presenças/lista do analista, then a sessão aparece.
- Given `npm run build` (tsc) após todas as alterações, when compilado, then não há erros de `Record<SessionType,...>` incompleto.

## Design Notes

Ícone sugerido para `TYPE_CONFIG.lecture`: `Presentation` (lucide-react) — já disponível no pacote, sem nova dependência. Cor sugerida em `SESSION_TYPE_COLORS.lecture`: um tom diferenciado dos três existentes (azul=treino, vermelho=jogo, amarelo=amigável), ex. roxo `#7C3AED`.

## Verification

**Commands:**
- `cd sparta && npm run build` -- expected: compila sem erros de tipo (garante que nenhum `Record<SessionType,...>` ficou incompleto)
- `cd sparta && npm run test --run` -- expected: suites existentes continuam a passar (fixtures literais `"training"/"match"/"friendly"` não são afetadas)

**Manual checks (if no CLI):**
- Abrir `/calendario/nova`, confirmar "Palestra" no dropdown e criar uma sessão de teste.
- Confirmar que `/sessoes/[id]/convocatoria` redireciona para a sessão Palestra criada.

## Suggested Review Order

**Fonte da verdade do tipo**

- `SESSION_TYPES` ganha `"lecture"` — tudo o resto deriva daqui.
  [`sessions.ts:3`](../../sparta/src/lib/schemas/sessions.ts#L3)

**Base de dados e validação de filtros**

- Novo valor autorizado na constraint CHECK da tabela `sessions`.
  [`000393_sessions_lecture_type.sql`](../../sparta/supabase/migrations/000393_sessions_lecture_type.sql#L1)
- `SessionFiltersSchema` espelha o union para validar filtros de servidor.
  [`sessions.ts:38`](../../sparta/src/lib/actions/sessions.ts#L38)

**Formulário "Nova sessão"**

- Label "Palestra" alimenta os dois `<select>` (criar/editar) via `Object.entries`.
  [`session-form.tsx:27`](../../sparta/src/app/(staff)/calendario/session-form.tsx#L27)

**Comportamento: sem convocatória (herda de Treino)**

- Palestra segue o mesmo ramo de redirect que Treino — nunca mostra ecrã de convocatória.
  [`convocatoria/page.tsx:61`](../../sparta/src/app/(staff)/sessoes/[id]/convocatoria/page.tsx#L61)
- Prop alargada para `SessionType`, removendo um cast unsafe que excluía `"lecture"` (site extra apanhado na revisão).
  [`session-detail-actions.tsx:12`](../../sparta/src/app/(staff)/sessoes/[id]/session-detail-actions.tsx#L12)
- Chamada actualizada para deixar de fazer cast unsafe.
  [`sessoes/[id]/page.tsx:131`](../../sparta/src/app/(staff)/sessoes/[id]/page.tsx#L131)

**Filtros: Palestra conta como Treino**

- Filtro de presenças do jogador inclui `lecture` no bucket "treinos".
  [`PresencasTab.tsx:116`](../../sparta/src/app/(staff)/plantel/[id]/perfil/PresencasTab.tsx#L116)
- Filtro do analista passa a filtrar client-side (fetch única, sem duplicação — simplificado na revisão).
  [`sessoes/page.tsx:104`](../../sparta/src/app/(staff)/sessoes/page.tsx#L104)

**Visual: labels, ícones e cores**

- Cartão de sessão ganha ícone `Presentation` + label Palestra.
  [`session-card.tsx:17`](../../sparta/src/components/ui/session-card.tsx#L17)
- Página de detalhe da sessão tem o seu próprio `TYPE_CONFIG` — site extra apanhado pelo build TS.
  [`sessoes/[id]/page.tsx:19`](../../sparta/src/app/(staff)/sessoes/[id]/page.tsx#L19)
- Cor roxa própria no calendário/agenda.
  [`session-colors.ts:13`](../../sparta/src/lib/constants/session-colors.ts#L13)

**Periféricos: fadiga e testes**

- Questionário de fadiga mostra "Palestra" no cabeçalho (pipeline sRPE não é filtrado por tipo, sem alteração de lógica).
  [`fatigue-questionnaire.tsx:87`](../../sparta/src/components/ui/fatigue-questionnaire.tsx#L87)
- Tabela de fadiga do staff ganha label.
  [`FatigueTable.tsx:48`](../../sparta/src/components/domain/FatigueTable.tsx#L48)
- Teste actualizado para refletir fetch sem filtro server-side de tipo.
  [`sessoes.test.tsx:134`](../../sparta/src/__tests__/app/sessoes.test.tsx#L134)
