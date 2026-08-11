'use client';

/**
 * TodayPageContent — Conteúdo da página /hoje com badge de outbox e botão de sync.
 * Versão client-side que integra o hook useOutboxDrain.
 * Story 4.10: Adiciona feedback visual de respostas e estado "Tudo em dia"
 * Mostra todas as sessões dos próximos 7 dias (não só a mais próxima).
 */

import { Calendar, CheckCircle2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { SessionCard } from '@/components/ui/session-card';
import { TodayOutboxBadge } from '@/components/domain/today-outbox-badge';
import { PlayerNotificationsInbox } from '@/components/domain/player-notifications-inbox';
import type { Session } from '@/lib/schemas/sessions';
import type { PlayerNotificationItem } from '@/lib/actions/player-notifications';

interface TodayPageContentProps {
  upcomingSessions: Session[];
  answeredMap?: Record<string, boolean>;
  recentSession?: Session | null;
  allDoneToday?: boolean;
  userRole: 'player' | 'coach' | 'analyst';
  notifications?: PlayerNotificationItem[];
}

export function TodayPageContent({
  upcomingSessions,
  answeredMap = {},
  recentSession,
  allDoneToday,
  userRole,
  notifications = [],
}: TodayPageContentProps) {
  const hasUpcoming = upcomingSessions.length > 0;

  return (
    <div className="px-4 py-6 sm:px-6 space-y-4">
      {/* Badge de sincronização offline */}
      <TodayOutboxBadge />

      {/* Caso 1: Há sessões nos próximos 7 dias */}
      {hasUpcoming && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Próximos 7 dias
          </h2>
          <div className="space-y-2">
            {upcomingSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                userRole={userRole}
                phase="pre"
                answered={answeredMap[session.id]}
              />
            ))}
          </div>
        </>
      )}

      {/* Caso 2: Sessão recente com post por responder (Story 4.9) */}
      {recentSession && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Sessão recente
          </h2>
          <SessionCard
            session={recentSession}
            userRole={userRole}
            phase="post"
          />
        </>
      )}

      {/* Caso 3: Tudo em dia — sessão recente com ambas as fases respondidas (AC #3, Story 4.10) */}
      {allDoneToday && !hasUpcoming && (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8 text-green-600" />}
          title="Tudo registado"
          description="Questionários desta sessão concluídos."
        />
      )}

      {/* Caso 4: Sem sessões em lado nenhum (existente) */}
      {!hasUpcoming && !recentSession && !allDoneToday && (
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
          title="Sem sessões nos próximos 7 dias"
          description="Não há sessões agendadas para os próximos 7 dias."
        />
      )}

      {/* Secção de notificações — apenas para jogadores */}
      {userRole === 'player' && (
        <PlayerNotificationsInbox items={notifications} />
      )}
    </div>
  );
}
