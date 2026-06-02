'use server'

import { requireStaffRole } from '@/lib/actions/auth'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { checkProcessingRestricted } from '@/lib/actions/data-rights'
import { ok, err } from '@/lib/types'
import type { Result, AppError } from '@/lib/types'

export type ReportScope = 'match' | 'training' | 'period'

export interface PdfReport {
  id: string
  scope: ReportScope
  period_start: string
  period_end: string
  generated_at: string
  shared_with_email: string | null
  shared_at: string | null
  expires_at: string
  file_path: string
}

export interface GenerateReportParams {
  scope: ReportScope
  periodStart: string
  periodEnd: string
  sharedEmail?: string
}

export interface GenerateReportResult {
  reportId: string
  signedUrl: string
}

export async function generateReport(
  playerId: string,
  params: GenerateReportParams,
): Promise<Result<GenerateReportResult, AppError>> {
  const authResult = await requireStaffRole()
  if (!authResult.ok) return authResult

  const { userId, clubId } = authResult.data

  const isRestricted = await checkProcessingRestricted(playerId)
  if (isRestricted) {
    return err({
      code: 'processing_restricted',
      message: 'Não é possível gerar relatório — processamento restringido por pedido GDPR.',
    })
  }

  // Verificar que o player pertence ao clube do staff
  const serviceRole = getServiceRoleClient()
  const { data: player } = await serviceRole
    .from('players')
    .select('id, club_id')
    .eq('id', playerId)
    .eq('club_id', clubId)
    .maybeSingle()

  if (!player) {
    return err({ code: 'not_found', message: 'Jogador não encontrado neste clube.' })
  }

  try {
    const { data: fnResult, error: fnError } = await serviceRole.functions.invoke<{
      ok: boolean
      reportId?: string
      signedUrl?: string
      error?: string
    }>('generate-pdf-report', {
      body: {
        playerId,
        clubId,
        generatedBy: userId,
        scope: params.scope,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        sharedEmail: params.sharedEmail ?? null,
      },
    })

    if (fnError) {
      console.error('[reports] generate-pdf-report invocation error:', fnError.message)
      return err({ code: 'edge_function_error', message: 'Falha na geração do relatório.' })
    }

    if (!fnResult?.ok || !fnResult.reportId || !fnResult.signedUrl) {
      return err({ code: fnResult?.error ?? 'unknown', message: 'Falha na geração do relatório.' })
    }

    return ok({ reportId: fnResult.reportId, signedUrl: fnResult.signedUrl })
  } catch (error) {
    console.error('[reports] Unexpected error in generateReport:', error)
    return err({ code: 'internal', message: 'Erro inesperado.' })
  }
}

export async function getPlayerReports(
  playerId: string,
): Promise<Result<PdfReport[], AppError>> {
  if (!playerId) {
    return err({ code: 'validation', message: 'ID de jogador inválido.' })
  }

  const authResult = await requireStaffRole()
  if (!authResult.ok) return authResult

  const { clubId } = authResult.data

  const serviceRole = getServiceRoleClient()
  const { data, error } = await serviceRole
    .from('pdf_reports')
    .select(
      'id, scope, period_start, period_end, generated_at, shared_with_email, shared_at, expires_at, file_path',
    )
    .eq('player_id', playerId)
    .eq('club_id', clubId)
    .order('generated_at', { ascending: false })

  if (error) {
    console.error('[reports] getPlayerReports failed:', error.message)
    return err({ code: 'db_error', message: 'Erro ao carregar relatórios.' })
  }

  return ok((data ?? []) as PdfReport[])
}

export async function revokeReport(
  reportId: string,
): Promise<Result<{ revoked: true }, AppError>> {
  const authResult = await requireStaffRole()
  if (!authResult.ok) return authResult

  const { userId, clubId } = authResult.data

  const serviceRole = getServiceRoleClient()

  // Verificar isolamento: report deve pertencer ao clube do staff
  const { data: report } = await serviceRole
    .from('pdf_reports')
    .select('id, player_id, file_path, club_id')
    .eq('id', reportId)
    .eq('club_id', clubId)
    .maybeSingle()

  if (!report) {
    return err({ code: 'not_found', message: 'Relatório não encontrado.' })
  }

  // Guarda contra dupla revogação — relatório já expirado não necessita de acção
  if (new Date(report.expires_at as string) <= new Date()) {
    return ok({ revoked: true })
  }

  // Remover ficheiro do Storage — se falhar, reportar erro (link assinado permaneceria válido)
  const { error: removeError } = await serviceRole.storage
    .from('reports')
    .remove([report.file_path as string])

  if (removeError) {
    console.error('[reports] storage remove failed:', removeError.message)
    return err({ code: 'storage_error', message: 'Erro ao remover ficheiro do relatório.' })
  }

  // Marcar como revogado (expires_at = now)
  const { error: updateError } = await serviceRole
    .from('pdf_reports')
    .update({ expires_at: new Date().toISOString() })
    .eq('id', reportId)

  if (updateError) {
    console.error('[reports] revokeReport update failed:', updateError.message)
    return err({ code: 'db_error', message: 'Erro ao revogar relatório.' })
  }

  // Audit log
  void serviceRole
    .from('audit_logs')
    .insert({
      club_id: clubId,
      action: 'report.revoked',
      actor_id: userId,
      target_kind: 'player',
      target_id: report.player_id as string,
      payload: { report_id: reportId },
    })
    .then(({ error: auditErr }) => {
      if (auditErr) console.error('[reports] audit log revoke failed:', auditErr.message)
    })

  return ok({ revoked: true })
}

