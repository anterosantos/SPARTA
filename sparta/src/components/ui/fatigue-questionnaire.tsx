"use client";

/**
 * FatigueQuestionnaire — Questionário de fadiga com 5 sliders (Story 4.2)
 *
 * - Mostra todas as 5 dimensões numa única vista (AC #2)
 * - Autosave em IndexedDB (db.cache) com debounce 800ms (AC #3)
 * - Restaura draft ao montar (AC #3)
 * - Slider sRPE opcional apenas na fase post (AC #5)
 * - Botão "Submeter" desactivado até todas as 5 dimensões estarem preenchidas (AC #4)
 * - Redireccionamento para /hoje após confirmação (AC #4)
 *
 * Story 4.4 substituirá a chamada directa a submitFatigueResponse por uma
 * entrada no outbox (offline-first). Não alterar esta lógica até essa story.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/outbox/db";
import { newId } from "@/lib/uuid";
import { submitFatigueResponse, submitFatigueResponseByStaff } from "@/lib/actions/fatigue";
import { declarePlayerAbsence, cancelPlayerAbsence } from "@/lib/actions/player-attendance";
import { enqueueFatigueSubmit } from "@/lib/outbox/enqueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { FatigueEmojiPicker } from "@/components/ui/fatigue-emoji-picker";
import { FatigueSlider } from "@/components/ui/fatigue-slider";
import { getFatigueCopy } from "@/lib/i18n/pt-PT/fatigue";
import { BodyDiagram } from "@/components/domain/body-diagram";
import { ExamsToggle } from "@/components/domain/exams-toggle";
import { AttendanceToggle } from "@/components/domain/attendance-toggle";
import type { MusclePainZone } from "@/lib/schemas/fatigue";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FatigueQuestionnaireProps {
  sessionId: string;
  sessionType: "training" | "match" | "friendly" | "lecture" | "medical" | "other";
  /** ISO string — é formatada em PT-PT */
  sessionDate: string;
  phase: "pre" | "post";
  playerId: string;
  /**
   * Grupo etário do jogador — controla adaptação linguística (Story 4.3, UX-DR32).
   * "u14" | "u15" → versão simplificada sub-14; qualquer outro valor → versão senior.
   * Default: "senior" (para não quebrar testes e chamadas existentes sem esta prop).
   */
  ageGroup?: "senior" | "u14";
  /** Estado de presença já registado (fase pre) — pré-marca o toggle de ausência. Default: false. */
  initialAbsent?: boolean;
  /**
   * Modo de submissão (spec-staff-mediated-fatigue-questionnaire.md).
   * "self" (default) — o próprio jogador, comportamento inalterado.
   * "staff" — treinador a preencher em nome de um jogador: esconde o toggle de ausência,
   * não chama declarePlayerAbsence/cancelPlayerAbsence, submete via submitFatigueResponseByStaff,
   * e não usa o outbox offline (mostra erro inline se !navigator.onLine).
   */
  mode?: "self" | "staff";
  /** Rota para onde navegar ao dispensar a confirmação. Default: "/hoje". */
  redirectOnDismiss?: string;
  /**
   * Valores já existentes na BD para pré-preencher o formulário em caso de edição
   * (staff reabre uma fase já respondida). Quando fornecido, têm SEMPRE prioridade
   * sobre um eventual draft local em IndexedDB para a mesma chave (loopback #2 — nunca
   * deixar um rascunho antigo/abandonado sobrepor-se à resposta real da BD).
   */
  initialValues?: Partial<
    Pick<
      DraftValues,
      | "dim_energy"
      | "dim_focus"
      | "dim_sleep"
      | "dim_soreness"
      | "dim_mood"
      | "srpe_value"
      | "muscle_pain_zones"
      | "has_exams_this_week"
    >
  >;
}

interface DraftValues {
  id: string;
  dim_energy: number | null;
  dim_focus: number | null;
  dim_sleep: number | null;
  dim_soreness: number | null;
  dim_mood: number | null;
  srpe_value: number | null;
  // Sprint 1.5 (T1.5.9)
  muscle_pain_zones: MusclePainZone[] | null;
  has_exams_this_week: boolean | null;
  // Presença — apenas fase pre. true = jogador declarou que não vai à sessão.
  is_absent: boolean;
}

