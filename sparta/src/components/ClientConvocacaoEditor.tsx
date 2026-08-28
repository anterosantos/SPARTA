"use client";

import { useTransition, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LineupToggle } from "@/components/patterns/LineupToggle";
import { submitLineup, sendConvocatoria } from "@/lib/actions/lineups";

export interface Session {
  id: string;
  type: "training" | "match" | "friendly";
  scheduled_at: string;
  duration_min: number;
  concentration_time?: string | null;
  opponent_name?: string | null;
}

export interface PlayerWithConsent {
  id: string;
  full_name: string;
  jersey_num: number;
  positions?: Array<{ position: string; is_primary: boolean }>;
  parental_consent_status?: string;
}

export interface MatchLineup {
  player_id: string;
  role: "starter" | "bench" | "convocado_only";
  shirt_num: number | null;
}

interface ClientConvocacaoEditorProps {
  session: Session;
  existing: MatchLineup[];
  readOnly: boolean;
  playersByPosition: Record<string, PlayerWithConsent[]>;
}

export function ClientConvocacaoEditor({
  session,
  existing,
  readOnly,
  playersByPosition,
}: ClientConvocacaoEditorProps) {
  const router = useRouter();
  const [isSaving, startSaveTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sortMode, setSortMode] = useState<"position" | "name">("position");

  const [concentrationTime, setConcentrationTime] = useState(
    session.concentration_time ?? ""
  );
  const [opponentName, setOpponentName] = useState(
    session.opponent_name ?? ""
  );

  // Convocatória só decide QUEM está convocado — titular/suplente só é escolhido no
  // início da captura de eventos (setStartingLineup). Por isso, qualquer role
  // existente (starter/bench/convocado_only) conta como "convocado" aqui.
  const [convocados, setConvocados] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    existing.forEach((lineup) => {
      map[lineup.player_id] = true;
    });
    return map;
  });

  const [shirtNumbers, setShirtNumbers] = useState<Record<string, number | null>>(() => {
    const map: Record<string, number | null> = {};
    existing.forEach((lineup) => {
      map[lineup.player_id] = lineup.shirt_num ?? null;
    });
    return map;
  });

  const convocadoCount = Object.values(convocados).filter(Boolean).length;
  const isPending = isSaving || isSending;
  const canSubmit = convocadoCount > 0 && !readOnly && !isPending;

  // Lista de convocados (resumo só-leitura) — playersByPosition tem os dados de todos
  // os jogadores do plantel; aqui fazemos o lookup inverso por id para mostrar apenas
  // quem está selecionado, sem obrigar a equipa técnica a percorrer o plantel todo.
  const playerById = useMemo(() => {
    const map = new Map<string, PlayerWithConsent>();
    for (const positionPlayers of Object.values(playersByPosition)) {
      for (const player of positionPlayers) map.set(player.id, player);
    }
    return map;
  }, [playersByPosition]);

  const convocadosList = useMemo(
    () =>
      Object.entries(convocados)
        .filter(([, isIn]) => isIn)
        .map(([playerId]) => ({
          player: playerById.get(playerId),
          shirtNum: shirtNumbers[playerId] ?? null,
        }))
        .filter(
          (entry): entry is { player: PlayerWithConsent; shirtNum: number | null } =>
            entry.player !== undefined
        )
        .sort((a, b) => (a.shirtNum ?? 999) - (b.shirtNum ?? 999)),
    [convocados, shirtNumbers, playerById]
  );

  // Lista alternativa, ordenada por nome (sem separação por posição) — para quem
  // conhece os jogadores pelo nome e não quer percorrer secções por posição.
  const playersByName = useMemo(
    () =>
      Object.values(playersByPosition)
        .flat()
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-PT")),
    [playersByPosition]
  );

  function handleToggleChange(
    player: PlayerWithConsent,
    isConvocado: boolean,
    shirtNum?: number | null
  ) {
    setConvocados((prev) => ({ ...prev, [player.id]: isConvocado }));
    if (isConvocado) {
      setShirtNumbers((prev) => ({ ...prev, [player.id]: shirtNum ?? null }));
    } else {
      setShirtNumbers((prev) => {
        const updated = { ...prev };
        delete updated[player.id];
        return updated;
      });
    }
  }

  function buildPlayers() {
    return Object.entries(convocados)
      .filter(([, isIn]) => isIn)
      .map(([playerId]) => ({
        playerId,
        shirtNum: shirtNumbers[playerId] ?? null,
      }));
  }

  function handleSave() {
    setError(null);
    startSaveTransition(async () => {
      try {
        const result = await submitLineup({
          sessionId: session.id,
          players: buildPlayers(),
          concentrationTime: concentrationTime || null,
          opponentName: opponentName || null,
        });
        if (!result.ok) {
          setError(result.error ?? "Erro ao guardar");
          return;
        }
        router.push(`/sessoes/${session.id}?toast=lineup-saved`);
      } catch {
        setError("Erro de comunicação com o servidor");
      }
    });
  }

  function handleSend() {
    setError(null);
    startSendTransition(async () => {
      try {
        const result = await sendConvocatoria({
          sessionId: session.id,
          players: buildPlayers(),
          concentrationTime: concentrationTime || null,
          opponentName: opponentName || null,
        });
        if (!result.ok) {
          setShowSendConfirm(false);
          setError(result.error ?? "Erro ao enviar");
          return;
        }
        router.push(`/sessoes/${session.id}?toast=convocatoria-sent`);
      } catch {
        setShowSendConfirm(false);
        setError("Erro de comunicação com o servidor");
      }
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Contador sticky */}
      <div className="sticky top-12 bg-card border-b border-border px-4 py-3 sm:px-6 z-40">
        <p aria-live="polite" aria-atomic="true" className="text-sm font-medium text-foreground">
          {convocadoCount} convocados
        </p>
        {convocadoCount > 0 && convocadoCount < 11 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Recomendado pelo menos 11, para depois poder definir os titulares na captura de eventos.
          </p>
        )}
      </div>

      {/* Resumo da lista de convocados — só-leitura, para consulta rápida sem percorrer
          o plantel todo. Visível para coach (a editar) e analyst (readOnly). Sem
          distinção titular/suplente — essa escolha só acontece na captura de eventos. */}
      <section
        aria-labelledby="convocados-summary-heading"
        className="border-b border-border bg-card px-4 py-4 sm:px-6 space-y-3"
      >
        <h2
          id="convocados-summary-heading"
          className="text-sm font-semibold text-foreground"
        >
          Lista de Convocados
        </h2>
        {convocadosList.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda sem jogadores seleccionados.
          </p>
        ) : (
          <ul className="space-y-0.5 list-none p-0 m-0 columns-1 sm:columns-2 gap-4">
            {convocadosList.map(({ player, shirtNum }) => (
              <li key={player.id} className="text-sm text-foreground break-inside-avoid">
                <span className="tabular-nums text-muted-foreground mr-2">
                  {shirtNum ?? "—"}
                </span>
                {player.full_name}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Adversário + Hora de concentração */}
      <div className="border-b border-border bg-background px-4 py-4 sm:px-6 flex flex-col gap-4">
        <div>
          <label
            htmlFor="opponent-name"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Adversário
          </label>
          <input
            id="opponent-name"
            type="text"
            placeholder="Ex: Sporting CP"
            value={opponentName}
            onChange={(e) => setOpponentName(e.target.value)}
            disabled={readOnly}
            maxLength={100}
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label
            htmlFor="concentration-time"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Hora de concentração
          </label>
          <input
            id="concentration-time"
            type="time"
            value={concentrationTime}
            onChange={(e) => setConcentrationTime(e.target.value)}
            disabled={readOnly}
            className="w-36 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Incluída na notificação push enviada aos convocados
          </p>
        </div>
      </div>

      {/* Ordenar por posição ou por nome */}
      <div className="border-b border-border bg-background px-4 py-3 sm:px-6 flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Ordenar por:</span>
        <div role="group" aria-label="Ordenar lista de jogadores" className="flex gap-2">
          <button
            type="button"
            onClick={() => setSortMode("position")}
            aria-pressed={sortMode === "position"}
            className={`min-h-[36px] px-3 rounded-lg border text-sm font-medium ${
              sortMode === "position"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Posição
          </button>
          <button
            type="button"
            onClick={() => setSortMode("name")}
            aria-pressed={sortMode === "name"}
            className={`min-h-[36px] px-3 rounded-lg border text-sm font-medium ${
              sortMode === "name"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Nome
          </button>
        </div>
      </div>

      {/* Lista de jogadores — por posição (secções) ou por nome (lista única) */}
      <div className="flex-1">
        {sortMode === "position" ? (
          Object.entries(playersByPosition).map(([position, positionPlayers]) => (
            <section key={position} className="border-b border-border">
              <h2 className="sticky top-24 z-30 bg-muted border-b border-border px-4 py-2 sm:px-6 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {position}
              </h2>
              <div>
                {positionPlayers.map((player) => (
                  <LineupToggle
                    key={player.id}
                    player={player}
                    selected={convocados[player.id] ?? false}
                    onChange={(isConvocado, shirtNum) =>
                      handleToggleChange(player, isConvocado, shirtNum)
                    }
                    parentalConsentConfirmed={player.parental_consent_status === "confirmed"}
                    disabled={readOnly}
                    shirtNum={shirtNumbers[player.id] ?? null}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div>
            {playersByName.map((player) => (
              <LineupToggle
                key={player.id}
                player={player}
                selected={convocados[player.id] ?? false}
                onChange={(isConvocado, shirtNum) =>
                  handleToggleChange(player, isConvocado, shirtNum)
                }
                parentalConsentConfirmed={player.parental_consent_status === "confirmed"}
                disabled={readOnly}
                shirtNum={shirtNumbers[player.id] ?? null}
              />
            ))}
          </div>
        )}
      </div>

      {/* Erro inline */}
      {error && (
        <div className="border-t border-destructive/30 bg-destructive/10 px-4 py-3 sm:px-6">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Footer — botões de acção */}
      {!readOnly && (
        <div className="border-t border-border bg-background px-4 py-4 sm:px-6 flex flex-col gap-2">
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => setShowSendConfirm(true)}
              disabled={!canSubmit}
              className="flex-1"
            >
              {isSending ? "A enviar..." : "Enviar convocatória"}
            </Button>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={handleSave}
              disabled={!canSubmit}
              className="flex-1"
            >
              {isSaving ? "A guardar..." : "Guardar (só staff)"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.back()}
              disabled={isPending}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {readOnly && (
        <div className="border-t border-border bg-muted px-4 py-4 sm:px-6">
          <p className="text-sm text-foreground font-medium">
            Convocatória fechada após apito final
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Para registar substituições, consulte Epic 6 (futuro)
          </p>
        </div>
      )}

      {/* Confirmação antes de notificar os jogadores — "Guardar (só staff)" nunca os
          notifica; só "Enviar convocatória" o faz, por isso pede confirmação explícita
          com um resumo do que vai ser enviado. */}
      <Dialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar convocatória?</DialogTitle>
            <DialogDescription>
              Os {convocadoCount} jogadores convocados vão ser notificados. Esta ação não
              pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {opponentName && (
              <p className="text-sm text-foreground">
                <span className="font-medium">Adversário:</span> {opponentName}
              </p>
            )}
            <p className="text-sm text-foreground">
              <span className="font-medium">Hora de concentração:</span>{" "}
              {concentrationTime || "não definida"}
            </p>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Convocados ({convocadoCount})
              </p>
              <ul className="max-h-48 overflow-y-auto space-y-0.5 list-none p-0 m-0 columns-1 sm:columns-2 gap-4">
                {convocadosList.map(({ player, shirtNum }) => (
                  <li key={player.id} className="text-sm text-foreground break-inside-avoid">
                    <span className="tabular-nums text-muted-foreground mr-2">
                      {shirtNum ?? "—"}
                    </span>
                    {player.full_name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowSendConfirm(false)}
              disabled={isSending}
            >
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSend} disabled={isSending}>
              {isSending ? "A enviar..." : "Confirmar e enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
