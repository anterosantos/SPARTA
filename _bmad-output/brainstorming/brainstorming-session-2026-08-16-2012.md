---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_active: false
workflow_completed: true
session_topic: 'Novo ecrã "Horário de Saída" no menu Eu (input one-shot no início da época, Segunda a Sexta) e a sua exibição no ecrã de Prontidão para o treinador'
session_goals: 'Exploração aberta: UX do ecrã de preenchimento one-shot, exibição da informação no painel de Prontidão, valor/decisões que desbloqueia para o treinador, e casos limite'
selected_approach: 'progressive-flow'
techniques_used: ['What If Scenarios', 'Mind Mapping', 'SCAMPER Method', 'Constraint Mapping']
ideas_generated: [9]
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Antero
**Date:** 2026-08-16

## Session Overview

**Topic:** Novo ecrã "Horário de Saída" no menu Eu (input one-shot no início da época, Segunda a Sexta) e a sua exibição no ecrã de Prontidão para o treinador

**Goals:** Exploração aberta — UX do ecrã de preenchimento, exibição no painel de Prontidão, valor/decisões desbloqueadas para o treinador, e casos limite

### Context Guidance

_Sem ficheiro de contexto fornecido._

### Session Setup

Jogadores reportam, uma única vez no início da época (quando disponível), o horário de saída da escola para cada dia útil (Segunda a Sexta), num novo ecrã acessível a partir do menu "Eu". Essa informação fica depois visível para o treinador no ecrã de Prontidão, por jogador (ex.: "Hora de saída da escola: 17:30"). O utilizador optou por exploração aberta — todas as direções (UX de preenchimento, exibição no painel do treinador, valor para decisões, casos limite).

## Technique Selection

**Approach:** Fluxo Progressivo de Técnicas
**Journey Design:** Desenvolvimento sistemático, de exploração ampla até plano de ação

**Técnicas Progressivas:**

- **Fase 1 - Exploração:** What If Scenarios, para gerar o máximo de ideias divergentes sem restrições
- **Fase 2 - Reconhecimento de Padrões:** Mind Mapping, para organizar a exploração em temas/ramos
- **Fase 3 - Desenvolvimento:** SCAMPER Method, para aprofundar e refinar os conceitos mais fortes
- **Fase 4 - Plano de Ação:** Constraint Mapping, para identificar restrições reais (GDPR, RLS, padrões existentes do SPARTA) e caminhos de implementação

**Journey Rationale:** O utilizador pediu exploração aberta (UX, exibição, valor de decisão, casos limite) — o fluxo progressivo cobre tudo isto naturalmente: divergência ampla (Fase 1), depois organização em temas (Fase 2), aprofundamento dos conceitos mais promissores (Fase 3), e por fim ancoragem na realidade técnica/regulatória do projeto (Fase 4).

## Technique Execution Results

### Fase 1 — What If Scenarios

**Interactive Focus:** Propósito real do dado (porque interessa ao treinador), simplificações deliberadas, UX de preenchimento, filosofia de falha (humana vs automática), exibição no painel, casos limite de calendário escolar.

**Ideias geradas:**

