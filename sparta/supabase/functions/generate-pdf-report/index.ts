// Type stub for Deno runtime — allows import in Node/Vitest without @deno/types package
declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

import { createClient } from '@supabase/supabase-js'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(pdfMake as any).vfs = (pdfFonts as any).vfs

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const SIGNED_URL_SECONDS = 2592000 // 30 dias

interface ReportBody {
  playerId?: unknown
  clubId?: unknown
  generatedBy?: unknown
  scope?: unknown
  periodStart?: unknown
  periodEnd?: unknown
  sharedEmail?: unknown
}

interface FatigueRow {
  recorded_at: string
  muscle_score: number | null
  energy_score: number | null
  sleep_score: number | null
  stress_score: number | null
  mood_score: number | null
}

interface SessionMetricRow {
  session_id: string
  srpe_load: number | null
  sessions: { session_date: string; session_type: string } | null
}

interface MatchEventRow {
  action: string
  zone: string | null
  occurred_at: string
  sessions: { session_date: string } | null
}

interface AttendanceRow {
  status: string
  sessions: { session_date: string; session_type: string } | null
}

interface AcwrMetricRow {
  srpe_load: number | null
  sessions: { session_date: string } | null
}

interface AcwrData {
  acwr: number | null
  acuteLoad: number
  chronicAvgLoad: number
  label: string
}

function computeAcwr(metrics: AcwrMetricRow[], periodEnd: string): AcwrData {
  const endDate = new Date(periodEnd + 'T00:00:00Z')
  const acuteStart = new Date(endDate)
  acuteStart.setUTCDate(acuteStart.getUTCDate() - 7)

  const acuteLoad = metrics
    .filter(r => {
      const d = r.sessions?.session_date
      if (!d) return false
      const date = new Date(d + 'T00:00:00Z')
      return date >= acuteStart && date <= endDate
    })
    .reduce((sum, r) => sum + (r.srpe_load ?? 0), 0)

  const weeklySums: number[] = []
  for (let week = 0; week < 4; week++) {
    const weekEnd = new Date(endDate)
    weekEnd.setUTCDate(weekEnd.getUTCDate() - week * 7)
    const weekStart = new Date(weekEnd)
    weekStart.setUTCDate(weekStart.getUTCDate() - 7)
    const weekSum = metrics
      .filter(r => {
        const d = r.sessions?.session_date
        if (!d) return false
        const date = new Date(d + 'T00:00:00Z')
        return date > weekStart && date <= weekEnd
      })
      .reduce((sum, r) => sum + (r.srpe_load ?? 0), 0)
    weeklySums.push(weekSum)
  }
  const chronicAvgLoad = (weeklySums.reduce((a, b) => a + b, 0)) / 4

  if (chronicAvgLoad === 0) {
    return { acwr: null, acuteLoad, chronicAvgLoad, label: 'Sem dados crónicos' }
  }

  const acwr = acuteLoad / chronicAvgLoad
  let label = 'Óptimo (0.8–1.3)'
  if (acwr < 0.8) label = 'Carga baixa (< 0.8)'
  else if (acwr > 1.3) label = 'Risco elevado (> 1.3)'

  return { acwr, acuteLoad, chronicAvgLoad, label }
}

function formatDate(iso: string): string {
  return iso.substring(0, 10)
}

