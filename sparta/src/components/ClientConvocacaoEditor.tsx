"use client";

import { useTransition, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

interface LineupSelection {
  [playerId: string]: "starter" | "bench" | null;
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

  const [concentrationTime, setConcentrationTime] = useState(
    session.concentration_time ?? ""
  );
  const [opponentName, setOpponentName] = useState(
    session.opponent_name ?? ""
  );

  const [selections, setSelections] = useState<LineupSelection>(() => {
    const map: LineupSelection = {};
    existing.forEach((lineup) => {
      if (lineup.role === "starter" || lineup.role === "bench") {
        map[lineup.player_id] = lineup.role;
      }
    });
    return map;
  });

  const [shirtNumbers, setShirtNumbers] = useState<Record<string, number | null>>(() => {
    const map: Record<string, number | null> = {};
    existing.forEach((lineup) => {
      if (lineup.role === "starter") {
        map[lineup.player_id] = lineup.shirt_num ?? null;
      }
    });
    return map;
  });

  const starterCount = Object.values(selections).filter((v) => v === "starter").length;
  const benchCount = Object.values(selections).filter((v) => v === "bench").length;
  const isPending = isSaving || isSending;
  const canSubmit = starterCount === 11 && !readOnly && !isPending;

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

  const starters = useMemo(
    () =>
      Object.entries(selections)
        .filter(([, role]) => role === "starter")
        .map(([playerId]) => ({
          player: playerById.get(playerId),
          shirtNum: shirtNumbers[playerId] ?? null,
        }))
        .filter(
          (entry): entry is { player: PlayerWithConsent; shirtNum: number | null } =>
            entry.player !== undefined
        )
        .sort((a, b) => (a.shirtNum ?? 999) - (b.shirtNum ?? 999)),
    [selections, shirtNumbers, playerById]
  );

  const bench = useMemo(
    () =>
      Object.entries(selections)
        .filter(([, role]) => role === "bench")
        .map(([playerId]) => playerById.get(playerId))
        .filter((player): player is PlayerWithConsent => player !== undefined)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-PT")),
    [selections, playerById]
  );

  function buildPlayers() {
    return Object.entries(selections)
      .filter(([, role]) => role)
      .map(([playerId, role]) => ({
        playerId,
        role: role as "starter" | "bench",
        shirtNum: role === "starter" ? (shirtNumbers[playerId] ?? null) : null,
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
          setError(result.error ?? "Erro ao enviar");
          return;
        }
        router.push(`/sessoes/${session.id}?toast=convocatoria-sent`);
      } catch {
        setError("Erro de comunicação com o servidor");
      }
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Contador sticky */}
      <div className="sticky top-12 bg-card border-b border-border px-4 py-3 sm:px-6 z-40">
        <p aria-live="polite" aria-atomic="true" className="text-sm font-medium text-foreground">
          {starterCount} / 11 titulares · {benchCount} suplentes
        </p>
      </div>

      {/* Resumo da lista de convocados — só-leitura, para consulta rápida sem percorrer
          o plantel todo. Visível para coach (a editar) e analyst (readOnly). */}
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
        {starters.length === 0 && bench.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda sem jogadores seleccionados.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Titulares ({starters.length})
              </p>
              <ul className="space-y-0.5 list-none p-0 m-0">
                {starters.map(({ player, shirtNum }) => (
                  <li key={player.id} className="text-sm text-foreground">
                    <span className="tabular-nums text-muted-foreground mr-2">
                      {shirtNum ?? "—"}
                    </span>
                    {player.full_name}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Suplentes ({bench.length})
              </p>
              <ul className="space-y-0.5 list-none p-0 m-0">
                {bench.map((player) => (
                  <li key={player.id} className="text-sm text-foreground">
                    {player.full_name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
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

      {/* Lista de jogadores por posição */}
      <div className="flex-1">
        {Object.entries(playersByPosition).map(([position, positionPlayers]) => (
          <section key={position} className="border-b border-border">
            <h2 className="sticky top-24 z-30 bg-muted border-b border-border px-4 py-2 sm:px-6 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {position}
            </h2>
            <div>
              {positionPlayers.map((player) => (
                <LineupToggle
                  key={player.id}
                  player={player}
                  selected={selections[player.id] || null}
                  onChange={(role, shirtNum) => {
                    setSelections((prev) => ({ ...prev, [player.id]: role }));
                    if (role === "starter") {
                      setShirtNumbers((prev) => ({ ...prev, [player.id]: shirtNum ?? null }));
                    } else if (role === null) {
                      setShirtNumbers((prev) => {
                        const updated = { ...prev };
                        delete updated[player.id];
                        return updated;
                      });
                    }
                  }}
                  parentalConsentConfirmed={player.parental_consent_status === "confirmed"}
                  disabled={readOnly}
                  shirtNum={shirtNumbers[player.id] ?? null}
                />
              ))}
            </div>
          </section>
        ))}
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
              onClick={handleSend}
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
    </div>
  );
}
