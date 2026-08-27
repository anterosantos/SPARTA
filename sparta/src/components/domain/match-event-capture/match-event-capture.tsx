"use client";

import { useState, useEffect, useRef } from "react";
import { RefreshCw, ArrowLeftRight, Flag, Timer, Maximize2, Minimize2 } from "lucide-react";
import {
  useMatchSession,
  useSelectedPlayer,
  useLastActionPolarity,
} from "@/lib/stores/match-session";
import { PlayerGrid } from "./player-grid";
import { ActionList } from "./action-list";
import { ZoneSelectorSheet } from "./zone-selector-sheet";
import { RecentEventsRing } from "./recent-events-ring";
import { SubstitutionSheet } from "./substitution-sheet";
import { MatchTimeRecorders } from "./match-time-recorders";
import { StartingLineupPicker } from "./starting-lineup-picker";
import { PendingBadge } from "@/components/domain/pending-badge";
import { useMatchOutboxDrain } from "@/hooks/useMatchOutboxDrain";
import { closeMatchRecord } from "@/lib/actions/substitutions";
import { getLineupForSession } from "@/lib/actions/lineups";
import type { MatchLineupWithPlayerData } from "@/lib/actions/lineups";
import { cn } from "@/lib/utils";

interface MatchEventCaptureProps {
  sessionId: string;
  scheduledAt: string;
  durationMin: number;
  isWithinEditWindow?: boolean;
}

export function MatchEventCapture({ sessionId, scheduledAt, durationMin, isWithinEditWindow = true }: MatchEventCaptureProps) {
  const selectedPlayer = useSelectedPlayer();
  const lastPolarity = useLastActionPolarity();
  const { clearSelection } = useMatchSession();
  const { pendingCount, isDraining, drain } = useMatchOutboxDrain();
  const [isSubSheetOpen, setIsSubSheetOpen] = useState(false);
  const [showTimeRecorders, setShowTimeRecorders] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Titulares só são escolhidos aqui, no início da captura — não na Convocatória
  // (que agora só define quem está convocado). Enquanto não houver nenhuma linha
  // com role='starter', bloqueia a captura e mostra o StartingLineupPicker.
  const [lineupPhase, setLineupPhase] = useState<"loading" | "needs-starters" | "ready">(
    "loading"
  );
  const [convocados, setConvocados] = useState<MatchLineupWithPlayerData[]>([]);
  const [lineupLoadError, setLineupLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLineup() {
      const result = await getLineupForSession(sessionId);
      if (cancelled) return;
      if (!result.ok) {
        setLineupLoadError("Erro ao carregar convocatória.");
        setLineupPhase("needs-starters");
        return;
      }
      setConvocados(result.data);
      const hasStarters = result.data.some((l) => l.role === "starter");
      setLineupPhase(hasStarters ? "ready" : "needs-starters");
    }
    loadLineup();
    return () => {
      cancelled = true;
    };
    // refreshTrigger também dispara depois de confirmar titulares
  }, [sessionId, refreshTrigger]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  };

  const handleCloseMatch = async () => {
    const confirmed = window.confirm(
      `Encerrar registo de jogo (${durationMin} min)? Os minutos finais serão registados.`
    );
    if (!confirmed) return;
    const result = await closeMatchRecord(sessionId);
    if (!result.ok) {
      setCloseError(result.error.message);
    } else {
      setCloseError(null);
      window.alert(
        `Registo encerrado. ${result.data.updated_count} jogador(es) actualizados.`
      );
    }
  };

  const handleSubstitutionSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const headerBg =
    selectedPlayer && lastPolarity === "negative"
      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
      : selectedPlayer
        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800";

  if (lineupPhase === "loading") {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-slate-50 dark:bg-slate-950">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          A carregar convocatória...
        </span>
      </div>
    );
  }

  if (lineupPhase === "needs-starters") {
    return (
      <div className="flex flex-col w-full h-screen bg-slate-50 dark:bg-slate-950">
        {lineupLoadError && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <p className="text-xs text-red-700 dark:text-red-300">{lineupLoadError}</p>
          </div>
        )}
        <StartingLineupPicker
          sessionId={sessionId}
          convocados={convocados}
          onConfirmed={() => setRefreshTrigger((prev) => prev + 1)}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col w-full h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sticky Header */}
      <div
        className={cn(
          "sticky top-0 z-20 border-b px-4 py-3 flex items-center justify-between gap-3 min-h-[60px]",
          headerBg
        )}
      >
        {selectedPlayer ? (
          <>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {selectedPlayer.name} • nº {selectedPlayer.jersey_number}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                {selectedPlayer.position}
              </div>
            </div>
            <button
              onClick={() => clearSelection()}
              aria-label="Trocar jogador"
              className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </>
        ) : (
          <div className="text-sm text-slate-500 flex-1">
            Selecione um jogador
          </div>
        )}
        <PendingBadge
          count={pendingCount}
          isDraining={isDraining}
          onSyncClick={drain}
          label="eventos por sincronizar"
        />
        <button
          type="button"
          onClick={() => setIsSubSheetOpen(true)}
          aria-label="Abrir registo de substituição"
          className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ArrowLeftRight className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setShowTimeRecorders((v) => !v)}
          aria-label="Registar tempos de jogo"
          aria-expanded={showTimeRecorders}
          className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Timer className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleCloseMatch}
          aria-label="Encerrar registo de jogo"
          className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Flag className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Sair do ecrã completo" : "Ecrã completo"}
          className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>
      {closeError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-xs text-red-700 dark:text-red-300">{closeError}</p>
        </div>
      )}

      {/* Tempos de jogo (T1.5.11) — colapsável */}
      {showTimeRecorders && (
        <div className="border-b border-border p-4">
          <MatchTimeRecorders sessionId={sessionId} durationMin={durationMin} />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {!selectedPlayer ? (
          <PlayerGrid sessionId={sessionId} refreshTrigger={refreshTrigger} />
        ) : (
          <ActionList />
        )}
      </div>

      {/* Recent Events Footer */}
      <RecentEventsRing sessionId={sessionId} isWithinEditWindow={isWithinEditWindow} />

      {/* Zone Selector Modal */}
      <ZoneSelectorSheet sessionId={sessionId} scheduledAt={scheduledAt} durationMin={durationMin} />

      {/* Substitution Sheet */}
      <SubstitutionSheet
        sessionId={sessionId}
        scheduledAt={scheduledAt}
        isOpen={isSubSheetOpen}
        onClose={() => setIsSubSheetOpen(false)}
        onSubstitutionSuccess={handleSubstitutionSuccess}
      />
    </div>
  );
}