function buildPdfDoc(
  playerName: string,
  position: string | null,
  ageGroup: string | null,
  scope: string,
  periodStart: string,
  periodEnd: string,
  fatigueRows: FatigueRow[],
  sessionMetrics: SessionMetricRow[],
  matchEvents: MatchEventRow[],
  attendances: AttendanceRow[],
  acwrData: AcwrData,
): object {
  const scopeLabel: Record<string, string> = {
    match: 'Jogos',
    training: 'Treinos',
    period: 'Período',
  }

  const totalSrpe = sessionMetrics.reduce((sum, r) => sum + (r.srpe_load ?? 0), 0)
  const totalPresent = attendances.filter(a => a.status === 'present').length
  const totalAbsent = attendances.filter(a => a.status === 'absent').length

  const fatigueTableBody = [
    ['Data', 'Músculo', 'Energia', 'Sono', 'Stress', 'Humor'],
    ...fatigueRows.map(r => [
      formatDate(r.recorded_at),
      String(r.muscle_score ?? '—'),
      String(r.energy_score ?? '—'),
      String(r.sleep_score ?? '—'),
      String(r.stress_score ?? '—'),
      String(r.mood_score ?? '—'),
    ]),
  ]

  const eventsTableBody = [
    ['Data', 'Acção', 'Zona'],
    ...matchEvents.map(e => [
      formatDate(e.sessions?.session_date ?? e.occurred_at),
      e.action,
      e.zone ?? '—',
    ]),
  ]

  return {
    content: [
      { text: 'SPARTA — Relatório de Jogador', style: 'header' },
      { text: '', margin: [0, 8] },
      {
        columns: [
          { text: `Jogador: ${playerName}`, bold: true },
          { text: `Posição: ${position ?? '—'}` },
          { text: `Escalão: ${ageGroup ?? '—'}` },
        ],
        columnGap: 20,
      },
      {
        columns: [
          { text: `Âmbito: ${scopeLabel[scope] ?? scope}` },
          { text: `Período: ${periodStart} a ${periodEnd}` },
        ],
        columnGap: 20,
        margin: [0, 4],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }], margin: [0, 8] },

      { text: 'Fadiga — Série no Período', style: 'section' },
      fatigueRows.length > 0
        ? {
            table: { headerRows: 1, body: fatigueTableBody },
            layout: 'lightHorizontalLines',
            fontSize: 9,
          }
        : { text: 'Sem respostas de fadiga no período.', italics: true, color: '#737373' },

      { text: 'Carga sRPE — Totais por Sessão', style: 'section' },
      sessionMetrics.length > 0
        ? {
            table: {
              headerRows: 1,
              body: [
                ['Data', 'Tipo', 'sRPE'],
                ...sessionMetrics.map(r => [
                  formatDate(r.sessions?.session_date ?? ''),
                  r.sessions?.session_type ?? '—',
                  String(r.srpe_load ?? '—'),
                ]),
                [{ text: 'Total', bold: true }, '', { text: String(totalSrpe), bold: true }],
              ],
            },
            layout: 'lightHorizontalLines',
            fontSize: 9,
          }
        : { text: 'Sem dados de sRPE no período.', italics: true, color: '#737373' },

      { text: 'ACWR — Índice de Carga', style: 'section' },
      {
        columns: [
          { text: `Carga Aguda (7 dias): ${acwrData.acuteLoad}` },
          { text: `Carga Crónica (4 semanas média): ${Math.round(acwrData.chronicAvgLoad)}` },
          {
            text: `ACWR: ${acwrData.acwr != null ? acwrData.acwr.toFixed(2) : '—'} — ${acwrData.label}`,
            bold: acwrData.acwr != null && acwrData.acwr > 1.3,
          },
        ],
        columnGap: 20,
      },

      { text: 'Eventos em Jogo', style: 'section' },
      matchEvents.length > 0
        ? {
            table: { headerRows: 1, body: eventsTableBody },
            layout: 'lightHorizontalLines',
            fontSize: 9,
          }
        : { text: 'Sem eventos de jogo no período.', italics: true, color: '#737373' },

      { text: 'Presenças', style: 'section' },
      {
        columns: [
          { text: `Presente: ${totalPresent}` },
          { text: `Ausente: ${totalAbsent}` },
          { text: `Total: ${attendances.length}` },
        ],
        columnGap: 20,
      },

      {
        text: `Gerado em ${new Date().toLocaleDateString('pt-PT')} — SPARTA`,
        style: 'footer',
        margin: [0, 24, 0, 0],
      },
    ],
    styles: {
      header: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
      section: { fontSize: 11, bold: true, margin: [0, 12, 0, 4] },
      footer: { fontSize: 8, color: '#A3A3A3', italics: true },
    },
    defaultStyle: { font: 'Roboto', fontSize: 10 },
  }
}

