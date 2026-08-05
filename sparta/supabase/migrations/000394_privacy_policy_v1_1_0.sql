-- Migration: 000394_privacy_policy_v1_1_0
-- Purpose: New privacy policy version replacing "clube" with "equipa técnica"
-- in the "who sees your data" sections, per product decision 2026-08-05.
-- Inserts a new row rather than editing 1.0.0 in place — preserves the
-- historical record of what titulares/encarregados consented to under the
-- previous wording (Story 3.1 versioning design). The existing
-- ensure_single_current_policy trigger flips 1.0.0's is_current to false.

INSERT INTO public.privacy_policies (version, effective_from, body_full_md, body_u14_md, is_current)
VALUES (
  '1.1.0',
  '2026-08-05',
  $body_full$
## Política de Privacidade

**Versão 1.1.0 — em vigor desde 5 de agosto de 2026**

### O que são os teus dados?

Os teus dados pessoais são informações que te identificam.
Nesta aplicação, recolhemos o teu nome, email e métricas físicas como peso e altura.
Recolhemos também informações sobre o teu estado físico antes e depois dos treinos.

### Porquê usamos os teus dados?

Usamos os teus dados para apoiar a gestão do teu desempenho desportivo.
O teu treinador e analista usam estes dados para tomar decisões de treino.
Nunca vendemos os teus dados a terceiros.

### Quem vê os teus dados?

O treinador e o analista da tua equipa técnica têm acesso aos teus dados.
Ninguém fora da tua equipa técnica pode ver as tuas informações.
Os dados são armazenados em servidores seguros na União Europeia.

### Os teus direitos

Tens o direito de:
- Pedir uma cópia dos teus dados (exportação CSV)
- Pedir que apaguemos os teus dados
- Pedir a correção de dados incorretos
- Limitar o uso dos teus dados
- Retirar o teu consentimento a qualquer momento

Para exercer estes direitos, vai a **Definições → Os meus direitos**.

### Segurança

Usamos encriptação em todos os dados de saúde.
Armazenamos os teus dados em servidores na União Europeia.
Fazemos cópias de segurança semanais dos dados.

### Contacto

Para questões sobre privacidade, fala com a tua equipa técnica.
  $body_full$,
  $body_u14$
## A tua privacidade

**Versão simplificada para jovens atletas**

Esta aplicação guarda dados pessoais teus para ajudar o teu treinador.
Seguimos o RGPD, a lei europeia que protege os teus dados.

### O que guardamos?

- O teu nome e email
- O teu peso e altura
- Como te sentiste antes e depois dos treinos

### Quem vê os dados?

Só o treinador e o analista da tua equipa técnica.
Mais ninguém fora da equipa técnica pode ver as tuas informações.

### Os teus direitos

Podes pedir para:
- Ver os teus dados
- Apagar os teus dados
- Corrigir dados errados

Fala com o teu encarregado de educação para usar estes direitos.

### Glossário

- **RGPD** — A lei europeia que protege os teus dados pessoais
- **Dados pessoais** — Coisas que te identificam, como o teu nome ou email
- **Consentimento** — Quando o teu encarregado de educação disse "sim" para guardarmos os teus dados
  $body_u14$,
  true
);
