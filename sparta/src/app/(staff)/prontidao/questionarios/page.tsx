/**
 * /prontidao/questionarios — Lista de jogadores para preenchimento do questionário de
 * fadiga pelo staff (spec-staff-mediated-fatigue-questionnaire.md).
 *
 * Rota: /prontidao/questionarios?sessionId=<uuid>
 * Grupo: (staff)
 *
 * Nota sobre searchParams: Next.js 15 usa Promise<SearchParams> — sempre await.
 * Ver AGENTS.md ("This is NOT the Next.js you know").
 */

import Link from "next/link";
import { Check } from "lucide-react";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { getQuestionnaireEntryList } from "@/lib/actions/fatigue-staff";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Questionários Jogadores",
};

// Mesmo padrão de /questionario/[sessionId]/[phase]/page.tsx
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = { sessionId?: string | string[] };

function ErrorState({ message }: { message: string }) {
  return (
    <>
      <StickyHeader title="Questionários Jogadores" backHref="/prontidao" />
      <main id="main-content">
        <div className="px-4 py-6 sm:px-6">
          <p className="text-red-600 font-mono text-sm">{message}</p>
        </div>
      </main>
    </>
  );
}

export default async function QuestionariosListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolved = await searchParams;
  // sessionId pode chegar como string, array (parâmetro repetido) ou undefined — tratar
  // sempre o primeiro valor e nunca chamar .trim() diretamente sobre um array (loopback #2).
  const rawSessionId = Array.isArray(resolved.sessionId)
    ? resolved.sessionId[0]
    : resolved.sessionId;
  const sessionId = (rawSessionId ?? "").trim();

  if (!sessionId || !UUID_REGEX.test(sessionId)) {
    return <ErrorState message="Sessão inválida ou não especificada." />;
  }

  const result = await getQuestionnaireEntryList(sessionId);

  if (!result.ok) {
    return (
      <ErrorState
        message={result.error.message ?? "Erro ao carregar questionários"}
      />
    );
  }

  if (!result.data.requiresQuestionnaire) {
    return (
      <>
        <StickyHeader title="Questionários Jogadores" backHref="/prontidao" />
        <main id="main-content">
          <div className="px-4 py-6 sm:px-6">
            <p className="text-sm text-muted-foreground">
              {result.data.blockedMessage ?? "Esta sessão não tem questionário de fadiga."}
            </p>
          </div>
        </main>
      </>
    );
  }

  const { entries } = result.data;

  return (
    <>
      <StickyHeader title="Questionários Jogadores" backHref="/prontidao" />
      <main id="main-content">
        <div className="px-4 py-6 sm:px-6 flex flex-col gap-3">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sem jogadores nas tuas equipas para esta sessão.
            </p>
          )}

          {entries.map((entry) => (
            <div
              key={entry.playerId}
              className="bg-card rounded-xl shadow-sm border border-border/50 p-4 flex items-center gap-3"
            >
              <div
                className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <span className="text-sm font-bold text-muted-foreground">
                  {entry.jerseyNum != null ? entry.jerseyNum : "—"}
                </span>
              </div>

              <p className="flex-1 min-w-0 font-semibold text-foreground truncate">
                {entry.fullName}
              </p>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/prontidao/questionarios/${entry.playerId}/${sessionId}/pre`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted min-h-[36px]"
                >
                  Pré
                  {entry.answeredPre && (
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-signal-ready/10 text-signal-ready"
                      aria-label="Já respondido"
                    >
                      <Check size={10} />
                    </span>
                  )}
                </Link>
                <Link
                  href={`/prontidao/questionarios/${entry.playerId}/${sessionId}/post`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted min-h-[36px]"
                >
                  Pós
                  {entry.answeredPost && (
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-signal-ready/10 text-signal-ready"
                      aria-label="Já respondido"
                    >
                      <Check size={10} />
                    </span>
                  )}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
