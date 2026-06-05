"use client";

import { useEffect, useState } from "react";
import { TrendingDown } from "lucide-react";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { SemaforoBadge } from "@/components/ui/semaforo-badge";
import { TooltipExplain } from "@/components/ui/tooltip-explain";
import { EmptyState } from "@/components/ui/empty-state";
import { DataDrivenDecisionInput } from "@/components/domain/DataDrivenDecisionInput";
import { FatigueChart, FatigueChartSkeleton } from "@/components/domain/FatigueChart";
import { getPlayerDrillDownData } from "@/lib/actions/readiness";
import { logger } from "@/lib/logger";
import type { PlayerReadinessData } from "@/types/supabase";
import type { DrillDownData } from "@/lib/actions/readiness";

const AGE_GROUP_LABEL: Record<string, string> = {
  u14: "Sub-14",
  u15: "Sub-15",
  u17: "Sub-17",
  u19: "Sub-19",
  senior: "Sénior",
};

function formatAcwr(value: number): string {
  return value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface PlayerDrillDownSheetProps {
  snapshot: PlayerReadinessData | null;
  open: boolean;
  onClose: () => void;
}

export function PlayerDrillDownSheet({
  snapshot,
  open,
  onClose,
}: PlayerDrillDownSheetProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [data, setData] = useState<DrillDownData | null>(null);
  const [offline, setOffline] = useState(false);

  // Validate prop contract: if open, snapshot must be non-null
  if (open && !snapshot) {
    logger.error('readiness.drilldown.invalid_state', {
      open,
      snapshot_null: snapshot === null,
    });
  }

  // Fetch drill-down data when sheet opens
  useEffect(() => {
    if (!open || !snapshot) return;

    const controller = new AbortController();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: triggers skeleton immediately before async fetch resolves
    setStatus("loading");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clears stale offline flag before each new fetch attempt
    setOffline(false);

    getPlayerDrillDownData(snapshot.player_id)
      .then((result) => {
        // Check if component is still mounted and snapshot hasn't changed
        if (controller.signal.aborted) return;
        if (result.ok) {
          setData(result.data);
          setOffline(false);
          setStatus("loaded");
        } else {
          setOffline(true);
          setStatus("error");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        logger.error('readiness.drilldown.fetch_failed', {
          player_id: snapshot.player_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        setOffline(true);
        setStatus("error");
      });

    return () => controller.abort();
  }, [open, snapshot?.player_id]);

  // Reset when sheet closes
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clears stale fetch state on sheet close so next open starts clean
      setStatus("idle");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clears stale data on close
      setData(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clears offline flag on close
      setOffline(false);
    }
  }, [open]);

  const playerName = snapshot?.playerName ?? "";
  const escalaoLabel =
    snapshot?.derived_age_group != null
      ? (AGE_GROUP_LABEL[snapshot.derived_age_group] ?? snapshot.derived_age_group)
      : "—";

  const acwrDisplay =
    snapshot?.data_sufficient &&
    snapshot?.acwr != null &&
    snapshot?.acwr_band_lo != null &&
    snapshot?.acwr_band_hi != null
      ? `${formatAcwr(snapshot.acwr)} · banda ${formatAcwr(snapshot.acwr_band_lo)}–${formatAcwr(snapshot.acwr_band_hi)}`
      : null;


  return (
    <DrillDownSheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      {snapshot && (
        <div className="space-y-6">
          {/* Header: close label + player info */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{playerName}</h2>
              <p className="text-sm text-muted-foreground">
                {escalaoLabel}
                {snapshot.primaryPosition ? ` · ${snapshot.primaryPosition}` : ""}
              </p>

              {/* ACWR + banda ou tooltip sem dados */}
              {acwrDisplay != null ? (
                <p
                  className="text-sm font-medium text-foreground"
                  aria-label={`ACWR ${acwrDisplay}`}
                >
                  {acwrDisplay}
                </p>
              ) : (
                <div className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground inline-block">
                  <TooltipExplain
                    term="ACWR"
                    definition="Sem dados suficientes nos últimos 28 dias"
                  />
                </div>
              )}
            </div>

            <SemaforoBadge
              state={snapshot.state}
              size="lg"
            />
          </div>

          {/* Fatigue time series — usa FatigueChart (igual ao plantel: pré/pós + sessões) */}
          <section aria-label={`Série temporal de fadiga de ${playerName}, últimos 28 dias`}>
            <h3 className="mb-3 text-sm font-medium text-foreground">Fadiga — últimos 28 dias</h3>

            {status === "loading" && <FatigueChartSkeleton />}

            {status === "loaded" && data !== null && (
              data.fatigueResponses.length === 0 ? (
                <EmptyState
                  icon={<TrendingDown className="h-8 w-8 text-muted-foreground" />}
                  title="Sem dados de fadiga"
                  description="Sem dados de fadiga nos últimos 28 dias"
                />
              ) : (
                <FatigueChart
                  playerId={snapshot.player_id}
                  playerName={playerName}
                  responses={data.fatigueResponses}
                  sessions={data.sessions}
                />
              )
            )}

            {status === "error" && offline && (
              <p className="text-xs text-muted-foreground">
                Série temporal indisponível offline
              </p>
            )}

            {status === "error" && !offline && (
              <p className="text-xs text-destructive">
                Erro ao carregar série de fadiga
              </p>
            )}
          </section>

          {/* Fatigue survey responses */}
          {status === "loaded" && data != null && (
            <section>
              <h3 className="mb-1 text-sm font-medium text-foreground">Respostas de Fadiga</h3>
              {data.attendanceDenominator === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem sessões agendadas neste período
                </p>
              ) : (
                <p
                  className="text-sm text-muted-foreground"
                  aria-label={`${data.attendanceNumerator} de ${data.attendanceDenominator} sessões nos últimos 28 dias`}
                >
                  {data.attendanceNumerator}/{data.attendanceDenominator} sessões
                </p>
              )}
            </section>
          )}

          {/* Decisão data-driven — Story 5.10 */}
          {snapshot.player_id && (
            <section aria-label="Decisão data-driven">
              <h3 className="mb-2 text-sm font-medium text-foreground">Decisão Data-Driven</h3>
              <DataDrivenDecisionInput
                playerId={snapshot.player_id}
                sessionId={snapshot.session_id}
              />
            </section>
          )}
        </div>
      )}
    </DrillDownSheet>
  );
}