export async function shareReport(
  reportId: string,
  email: string,
): Promise<Result<{ shared: true }, AppError>> {
  const authResult = await requireStaffRole()
  if (!authResult.ok) return authResult

  const { userId, clubId } = authResult.data

  if (!email || !email.includes('@')) {
    return err({ code: 'validation', message: 'Email inválido.' })
  }

  const serviceRole = getServiceRoleClient()

  const { data: report } = await serviceRole
    .from('pdf_reports')
    .select('id, player_id, file_path, club_id, expires_at')
    .eq('id', reportId)
    .eq('club_id', clubId)
    .maybeSingle()

  if (!report) {
    return err({ code: 'not_found', message: 'Relatório não encontrado.' })
  }

  // Gerar nova signed URL se expirada
  const isExpired = new Date(report.expires_at as string) <= new Date()
  let signedUrl: string

  if (isExpired) {
    // Criar nova URL por mais 30 dias e actualizar expires_at
    const { data: signedData, error: signError } = await serviceRole.storage
      .from('reports')
      .createSignedUrl(report.file_path as string, 2592000)

    if (signError || !signedData?.signedUrl) {
      return err({ code: 'sign_failed', message: 'Não foi possível gerar link de download.' })
    }

    signedUrl = signedData.signedUrl
    const newExpiresAt = new Date(Date.now() + 2592000 * 1000).toISOString()

    await serviceRole
      .from('pdf_reports')
      .update({ expires_at: newExpiresAt })
      .eq('id', reportId)
  } else {
    const { data: signedData, error: signError } = await serviceRole.storage
      .from('reports')
      .createSignedUrl(report.file_path as string, 2592000)

    if (signError || !signedData?.signedUrl) {
      return err({ code: 'sign_failed', message: 'Não foi possível gerar link de download.' })
    }

    signedUrl = signedData.signedUrl
    // Actualizar expires_at para alinhar com a nova URL assinada (30 dias)
    const newExpiresAt = new Date(Date.now() + 2592000 * 1000).toISOString()
    await serviceRole
      .from('pdf_reports')
      .update({ expires_at: newExpiresAt })
      .eq('id', reportId)
  }

  // Enviar via Brevo (fetch directo — Server Action pode fazer fetch externo)
  const brevoApiKey = process.env.BREVO_API_KEY
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL

  if (brevoApiKey && brevoSenderEmail) {
    // Buscar nome do jogador
    const { data: playerRow } = await serviceRole
      .from('players')
      .select('full_name')
      .eq('id', report.player_id as string)
      .maybeSingle()
    const playerName = playerRow?.full_name ?? 'jogador'

    const emailHtml = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="UTF-8"><title>Relatório SPARTA</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#171717;">
  <h1 style="font-size:20px;font-weight:600;margin-bottom:16px;">Relatório de ${playerName} — SPARTA</h1>
  <p style="font-size:14px;line-height:1.6;margin-bottom:16px;">
    Em anexo, o relatório de ${playerName}. Disponível durante 30 dias.
  </p>
  <a href="${signedUrl}"
     style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
    Descarregar relatório
  </a>
  <p style="font-size:12px;color:#737373;margin-top:24px;">Este link expira em 30 dias.</p>
</body>
</html>`

    const emailText = `Relatório de ${playerName} — SPARTA\n\nEm anexo, o relatório de ${playerName}. Disponível durante 30 dias:\n\n${signedUrl}`

    try {
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'SPARTA', email: brevoSenderEmail },
          to: [{ email }],
          subject: `Relatório de ${playerName} — SPARTA`,
          htmlContent: emailHtml,
          textContent: emailText,
        }),
      })
      if (!brevoRes.ok) {
        console.error('[reports] Brevo send failed:', brevoRes.status)
      }
    } catch (brevoErr) {
      console.error('[reports] Brevo fetch error:', brevoErr)
    }
  } else {
    console.warn('[reports] Brevo credentials missing — skipping email')
  }

  // Actualizar shared_with_email + shared_at
  const { error: updateError } = await serviceRole
    .from('pdf_reports')
    .update({ shared_with_email: email, shared_at: new Date().toISOString() })
    .eq('id', reportId)

  if (updateError) {
    console.error('[reports] shareReport update failed:', updateError.message)
    return err({ code: 'db_error', message: 'Erro ao actualizar estado de partilha.' })
  }

  // Audit log
  void serviceRole
    .from('audit_logs')
    .insert({
      club_id: clubId,
      action: 'report.shared',
      actor_id: userId,
      target_kind: 'player',
      target_id: report.player_id as string,
      payload: { shared_with_email: email },
    })
    .then(({ error: auditErr }) => {
      if (auditErr) console.error('[reports] audit log share failed:', auditErr.message)
    })

  return ok({ shared: true })
}