export async function handler(req: Request): Promise<Response> {
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000'
  const corsHeaders = {
    'Access-Control-Allow-Origin': appUrl,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: ReportBody
  try {
    body = await req.json() as ReportBody
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'invalid_json' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const { playerId, clubId, generatedBy, scope, periodStart, periodEnd, sharedEmail } = body

  const periodStartValid = typeof periodStart === 'string' && DATE_PATTERN.test(periodStart)
  const periodEndValid = typeof periodEnd === 'string' && DATE_PATTERN.test(periodEnd)

  if (
    !playerId || typeof playerId !== 'string' || !UUID_PATTERN.test(playerId) ||
    !clubId || typeof clubId !== 'string' || !UUID_PATTERN.test(clubId) ||
    !generatedBy || typeof generatedBy !== 'string' || !UUID_PATTERN.test(generatedBy) ||
    !scope || typeof scope !== 'string' || !['match', 'training', 'period'].includes(scope) ||
    !periodStartValid || !periodEndValid ||
    periodStart > periodEnd
  ) {
    return new Response(
      JSON.stringify({ ok: false, error: 'invalid_params' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  const brevoSenderEmail = Deno.env.get('BREVO_SENDER_EMAIL')

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('[generate-pdf-report] Missing Supabase credentials')
    return new Response(
      JSON.stringify({ ok: false, error: 'internal_error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

  try {
    // Verificar restrição de processamento
    const { data: playerRow } = await supabase
      .from('players')
      .select('full_name, position, age_group, processing_restricted')
      .eq('id', playerId)
      .maybeSingle()

    if ((playerRow?.processing_restricted as boolean | null | undefined) === true) {
      return new Response(
        JSON.stringify({ ok: false, error: 'processing_restricted' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const playerName = playerRow?.full_name ?? playerId
    const position = (playerRow?.position as string | null | undefined) ?? null
    const ageGroup = (playerRow?.age_group as string | null | undefined) ?? null

    // Janela crónica para ACWR: 28 dias antes de periodEnd
    const acwrWindowDate = new Date(periodEnd + 'T00:00:00Z')
    acwrWindowDate.setUTCDate(acwrWindowDate.getUTCDate() - 28)
    const acwrWindowStart = acwrWindowDate.toISOString().substring(0, 10)

    // Buscar dados do período em paralelo
    const [fatigueRes, metricsRes, eventsRes, attendancesRes, acwrMetricsRes] = await Promise.allSettled([
      supabase
        .from('fatigue_responses')
        .select('recorded_at, muscle_score, energy_score, sleep_score, stress_score, mood_score')
        .eq('player_id', playerId)
        .gte('recorded_at', periodStart)
        .lte('recorded_at', periodEnd + 'T23:59:59Z')
        .order('recorded_at'),

      supabase
        .from('session_metrics')
        .select('session_id, srpe_load, sessions!inner(session_date, session_type)')
        .eq('player_id', playerId)
        .eq('sessions.club_id', clubId)
        .gte('sessions.session_date', periodStart)
        .lte('sessions.session_date', periodEnd),

      supabase
        .from('match_events')
        .select('action, zone, occurred_at, sessions!inner(session_date)')
        .eq('player_id', playerId)
        .is('deleted_at', null)
        .gte('occurred_at', periodStart)
        .lte('occurred_at', periodEnd + 'T23:59:59Z'),

      supabase
        .from('attendances')
        .select('status, sessions!inner(session_date, session_type)')
        .eq('player_id', playerId)
        .eq('sessions.club_id', clubId)
        .gte('sessions.session_date', periodStart)
        .lte('sessions.session_date', periodEnd),

      supabase
        .from('session_metrics')
        .select('srpe_load, sessions!inner(session_date)')
        .eq('player_id', playerId)
        .gte('sessions.session_date', acwrWindowStart)
        .lte('sessions.session_date', periodEnd),
    ])

    const fatigueRows: FatigueRow[] = fatigueRes.status === 'fulfilled'
      ? ((fatigueRes.value.data ?? []) as FatigueRow[])
      : []
    const sessionMetrics: SessionMetricRow[] = metricsRes.status === 'fulfilled'
      ? ((metricsRes.value.data ?? []) as unknown as SessionMetricRow[])
      : []
    const matchEvents: MatchEventRow[] = eventsRes.status === 'fulfilled'
      ? ((eventsRes.value.data ?? []) as unknown as MatchEventRow[])
      : []
    const attendances: AttendanceRow[] = attendancesRes.status === 'fulfilled'
      ? ((attendancesRes.value.data ?? []) as unknown as AttendanceRow[])
      : []
    const acwrMetrics: AcwrMetricRow[] = acwrMetricsRes.status === 'fulfilled'
      ? ((acwrMetricsRes.value.data ?? []) as unknown as AcwrMetricRow[])
      : []

    const acwrData = computeAcwr(acwrMetrics, periodEnd)

    // Gerar PDF com timeout de 30s
    const docDefinition = buildPdfDoc(
      playerName, position, ageGroup,
      scope, periodStart, periodEnd,
      fatigueRows, sessionMetrics, matchEvents, attendances, acwrData,
    )

    let pdfBytes: Uint8Array
    try {
      pdfBytes = await Promise.race([
        new Promise<Uint8Array>((resolve, reject) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(pdfMake as any).createPdf(docDefinition).getBuffer((buffer: Buffer) => {
              resolve(new Uint8Array(buffer))
            })
          } catch (e) {
            reject(e)
          }
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('pdf_timeout')), 30000)
        ),
      ])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      console.error('[generate-pdf-report] PDF generation failed:', msg)
      return new Response(
        JSON.stringify({ ok: false, error: msg === 'pdf_timeout' ? 'pdf_timeout' : 'pdf_failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Upload para Storage
    const timestamp = Date.now()
    const filePath = `${clubId}/${playerId}/${timestamp}-${scope}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, pdfBytes, { contentType: 'application/pdf', upsert: false })

    if (uploadError) {
      console.error('[generate-pdf-report] upload failed:', uploadError.message)
      return new Response(
        JSON.stringify({ ok: false, error: 'upload_failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Criar signed URL (30 dias)
    const { data: signedData, error: signError } = await supabase.storage
      .from('reports')
      .createSignedUrl(filePath, SIGNED_URL_SECONDS)

    if (signError || !signedData?.signedUrl) {
      console.error('[generate-pdf-report] signed URL failed:', signError?.message)
      return new Response(
        JSON.stringify({ ok: false, error: 'sign_failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const signedUrl = signedData.signedUrl
    const expiresAt = new Date(Date.now() + SIGNED_URL_SECONDS * 1000).toISOString()

    // Inserir em pdf_reports
    const { data: reportRow, error: insertError } = await supabase
      .from('pdf_reports')
      .insert({
        club_id: clubId,
        player_id: playerId,
        generated_by: generatedBy,
        scope,
        period_start: periodStart,
        period_end: periodEnd,
        file_path: filePath,
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (insertError || !reportRow) {
      console.error('[generate-pdf-report] insert pdf_reports failed:', insertError?.message)
      return new Response(
        JSON.stringify({ ok: false, error: 'db_insert_failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const reportId = reportRow.id as string

    // Audit log — report.generated
    try {
      await supabase.from('audit_logs').insert({
        action: 'report.generated',
        actor_id: generatedBy,
        target_kind: 'player',
        target_id: playerId,
        payload: { generated_by: generatedBy, scope, period_start: periodStart, period_end: periodEnd },
      })
    } catch (auditErr) {
      console.error('[generate-pdf-report] audit log failed:', auditErr)
    }

    // Partilha por email (fire-and-forget)
    if (sharedEmail && typeof sharedEmail === 'string' && sharedEmail.includes('@')) {
      if (brevoApiKey && brevoSenderEmail) {
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
  <p style="font-size:12px;color:#737373;margin-top:24px;">
    Este link expira em 30 dias.
  </p>
</body>
</html>`

        const emailText = `Relatório de ${playerName} — SPARTA\n\nEm anexo, o relatório de ${playerName}. Disponível durante 30 dias:\n\n${signedUrl}`

        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { name: 'SPARTA', email: brevoSenderEmail },
            to: [{ email: sharedEmail }],
            subject: `Relatório de ${playerName} — SPARTA`,
            htmlContent: emailHtml,
            textContent: emailText,
          }),
        })
          .then(async res => {
            if (!res.ok) {
              console.error('[generate-pdf-report] Brevo send failed:', res.status)
              return
            }
            // Update shared_with_email + shared_at apenas quando email entregue com sucesso
            await supabase
              .from('pdf_reports')
              .update({ shared_with_email: sharedEmail, shared_at: new Date().toISOString() })
              .eq('id', reportId)
            await supabase.from('audit_logs').insert({
              action: 'report.shared',
              actor_id: generatedBy,
              target_kind: 'player',
              target_id: playerId,
              payload: { shared_with_email: sharedEmail },
            })
          })
          .catch((e: unknown) => {
            console.error('[generate-pdf-report] Brevo fire-and-forget error:', e)
          })
      } else {
        console.warn('[generate-pdf-report] Brevo credentials missing — skipping email')
      }
    }

    return new Response(
      JSON.stringify({ ok: true, reportId, signedUrl }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (err) {
    console.error('[generate-pdf-report] Unexpected error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: 'internal_error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
}

// Supabase Edge Functions entry point — only active in Deno runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).Deno !== 'undefined') {
  Deno.serve(handler)
}
