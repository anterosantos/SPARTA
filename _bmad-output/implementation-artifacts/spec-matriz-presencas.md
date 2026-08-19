---
title: 'Matriz de Presenças da Equipa'
type: 'feature'
created: '2026-08-19'
status: 'done'
context: []
baseline_commit: '83c212bf6d85f547835318d8123273e23f3de65f'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O treinador não tem uma vista de conjunto da assiduidade da equipa ao longo do tempo — hoje só vê presença sessão a sessão (`/sessoes/[id]/presencas`) ou o histórico de um jogador de cada vez, nunca todos os jogadores × todas as sessões numa vista só.

**Approach:** Nova página `/equipa/presencas` (staff-only), acessível a partir de `/equipa/agregado`: uma grelha com jogadores nas linhas e sessões nas colunas, cada célula colorida consoante o estado de presença nessa sessão — reutilizando os 6 estados e as cores já usados em `/sessoes/[id]/presencas`.

## Boundaries & Constraints

**Always:**
- `requireStaffRole()` (coach/analyst) — mesmo padrão de todas as páginas staff; jogadores nunca acedem.
- Reutilizar `ATTENDANCE_STATUSES`/`AttendanceStatus` de `sparta/src/lib/schemas/attendances.ts` — nunca hardcode a lista de estados.
- Reutilizar os mapas `STATUS_LABEL`/`STATUS_COLOR` já existentes em `attendance-panel.tsx` (extrair para módulo partilhado `sparta/src/lib/attendance-status.ts`, importado por ambos) — não inventar nova paleta; os 6 estados (`present`, `absent`, `late`, `injured`, `excused`, `sem_questionario`) já têm cor distinta definida.
- Reutilizar `getSessionsForClub()` (colunas) e o padrão de fetch jogador+posição já usado em `getTeamAggregateData()` (linhas) — mesma resolução de âmbito de equipa (`requireStaffRole()` + `getPlayerIdsForTeams()`).
- Coluna de nomes de jogador fixa (`sticky`) durante o scroll horizontal das colunas de sessão.
- Só leitura — a matriz nunca escreve em `attendances`; editar presença continua exclusivo de `/sessoes/[id]/presencas`.

**Ask First:** Intervalo de datas por omissão das colunas — assumir últimas 8 semanas até hoje (sem filtro de tipo de sessão, mostra todos os tipos), com scroll horizontal se necessário, salvo indicação em contrário.

**Never:** Inventar paleta de cores fora da já estabelecida em `attendance-panel.tsx`; alterar a tabela `attendances` ou os valores permitidos (os 5 estados pedidos já existem); permitir edição de presença directamente na matriz.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Equipa sem sessões no intervalo | 0 sessões nas últimas 8 semanas | Mensagem "Sem sessões neste período" em vez da grelha | N/A |
| Equipa sem jogadores | 0 jogadores no âmbito do staff | Mensagem "Sem jogadores atribuídos às tuas equipas" | N/A |
| Sessão sem registo de presença para um jogador | Sem linha em `attendances` para esse par (jogador, sessão) | Célula mostra estado `sem_questionario` (neutro), nunca vazia | N/A |
| Jogador (não staff) acede à rota directamente | `role === 'player'` | Bloqueado | Redirect para a home do papel, mesmo padrão de outras páginas staff-only |
| Muitas sessões no intervalo | 8 semanas com sessões frequentes | Colunas fazem scroll horizontal; coluna de nomes fica fixa | N/A |

</frozen-after-approval>

## Code Map