// Schema para validar draft restaurado de IndexedDB
const DraftValuesSchema = z.object({
  id: z.string().min(1),
  dim_energy: z.number().int().min(1).max(5).nullable(),
  dim_focus: z.number().int().min(1).max(5).nullable(),
  dim_sleep: z.number().int().min(1).max(5).nullable(),
  dim_soreness: z.number().int().min(1).max(5).nullable(),
  dim_mood: z.number().int().min(1).max(5).nullable(),
  srpe_value: z.number().int().min(1).max(10).nullable(),
  muscle_pain_zones: z.array(z.string()).nullable().optional().transform((v) => v ?? null),
  has_exams_this_week: z.boolean().nullable().optional().transform((v) => v ?? null),
  is_absent: z.boolean().optional().transform((v) => v ?? false),
});

// ─── Configuração das dimensões (Story 4.3: substituída por getFatigueCopy) ───
// A constante DIMENSIONS foi removida em Story 4.3.
// As dimensões e labels vêm agora de @/lib/i18n/pt-PT/fatigue via getFatigueCopy(ageGroup).

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSessionType(type: "training" | "match" | "friendly" | "lecture" | "medical" | "other"): string {
  const map: Record<typeof type, string> = {
    training: "Treino",
    match: "Jogo",
    friendly: "Jogo amigável",
    lecture: "Palestra",
    medical: "Médico/Fisio",
    other: "Outros",
  };
  return map[type];
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function FatigueQuestionnaire({
  sessionId,
  sessionType,
  sessionDate,
  phase,
  playerId,
  ageGroup = "senior",
  initialAbsent = false,
  mode = "self",
  redirectOnDismiss = "/hoje",
  initialValues,
}: FatigueQuestionnaireProps) {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();

  // Copy adaptado ao grupo etário (Story 4.3)
  const copy = getFatigueCopy(ageGroup);

  const draftKey = `draft:questionnaire:${sessionId}:${phase}:${playerId}`;

  // Estado inicial: quando initialValues é fornecido (edição de resposta já existente,
  // vinda da BD), semeia o estado directamente via lazy initializer — SEM passar por um
  // setState assíncrono dentro de um efeito. Isto garante, por construção, que initialValues
  // tem SEMPRE prioridade sobre um eventual draft local em IndexedDB para a mesma chave
  // (loopback #2 — nunca deixar um rascunho antigo/abandonado sobrepor-se silenciosamente
  // à resposta real da BD). Quando initialValues não é fornecido (caso normal self-serve,
  // ou staff a abrir uma fase nunca respondida), o restauro de draft continua a acontecer
  // no efeito de montagem abaixo, exactamente como antes.
  const [values, setValues] = useState<DraftValues>(() => {
    if (initialValues) {
      return {
        id: newId(),
        dim_energy: initialValues.dim_energy ?? null,
        dim_focus: initialValues.dim_focus ?? null,
        dim_sleep: initialValues.dim_sleep ?? null,
        dim_soreness: initialValues.dim_soreness ?? null,
        dim_mood: initialValues.dim_mood ?? null,
        srpe_value: initialValues.srpe_value ?? null,
        muscle_pain_zones: initialValues.muscle_pain_zones ?? null,
        has_exams_this_week: initialValues.has_exams_this_week ?? null,
        is_absent: initialAbsent,
      };
    }
    return {
      id: "",
      dim_energy: null,
      dim_focus: null,
      dim_sleep: null,
      dim_soreness: null,
      dim_mood: null,
      srpe_value: null,
      muscle_pain_zones: null,
      has_exams_this_week: null,
      is_absent: false,
    };
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // ─── Mount: restaurar draft ou gerar id novo ─────────────────────────────
  // Só corre quando initialValues NÃO foi fornecido — nesse caso o estado já foi
  // semeado directamente acima (lazy initializer), sem tocar em IndexedDB.

  useEffect(() => {
    if (initialValues) return;

    let cancelled = false;
    db.cache.get(draftKey).then((entry) => {
      if (cancelled) return;
      if (entry?.payload) {
        // Validar payload antes de restaurar
        const validated = DraftValuesSchema.safeParse(entry.payload);
        if (validated.success) {
          setValues({
            ...validated.data,
            muscle_pain_zones: (validated.data.muscle_pain_zones as MusclePainZone[] | null) ?? null,
            has_exams_this_week: validated.data.has_exams_this_week ?? null,
          });
        } else {
          // Payload corrompido — gerar novo id
          setValues((prev) => ({ ...prev, id: newId(), is_absent: initialAbsent }));
        }
      } else {
        setValues((prev) => ({ ...prev, id: newId(), is_absent: initialAbsent }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey, initialAbsent, initialValues]);

  // ─── Autosave: debounce 800ms ────────────────────────────────────────────
  // Desativado em modo staff: dados de bem-estar de outro jogador nunca devem persistir
  // localmente num dispositivo do staff (potencialmente partilhado) — loopback #3.

  useEffect(() => {
    if (mode === "staff") return;
    if (!values.id) return; // aguardar mount
    const timer = setTimeout(() => {
      db.cache.put({
        key: draftKey,
        payload: values,
        updatedAt: new Date().toISOString(),
      }).catch((err) => {
        // Quota exceeded or other IndexedDB error — log silently
        // (user can still submit online; draft will be cleared on success)
        console.warn("[autosave] IndexedDB write failed:", err);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [values, draftKey, mode]);

  // ─── Handler de slider ───────────────────────────────────────────────────

  const handleChange = (key: keyof Omit<DraftValues, "id">, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Guard de submissão ──────────────────────────────────────────────────

  const allSet = [
    values.dim_energy,
    values.dim_focus,
    values.dim_sleep,
    values.dim_soreness,
    values.dim_mood,
  ].every((v) => v !== null);

  // ─── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (isSubmitting || !allSet) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // Re-verificar isOnline (pode ter mudado entre clique e execução)
      const currentOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;

      if (!currentOnline) {
        if (mode === "staff") {
          // Modo staff: sem submissão offline via outbox — erro claro em vez de enfileirar
          // (spec-staff-mediated-fatigue-questionnaire.md — "Ask First" resolvido: nunca
          // enfileirar em nome de outro jogador sem confirmação online do próprio staff).
          setError(
            "Sem ligação à internet. Não é possível submeter em nome do jogador agora — tenta novamente quando tiveres rede."
          );
          setIsSubmitting(false);
          return;
        }

        // Modo offline — enfileirar no outbox (Story 4.4)
        await enqueueFatigueSubmit({
          player_id: playerId,
          session_id: sessionId,
          phase,
          dim_energy: values.dim_energy as number,
          dim_focus: values.dim_focus as number,
          dim_sleep: values.dim_sleep as number,
          dim_soreness: values.dim_soreness as number,
          dim_mood: values.dim_mood as number,
          srpe_value: phase === "post" ? (values.srpe_value ?? null) : null,
          muscle_pain_zones: phase === "post" ? (values.muscle_pain_zones ?? null) : null,
          has_exams_this_week: phase === "pre" ? (values.has_exams_this_week ?? null) : null,
        });

        // Limpar draft após enqueue bem-sucedido
        try {
          await db.cache.delete(draftKey);
        } catch (cacheErr) {
          // Mostrar erro ao user em vez de log silencioso (evita resubmissão duplicada)
          setError("Falha ao limpar draft. Por favor, recarregue a página.");
          setIsSubmitting(false);
          return;
        }

        // Usar mensagem offline específica (AC #1, Story 4.4)
        setConfirmationMessage("Em modo offline. Os teus dados estão seguros e vão ser enviados quando voltares a ter rede.");
        setShowConfirmation(true);
      } else {
        // Modo online — submeter directo ao servidor (self-serve ou staff-mediado)
        const submitPayload = {
          id: values.id,
          player_id: playerId,
          session_id: sessionId,
          phase,
          dim_energy: values.dim_energy as number,
          dim_focus: values.dim_focus as number,
          dim_sleep: values.dim_sleep as number,
          dim_soreness: values.dim_soreness as number,
          dim_mood: values.dim_mood as number,
          srpe_value: phase === "post" ? (values.srpe_value ?? null) : null,
          muscle_pain_zones: phase === "post" ? (values.muscle_pain_zones ?? null) : null,
          has_exams_this_week: phase === "pre" ? (values.has_exams_this_week ?? null) : null,
          submitted_via: "online" as const,
        };

        const result =
          mode === "staff"
            ? await submitFatigueResponseByStaff(submitPayload)
            : await submitFatigueResponse(submitPayload);

        if (result.ok) {
          try {
            await db.cache.delete(draftKey);
          } catch (cacheErr) {
            // Mostrar erro ao user em vez de log silencioso
            setError("Falha ao limpar draft. Por favor, recarregue a página.");
            setIsSubmitting(false);
            return;
          }

          // Sincronizar presença — só na fase pre, e apenas em modo self-serve.
          // Em modo staff, a ausência é gerida exclusivamente via o ecrã de presenças
          // existente — nunca chamar declarePlayerAbsence/cancelPlayerAbsence aqui.
          // Falha aqui não bloqueia a confirmação: o questionário já foi gravado.
          if (phase === "pre" && mode === "self") {
            try {
              if (values.is_absent) {
                await declarePlayerAbsence({ session_id: sessionId });
                setConfirmationMessage(
                  "Questionário registado. Ausência assinalada para esta sessão — o staff foi notificado."
                );
              } else {
                await cancelPlayerAbsence({ session_id: sessionId });
              }
            } catch (attendanceErr) {
              console.warn("[fatigue-questionnaire] Falha ao atualizar presença:", attendanceErr);
            }
          }

          // Usar mensagem do i18n para online submission
          setShowConfirmation(true);
        } else {
          setError(result.error.message ?? "Erro ao submeter questionário");
          setIsSubmitting(false);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao submeter questionário";
      setError(errorMsg);
      setIsSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const sessionLabel = `${formatSessionType(sessionType)} ${formatDate(sessionDate)}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">
        Questionário — {sessionLabel}
      </h1>

      {/* Help text sub-14 — só quando existe (AC #3) */}
      {copy.helpText && (
        <p className="text-sm text-[var(--color-ink-2,theme(colors.gray.600))]">
          {copy.helpText}
        </p>
      )}

      {/* Presença — só na fase pre e em modo self-serve. Em modo staff, a ausência é
          gerida exclusivamente via o ecrã de presenças existente. Responder "Não" não
          impede o preenchimento deste questionário. */}
      {phase === "pre" && mode === "self" && (
        <AttendanceToggle
          checked={values.is_absent}
          onChange={(v) => setValues((prev) => ({ ...prev, is_absent: v }))}
          disabled={isSubmitting}
        />
      )}

      {/* 5 dimensões com emoji picker — copy vem do i18n (Story 4.3) */}
      <div className="flex flex-col gap-6">
        {copy.dimensions.map((dim) => (
          <FatigueEmojiPicker
            key={dim.key}
            id={`picker-${dim.key}`}
            dimKey={dim.key}
            label={dim.label}
            emojis={dim.emojis}
            value={values[dim.key]}
            onChange={(v) => handleChange(dim.key, v)}
            disabled={isSubmitting}
          />
        ))}

        {/* sRPE — só na fase post (AC #5) */}
        {phase === "post" && (
          <FatigueSlider
            id="slider-srpe"
            label="Esforço percebido da sessão (sRPE)"
            minLabel="Muito fácil"
            maxLabel="Máximo esforço"
            min={1}
            max={10}
            value={values.srpe_value}
            onChange={(v) => handleChange("srpe_value", v)}
            disabled={isSubmitting}
          />
        )}

        {/* Dores musculares — só na fase post (FR21b, T1.5.6) */}
        {phase === "post" && (
          <BodyDiagram
            selected={values.muscle_pain_zones ?? []}
            onChange={(zones) =>
              setValues((prev) => ({ ...prev, muscle_pain_zones: zones.length > 0 ? zones : null }))
            }
            disabled={isSubmitting}
          />
        )}

        {/* Testes/exames — só na fase pre (FR21c, T1.5.8) */}
        {phase === "pre" && (
          <ExamsToggle
            value={values.has_exams_this_week}
            onChange={(v) =>
              setValues((prev) => ({ ...prev, has_exams_this_week: v }))
            }
            disabled={isSubmitting}
            ageGroup={ageGroup}
          />
        )}
      </div>

      {/* Mensagem de erro */}
      {error && (
        <p role="alert" className="text-sm text-[var(--signal-alert-ink,theme(colors.red.600))]">
          {error}
        </p>
      )}

      {/* Botão Submeter — copy adaptado ao grupo etário (AC #2, Story 4.3) */}
      <button
        type="button"
        disabled={!allSet || isSubmitting}
        onClick={() => void handleSubmit()}
        className="min-h-[44px] min-w-[44px] w-full rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? copy.submittingLabel : copy.submitLabel}
      </button>

      {/* Confirmação (AC #4) — uso de confirmationMessage dinâmica para offline */}
      {showConfirmation && (
        <CalmConfirmation
          message={confirmationMessage || copy.confirmationMessage}
          onDismiss={() => {
            void (async () => {
              try {
                await router.push(redirectOnDismiss);
              } catch (err) {
                console.error(`[navigation] Failed to navigate to ${redirectOnDismiss}:`, err);
                // Fallback: reload page
                window.location.href = redirectOnDismiss;
              }
            })();
          }}
        />
      )}
    </div>
  );
}
