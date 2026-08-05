---
title: 'Remover menu "Épocas" de Configurações + aplicar template de email a "Consentimento registado"'
type: 'feature'
created: '2026-08-05'
status: 'done'
route: 'one-shot'
context: []
---

# Remover menu "Épocas" de Configurações + aplicar template de email a "Consentimento registado"

## Intent

**Problem:** Dois pedidos distintos do mesmo ecrã: (1) o menu "Épocas" em `/configuracoes` deixa de ser necessário como entrada de navegação; (2) o email "Consentimento registado" (enviado ao encarregado assim que confirma o pedido) ainda usava markup simples sem estilo, diferente dos outros três emails de consentimento já com template trabalhado.

**Approach:**
- Removida a entrada "Épocas" do menu de `/configuracoes` (a rota `/configuracoes/epocas` mantém-se, apenas deixa de estar ligada a partir daí). O Manual do Jogador (`/manual-jogador`) mencionava esta opção na secção "Eu" — removida a referência para não ficar desatualizado.
- Criado `consentConfirmedEmailHtml()` em `consent.ts`, seguindo o mesmo estilo visual de `parentalConsentEmailHtml()` (título, botão sólido, rodapé "SPARTA · Gestão desportiva", link de recurso) e usado por `sendConsentConfirmationEmail()`, que passa agora a enviar também `textContent` (só enviava `htmlContent`). Nota: existe uma cópia idêntica (desatualizada) deste template em `supabase/functions/consent-validate/index.ts`, mas essa função está na lista de edge functions ainda por corrigir (`export default` em vez de `Deno.serve`, nunca invocada em produção — ver memória do projeto) — não é a fonte do email realmente recebido, por isso não foi tocada.

## Suggested Review Order

- Remoção do menu "Épocas".
  [`configuracoes/page.tsx`](../../sparta/src/app/configuracoes/page.tsx)

- Referência correspondente removida do manual do jogador.
  [`manual-jogador/content.ts`](../../sparta/src/app/manual-jogador/content.ts)

- Novo template do email "Consentimento registado" + uso do `textContent`.
  [`consent.ts:97`](../../sparta/src/lib/actions/consent.ts#L97)

- Teste de conteúdo do novo template (nome do jogador, botão, rodapé).
  [`consent.test.ts`](../../sparta/src/__tests__/lib/actions/consent.test.ts)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/lib/actions/consent.test.ts src/__tests__/app/manual-jogador` -- expected: 17 testes a passar
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois (efeito colateral do build)