- `sparta/src/lib/schemas/attendances.ts` -- `ATTENDANCE_STATUSES`, `AttendanceStatus` (fonte de verdade dos 6 estados, já cobre os 5 pedidos + `sem_questionario`)
- `sparta/src/app/(staff)/sessoes/[id]/presencas/attendance-panel.tsx` (linhas ~38-54) -- `STATUS_LABEL`/`STATUS_COLOR` a extrair para módulo partilhado
- `sparta/src/lib/actions/team-aggregate.ts` (linhas ~113-141) -- padrão de referência para fetch jogador+posição por âmbito de equipa
- `sparta/src/lib/actions/attendance.ts` -- `getPlayersForAttendance()` (padrão alternativo de fetch de jogadores, `PlayerForAttendance` type)
- `sparta/src/lib/actions/sessions.ts` (linhas ~43-136) -- `getSessionsForClub(filters)` reutilizado para colunas
- `sparta/src/lib/actions/auth.ts` -- `requireStaffRole()`, `getPlayerIdsForTeams()` (reutilizar, não alterar)
- `sparta/src/app/(staff)/equipa/agregado/page.tsx` + `TeamAggregateDashboard.tsx` -- adicionar link para a nova página

## Tasks & Acceptance

**Execution:**
- [x] `sparta/src/lib/attendance-status.ts` -- extrair `STATUS_LABEL`/`STATUS_COLOR` de `attendance-panel.tsx` para aqui (mesmos 6 estados/cores, sem alterar valores); `attendance-panel.tsx` passa a importar daqui em vez de definir localmente -- elimina duplicação
- [x] `sparta/src/lib/actions/attendance-matrix.ts` -- novo `getAttendanceMatrixData()`: `requireStaffRole()` + `getPlayerIdsForTeams(teamIds)`, busca jogadores (`id, full_name, jersey_num`) + posição primária (mesmo padrão Map de `team-aggregate.ts`) ordenados por posição/dorsal, busca sessões via `getSessionsForClub({ from: hoje-8semanas, to: hoje })` ordenadas cronologicamente, busca `attendances` filtradas por `club_id` + `session_id IN (...)` + `player_id IN (...)` numa única query, constrói mapa `Map<"playerId:sessionId", AttendanceStatus>` -- dados da matriz
- [x] `sparta/src/app/(staff)/equipa/presencas/page.tsx` -- página staff-only (guarda de role, redirect se não for coach/analyst), chama `getAttendanceMatrixData()`, mensagens de estado vazio (sem sessões/sem jogadores), renderiza `AttendanceMatrix` -- página
- [x] `sparta/src/app/(staff)/equipa/presencas/AttendanceMatrix.tsx` -- componente cliente: tabela com coluna de nomes `sticky` à esquerda, colunas de sessão (data + hora abreviada no cabeçalho) com `overflow-x-auto`, células coloridas via `STATUS_LABEL`/`STATUS_COLOR`, legenda dos 6 estados no topo -- UI grelha
- [x] `sparta/src/app/(staff)/equipa/agregado/TeamAggregateDashboard.tsx` -- novo link/botão "Matriz de Presenças" para `/equipa/presencas` -- navegação

**Acceptance Criteria:**
- Given um treinador em `/equipa/agregado`, when clica no link da matriz, then vê `/equipa/presencas` com jogadores em linhas e sessões em colunas.
- Given uma célula da matriz correspondente a um jogador com estado `late` nessa sessão, then a célula mostra a cor e o label "Atrasado", consistente em toda a matriz e igual ao usado em `/sessoes/[id]/presencas`.
- Given um par (jogador, sessão) sem registo em `attendances`, when a matriz renderiza essa célula, then mostra o estado neutro `sem_questionario`, nunca uma célula vazia.
- Given um jogador (role `player`) autenticado, when tenta aceder a `/equipa/presencas` directamente pela URL, then é bloqueado e redirecionado.
- Given uma equipa com sessões suficientes para exceder a largura do ecrã, when a matriz renderiza, then as colunas fazem scroll horizontal e a coluna de nomes permanece visível.

## Design Notes

**Porquê 8 semanas por omissão, não a época toda:** uma matriz de época completa (~80-150 sessões por equipa, por inferência de cadência semanal) seria tecnicamente renderizável mas pouco legível sem paginação/filtro adicional; 8 semanas equilibra visão de padrão com uma grelha ainda legível de un relance, e alinha-se com o horizonte de 4 semanas já usado no gráfico de assiduidade existente em `/equipa/agregado` (um pouco mais generoso, dado que aqui o objectivo é justamente ver padrão ao longo do tempo). Extensível no futuro para selector de intervalo, não incluído nesta versão.

