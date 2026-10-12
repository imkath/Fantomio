/* global fetch, Response */
// Mantiene despierto el proyecto de Supabase en el plan gratuito.
//
// Supabase pausa un proyecto que no recibe "a few user requests to the database
// each day over the previous week". El keep-alive anterior (GitHub Actions cada
// 3 dias) no cumplia ese criterio y la base se pauso igual en agosto de 2026.
// Ademas Actions deshabilita los workflows programados tras 60 dias sin
// actividad en el repo, asi que el cron vive aca, donde ya vive el sitio.
//
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, BREVO_API_KEY (wrangler secret put).

async function ping(env) {
  const url = `${env.SUPABASE_URL}/rest/v1/groups?select=id&limit=1`
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  })
  // ponytail: un SELECT real basta como actividad de base de datos. Si aun asi
  // se vuelve a pausar, subir a un INSERT en una tabla heartbeat dedicada.
  return { ok: res.ok, status: res.status, body: res.ok ? '' : await res.text() }
}

// Brevo desactiva toda clave que pase 90 dias sin un envio exitoso, y GhostSwap
// solo manda correos en diciembre. Un correo al mes mantiene viva la clave y, como
// llega al Gmail de Kath via hello@nvrkth.com, si un mes no aparece algo se rompio.
const HEARTBEAT_CRON = '0 13 1 * *'

async function heartbeat(env) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'GhostSwap', email: 'hello@nvrkth.com' },
      to: [{ email: 'hello@nvrkth.com' }],
      subject: 'GhostSwap: el correo sigue funcionando',
      textContent:
        'Envio mensual automatico para que Brevo no desactive la clave de GhostSwap. Si este mes no llego, revisar la clave en app.brevo.com.',
    }),
  })
  if (!res.ok) throw new Error(`latido de Brevo fallo: HTTP ${res.status} ${await res.text()}`)
}

export default {
  async scheduled(event, env) {
    if (event.cron === HEARTBEAT_CRON) return heartbeat(env)
    const r = await ping(env)
    if (!r.ok) throw new Error(`keep-alive fallo: HTTP ${r.status} ${r.body}`)
  },

  // Para probarlo a mano: curl https://<worker>.workers.dev/
  async fetch(request, env) {
    const r = await ping(env)
    return new Response(JSON.stringify(r), {
      status: r.ok ? 200 : 500,
      headers: { 'content-type': 'application/json' },
    })
  },
}