**[Propósito #1]: Sinalização de Risco de Atraso**
_Concept_: A hora de saída da escola não é um dado decorativo — serve para o treinador antecipar se um jogador pode chegar atrasado a uma sessão, cruzando o horário de saída com a hora de início da sessão.
_Novelty_: O valor real não está em mostrar "17:30" cru, mas em computar e sinalizar risco.

**[Regra #2]: Tempo de Deslocação Fixo (1h)**
_Concept_: Assume-se uma constante de 1 hora entre saída da escola e chegada ao clube, para todos os jogadores, sem geolocalização/distância.
_Novelty_: Troca precisão por simplicidade — evita over-engineering.

**[UX #3]: Toggle "Mesma hora todos os dias" vs "Horas diferentes"**
_Concept_: Atalho no ecrã de preenchimento — quem sai sempre à mesma hora preenche um único campo; só quem tem variação por dia preenche os 5 campos.
_Novelty_: Reduz fricção no caso comum sem perder precisão no caso menos comum.

**[Princípio #4]: Falha Silenciosa, Resolução Humana**
_Concept_: Quando falta o horário, mostra-se um indicador discreto "informação em falta" — sem notificações automáticas. É o treinador que, no contacto humano normal, pede o preenchimento ao jogador.
_Novelty_: Alinha-se com o padrão "dados mediados" já existente no SPARTA — o staff medeia, o sistema não persegue o jogador.

**[Decisão #5]: Coluna Sempre Visível na Prontidão**
_Concept_: A hora de saída fica sempre visível, dia a dia, sem lógica condicional para esconder/mostrar consoante o risco.
_Novelty_: Prioriza consistência e previsibilidade sobre economia de espaço no ecrã.

**[Modelo #6]: Horário Semanal Único + Intervalos Letivos**
_Concept_: Um único horário semanal (Seg-Sex) definido no preenchimento one-shot, mais uma lista de intervalos de datas em que esse horário está ativo (períodos letivos) — para lidar com férias escolares sem duplicar horários por período.
_Novelty_: Mantém o preenchimento "one-shot" praticamente intacto; separa "o quê" (horário) de "quando" (validade).

**Creative Breakthrough:** A descoberta de que o dado só tem valor enquanto **sinal de risco de atraso** (não como informação passiva) — isso deveria orientar todo o resto do desenho, incluindo o que aparece no ecrã de Prontidão e como se lida com dados em falta.

**User Creative Strengths:** Correção rápida de suposições erradas (recusou "dado vivo"), decisões pragmáticas de scope (deslocação fixa, sem geolocalização), e trouxe uma restrição de negócio não óbvia (períodos letivos múltiplos) que mudou o modelo de dados.

**Energy Level:** Focada e pragmática — mais orientada a decisões concretas do que a ideias soltas, o que é coerente com o estado maduro do projeto.

### Fase 2 — Mind Mapping

**Interactive Focus:** Organizar as 6 ideias da Fase 1 em ramos temáticos, validar o agrupamento com o utilizador, e identificar ramos em falta.

**Nova ideia surgida durante a organização:**

**[Integração #7]: Relação com Relatório de Presenças**
_Concept_: O risco de atraso (ou o atraso real) pode aparecer no contexto do registo de presenças da sessão — ajuda a distinguir "atrasou por causa do horário da escola" de outras causas de atraso/falta.
_Novelty_: Aproveita infraestrutura já existente no SPARTA (registo de presenças, relatórios PDF) em vez de criar um sistema paralelo isolado.

**Mapa mental final:**

```
                         Horário de Saída na Prontidão
                                    |
     ┌──────────────┬──────────────┼──────────────┬──────────────┐
  PROPÓSITO      MODELO DE     PREENCHIMENTO    EXIBIÇÃO      INTEGRAÇÃO
                    DADOS         (menu Eu)     (Prontidão)
     |                |               |              |              |
 Risco de         Horário         Toggle         Coluna         Relação com
 Atraso (#1)      semanal +       mesma/dif.     sempre         Relatório de
     |            intervalos      hora (#3)      visível (#5)   Presenças (#7)
 Deslocação       letivos (#6)                        |
 fixa 1h (#2)                                    Indicador
                                                  "falta info"
                                                  + treinador
                                                  pede (#4)
```

**Creative Breakthrough:** O reagrupamento revelou que "Falha Silenciosa" pertence à Exibição (é o treinador quem vê e age), não ao Preenchimento — e que existe um ramo de Integração com funcionalidades já existentes (Presenças) que não tinha sido considerado na Fase 1.

**Developed Ideas:** As 6 ideias da Fase 1 ganharam relações explícitas entre si; surgiu 1 ideia nova (Integração #7).

**User Creative Strengths:** Julgamento rápido e seguro sobre onde cada ideia pertence; identificou uma lacuna estrutural (falta de ligação a funcionalidades existentes) que o facilitador não tinha antecipado.

### Fase 3 — SCAMPER Method

**Interactive Focus:** Passar o conceito consolidado pelas 7 lentes SCAMPER para decidir detalhes práticos de implementação.

**Decisões por lente:**

- **S (Substituir):** Nada a substituir — time picker exato + coluna sempre visível confirmados como certos.
- **C (Combinar):** Badge de risco de atraso fica **separado** do badge "Vai Faltar" já existente na Prontidão.
- **A (Adaptar):** Adaptar o padrão **SemaforoBadge** já existente no SPARTA para o alerta (ver Visual #8).
- **M (Modificar):** Sem margem de tolerância no cálculo; sem lógica de múltiplas sessões por dia — cálculo simples e exato.
- **P (Pôr a Outros Usos):** Expor tendência de risco de atraso nos dashboards de Analista já existentes (ver Analytics #9).
- **E (Eliminar):** Nada eliminado — toggle, intervalos letivos múltiplos e o ramo de analytics entram todos na v1.
- **R (Inverter):** O próprio jogador preenche (sem mediação de encarregado, mesmo para menores); a pergunta mantém-se "hora de saída da escola" (não "hora de chegada ao clube").

**Novas ideias capturadas:**

**[Visual #8]: Semáforo de Risco de Atraso**
_Concept_: Reutiliza o padrão SemaforoBadge já existente no SPARTA — vermelho = atraso certo (saída + 1h > início da sessão), amarelo = risco marginal, sem badge = sem risco.
_Novelty_: Reaproveita um componente e linguagem visual já reconhecida pelos treinadores.

**[Analytics #9]: Padrão de Risco de Atraso ao Longo da Época**
_Concept_: O Analista vê, num dashboard de tendências já existente, quantas vezes e em que dias da semana um jogador teve risco de atraso ao longo da época.
_Novelty_: Reaproveita a infraestrutura de dashboards de tendências já construída (fadiga, carga) em vez de criar algo novo.

**Creative Breakthrough:** O desenho ficou "sem gordura" — quase todas as lentes confirmaram decisões já tomadas em vez de abrir novo scope, exceto Adaptar (semáforo) e Pôr a Outros Usos (analytics), que acrescentaram valor real sem custo de complexidade extra.

**User Creative Strengths:** Decisões de scope muito claras e consistentes ("entra tudo" vs "não vale a pena") — mantém o desenho enxuto e resistente a over-engineering ao longo de toda a técnica.

**Energy Level:** Alta clareza, respostas rápidas e decisivas — sessão claramente orientada para chegar a um desenho implementável.

### Fase 4 — Constraint Mapping

**Interactive Focus:** Mapear restrições reais do SPARTA (dados, GDPR, UI, conceitos existentes, fluxo de trabalho) e converter o desenho em passos de implementação concretos.

**Restrições confirmadas:**

1. **Dados & RLS:** Nova tabela (ex.: `player_school_schedule` + intervalos letivos), seguindo o padrão de isolamento `club_id`/`player_id` + RLS já usado em `player_metrics`, `fatigue_responses`, etc.
2. **GDPR/Privacidade:** Não é dado de saúde — não precisa de `auditedRead()` nem da regra ESLint `no-direct-health-data-read`. É dado operacional normal.
3. **UI:** Reaproveita `SemaforoBadge` para o alerta; formulário segue padrão react-hook-form + Zod já estabelecido.
4. **Época vs Período Letivo:** São conceitos distintos — o calendário escolar não coincide com a época do clube, por isso os intervalos letivos são uma entidade nova, não reaproveitam "Épocas".
5. **Fluxo de implementação:** Encaixa no padrão **Quick Dev** (specs pontuais) que tem sido usado para todo o trabalho recente do SPARTA desde meados de agosto — não precisa de nova epic/story formal.

**Plano de Ação:**

1. Migração SQL: tabela de horário semanal por jogador (Seg-Sex, nullable) + tabela/coluna de intervalos letivos (múltiplos, com data_inicio/data_fim), com RLS por club_id/player_id
2. Server Action de cálculo de risco: `saída + 1h > início_sessão`, só válido dentro de um intervalo letivo ativo; sem margem de tolerância, sem lógica multi-sessão
3. Novo ecrã em "Eu": formulário one-shot com toggle "mesma hora/horas diferentes" + campos para um ou mais intervalos letivos; editável depois (não é bloqueado após o primeiro preenchimento)
4. Novo badge de Risco de Atraso (semáforo: vermelho/amarelo/sem badge) no `PlayerRow` do painel de Prontidão, **separado** do badge "Vai Faltar" existente
5. Indicador discreto "informação em falta" quando o jogador não preencheu — sem notificações automáticas; resolução via contacto humano do treinador
6. Extensão de um dashboard de Analista já existente com a tendência de risco de atraso ao longo da época (dia da semana, frequência)
7. Ligação ao registo/relatório de presenças, para dar contexto quando há atraso efetivo
8. Próximo passo imediato recomendado: escrever uma spec de Quick Dev para esta funcionalidade e seguir o fluxo `bmad-quick-dev`

**Creative Breakthrough:** A restrição mais importante não foi técnica — foi conceptual: perceber que "Período Letivo" ≠ "Época do Clube" evita um erro de modelação de dados que só apareceria mais tarde (jogadores sem época ativa mas com aulas, ou vice-versa).

**Energy and Engagement:** Total clareza e confirmação rápida de todas as restrições propostas — sessão pronta para transitar de ideação para implementação.

## Overall Creative Journey

Sessão compacta e altamente convergente: 9 ideias formalmente capturadas ao longo de 4 fases, mas o valor real esteve nas correções e decisões de scope do utilizador — recusar a suposição de "dado vivo", fixar a deslocação em 1h em vez de geolocalização, distinguir Período Letivo de Época, e manter a resolução de dados em falta como um processo humano em vez de automatizado. O resultado é um desenho enxuto, sem over-engineering, coerente com os padrões já estabelecidos no SPARTA (SemaforoBadge, RLS multi-tenant, dashboards de Analista, fluxo Quick Dev).

### Creative Facilitation Narrative

A sessão seguiu um fluxo progressivo clássico — divergência ampla no What If, organização no Mind Mapping, refinamento no SCAMPER, ancoragem técnica no Constraint Mapping — mas o que a distinguiu foi o ritmo: o utilizador corrigiu suposições erradas cedo (a "hora de saída viva") e manteve disciplina de scope em todas as fases seguintes ("não vale a pena substituir nada", "nenhuma destas hipóteses faz sentido", "entra tudo"). Isso resultou numa sessão mais curta do que o habitual em ideias soltas, mas muito mais alta em decisões prontas a implementar.

### Session Highlights

**User Creative Strengths:** Julgamento de scope rápido e consistente; conhecimento profundo do domínio (relação treinador-jogador, calendário escolar real); capacidade de corrigir o facilitador sem perder o fio à meada.
**AI Facilitation Approach:** Perguntas provocadoras seguidas de escuta ativa às correções do utilizador; propostas concretas (mapas, restrições) para validação rápida em vez de perguntas totalmente abertas, ajustando-se ao estilo pragmático do utilizador.
**Breakthrough Moments:** A descoberta do propósito real (#1, risco de atraso); a distinção Período Letivo vs Época (#6 + restrição #4).
**Energy Flow:** Constante e decisiva do início ao fim, sem quebras de energia — sessão fluiu sem necessidade de pausas.

## Idea Organization and Prioritization

**Organização Temática (do Mind Mapping):**

**Propósito**
- Risco de Atraso (#1) — razão de ser do dado: sinalizar ao treinador que um jogador pode chegar atrasado
- Deslocação fixa de 1h (#2) — simplificação deliberada, sem geolocalização

**Modelo de Dados**
- Horário semanal único + intervalos letivos múltiplos (#6) — conceito novo, distinto de "Época" do clube (restrição #4)

**Preenchimento (menu Eu)**
- Toggle "mesma hora / horas diferentes" (#3)
- One-shot no início da época, editável depois; sempre preenchido pelo próprio jogador (sem mediação de encarregado)

**Exibição (Prontidão)**
- Semáforo de Risco de Atraso (#8), separado do badge "Vai Faltar"
- Coluna/indicador sempre visível (#5), sem lógica condicional
- Indicador discreto "informação em falta", resolvido por contacto humano do treinador (#4)

**Integração**
- Ligação ao registo de presenças (#7)
- Extensão de um dashboard de Analista já existente com o padrão de risco ao longo da época (#9)

**Prioritização:**

O utilizador optou explicitamente por **não cortar escopo** — todas as 9 ideias e decisões entram na primeira versão ("entra tudo"). Não houve necessidade de trade-offs de priorização: a disciplina de scope já foi aplicada durante o SCAMPER (S/M/E), eliminando à partida qualquer ideia dispensável antes de chegar a esta fase.

**Plano de Ação (consolidado da Fase 4 — Constraint Mapping):**

1. Migração SQL: tabela de horário semanal por jogador (Seg-Sex) + tabela de intervalos letivos (múltiplos), com RLS `club_id`/`player_id` seguindo o padrão de `player_metrics`/`fatigue_responses`
2. Server Action de cálculo de risco: `hora_saída + 1h > hora_início_sessão`, válido só dentro de um intervalo letivo ativo
3. Novo ecrã em "Eu": formulário one-shot, toggle mesma/diferentes horas, um ou mais intervalos letivos, editável depois do preenchimento inicial
4. Badge de Risco de Atraso (semáforo, reutilizando `SemaforoBadge`) no `PlayerRow` da Prontidão, separado do badge "Vai Faltar"
5. Indicador "informação em falta" sem notificações automáticas — resolução via contacto humano do treinador
6. Extensão de um dashboard de Analista existente com tendência de risco de atraso por jogador/dia da semana
7. Ligação ao registo de presenças para dar contexto a atrasos reais
8. **Próximo passo imediato:** escrever uma spec de Quick Dev (`bmad-quick-dev`) para esta funcionalidade — é o fluxo que o SPARTA tem usado para todo o trabalho recente pós-Epic 8

## Session Summary and Insights

**Key Achievements:**

- 9 ideias + múltiplas decisões de scope explícitas, organizadas em 5 temas claros
- Desenho tecnicamente ancorado nas restrições reais do SPARTA (RLS, GDPR, componentes existentes, fluxo Quick Dev)
- Plano de ação com 8 passos concretos, sem ambiguidade sobre o que fazer a seguir

**Session Reflections:**

Sessão marcada por alta disciplina de scope do utilizador — cada provocação divergente foi rapidamente ancorada de volta à realidade prática ("não é dado vivo", "não vale a pena substituir nada", "nenhuma destas hipóteses faz sentido"), o que produziu um desenho enxuto em vez de uma lista longa de possibilidades por avaliar depois. O fluxo progressivo funcionou bem para este perfil: divergência controlada seguida de convergência rápida e decisiva.