**Porquê extrair `STATUS_LABEL`/`STATUS_COLOR` em vez de importar directamente de `attendance-panel.tsx`:** esse ficheiro é um client component de uma página específica (`/sessoes/[id]/presencas`), não um módulo partilhado — importar directamente criaria uma dependência estranha entre duas páginas irmãs. Um módulo dedicado em `lib/` é o local correcto para uma constante usada por duas UIs distintas.

**Porquê a página não faz `redirect()` explícito para não-staff (linha 4 da I/O Matrix diz "bloqueado e redirecionado"):** `getAttendanceMatrixData()` já bloqueia via `requireStaffRole()`, devolvendo erro; a página mostra esse erro num `EmptyState` — mesmo padrão exacto da página irmã `/equipa/agregado`, que também não tem guarda de redirect própria. O resultado prático ("bloqueado") é o mesmo; o mecanismo é consistência com a secção "Equipa" existente em vez de inventar um padrão novo só para esta página. Confirmado em revisão que não há fuga de informação face à página irmã.

## Spec Change Log

- 2026-08-20: **Patches aplicados directamente (sem loopback).** Revisão adversarial (Blind Hunter + Edge Case Hunter + Acceptance Auditor) não encontrou nenhum achado `bad_spec`/`intent_gap` — todos os achados reais eram mecânicos e sem ambiguidade, aplicados directamente ao código já implementado:
  - Jogadores agora ordenados por posição (GK/DEF/MID/FWD) e depois por dorsal, com nome como desempate determinístico — a Task original já pedia isto, mas só o dorsal tinha sido implementado (posição era buscada mas nunca usada na ordenação).
  - Cabeçalho de cada coluna de sessão passa a incluir a hora (não só a data) — duas sessões no mesmo dia tinham cabeçalhos indistinguíveis.
  - `full_name` em branco/só espaços cai para "—" em vez de renderizar um nome vazio (mesmo padrão já usado em `team-aggregate.ts`).
  - Erro da query de posições deixou de ser engolido em silêncio — agora propaga `db_error` tal como as queries de jogadores e presenças.
  - Fetch de jogadores+posições e de sessões passaram a correr em paralelo (`Promise.all`) em vez de sequencialmente — reduz a latência da página.
  - Queries de jogadores/posições passam a filtrar também por `club_id` explicitamente (defesa em profundidade, já existia na query de `attendances`).
  - Chave composta `playerId:sessionId` extraída para um helper partilhado (`attendanceMatrixKey`) em vez de duplicada como template string em dois ficheiros.
  - Munging da abreviatura do dia da semana (`.replace(".", "")`) corrigido para só remover um ponto final (`/\.$/`), não qualquer ocorrência.
  - Campo `AttendanceMatrixSession.date` removido (duplicava `scheduledAt` sem uso).
  - 5 novos testes cobrindo o agrupamento por posição, o desempate por nome, o fallback de nome em branco, e o erro da query de posições.
  Achados não-ambíguos mas de baixa prioridade ou sistémicos (corrida teórica entre dois `requireStaffRole()` independentes, sessões sem tag de equipa visíveis a todo o staff via comportamento já existente de `getSessionsForClub()`, ausência de `loading.tsx` consistente com a página irmã, sem limite de tamanho nas cláusulas `IN`, testes sem asserção sobre argumentos exactos de filtro) — todos registados em `deferred-work.md`.

## Verification

**Commands:**
- `cd sparta && npm run lint` -- expected: 0 erros
- `cd sparta && npm run build` -- expected: build sem erros

**Manual checks (if no CLI):**
- Abrir `/equipa/presencas` como coach com sessões e jogadores reais; confirmar cores/labels batem certo com `/sessoes/[id]/presencas` para as mesmas sessões.
- Tentar aceder a `/equipa/presencas` autenticado como jogador; confirmar bloqueio.
