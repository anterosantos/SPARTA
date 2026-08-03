---
title: 'Corrigir duplicação de offset de fuso horário ao criar/editar sessão'
type: 'bugfix'
created: '2026-08-04'
status: 'done'
route: 'one-shot'
context: []
---

# Corrigir duplicação de offset de fuso horário ao criar/editar sessão

## Intent

**Problem:** No formulário "Nova sessão"/"Editar sessão", `toISOFromLocal` convertia o valor do `<input type="datetime-local">` para ISO assumindo (incorretamente) que o JS interpreta essas strings como UTC, e por isso aplicava `getTimezoneOffset()` por cima de um valor que já tinha sido corretamente interpretado como hora local. No inverno (Lisboa UTC+0) o offset é 0 e o bug não tem efeito visível; no verão (DST, UTC+1) subtrai 1h a mais — uma sessão marcada para as 17:30 ficava guardada e exibida como 16:30.

**Approach:** Remover o ajuste de offset duplicado — `new Date(localStr).toISOString()` já produz o instante UTC correto, porque `new Date("YYYY-MM-DDTHH:mm")` (sem designador de fuso) é interpretado como hora local pela spec ECMA-262. Verificado com `TZ=Europe/Lisbon node`: input `"2026-08-17T17:30"` → correto `2026-08-17T16:30:00.000Z`; código antigo produzia `2026-08-17T15:30:00.000Z`.

## Suggested Review Order

- Root cause e fix — a função `toISOFromLocal` deixa de duplicar o offset.
  [`session-form.tsx:38`](../../sparta/src/app/(staff)/calendario/session-form.tsx#L38)

- Teste de regressão — falha com o código antigo (verificado via `git stash`), confirma round-trip local→ISO sem shift de 1h.
  [`session-form.test.tsx:116`](../../sparta/src/__tests__/components/session-form.test.tsx#L116)
