---
title: 'Manual do Jogador (página pública)'
type: 'feature'
created: '2026-08-05'
status: 'done'
route: 'one-shot'
context: []
---

# Manual do Jogador (página pública)

## Intent

**Problem:** Não existia documentação de apoio ao jogador sobre como usar a app — o que cada ecrã mostra, como funciona o questionário de bem-estar, como instalar a app, e onde exercer os direitos RGPD.

**Approach:** Nova página `/manual-jogador`, fora de qualquer grupo de rotas autenticado, seguindo exatamente o padrão já usado por `/politica-privacidade` (Server Component com `metadata`, conteúdo markdown delegado a um wrapper `"use client"` com `react-markdown`) — por isso renderiza estática, sem autenticação. Conteúdo verificado contra o código real de cada ecrã (Hoje, Agenda, Questionário, Histórico, Eu) via investigação prévia, não inventado.

## Suggested Review Order

- Página pública, mesmo padrão do `/politica-privacidade`.
  [`page.tsx`](../../sparta/src/app/manual-jogador/page.tsx)
- Conteúdo do manual (markdown estático).
  [`content.ts`](../../sparta/src/app/manual-jogador/content.ts)
- Wrapper de renderização markdown.
  [`manual-content.tsx`](../../sparta/src/app/manual-jogador/manual-content.tsx)
- Fix relacionado: `/configuracoes/direitos` (hub RGPD) não tinha nenhuma entrada de navegação a partir do menu principal — só existiam links de volta a partir das suas subpáginas. Como o manual instrui o jogador a ir a "Eu → Os meus direitos", isto tinha de ser corrigido para o manual não ficar incorreto. Adicionada também a entrada "Manual do jogador".
  [`configuracoes/page.tsx:39`](../../sparta/src/app/configuracoes/page.tsx#L39)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/app/manual-jogador/page.test.tsx` -- expected: 2 testes a passar
- `cd sparta && npm run build` -- expected: `/manual-jogador` aparece como rota estática (○), sem autenticação
