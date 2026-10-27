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

// La clave anon no tiene permisos sobre las tablas (migracion 20261026e), asi que se
// llama a keepalive(): una consulta real a Postgres que no devuelve datos de nadie.
async function ping(env) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/keepalive`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: '{}',
  })
  // ponytail: una consulta real basta como actividad de base de datos. Si aun asi
  // se vuelve a pausar, subir a un INSERT en una tabla heartbeat dedicada.
  return { ok: res.ok, status: res.status, body: res.ok ? '' : await res.text() }
}

// Brevo desactiva toda clave que pase 90 dias sin un envio exitoso, y Fantomio
// solo manda correos en diciembre. Un correo al mes mantiene viva la clave y, como
// llega al Gmail de Kath via hola@fantomio.com, si un mes no aparece algo se rompio.
const HEARTBEAT_CRON = '0 13 1 * *'

async function heartbeat(env) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Fantomio', email: 'hola@fantomio.com' },
      to: [{ email: 'hola@fantomio.com' }],
      subject: 'Fantomio: el correo sigue funcionando',
      textContent:
        'Envio mensual automatico para que Brevo no desactive la clave de Fantomio. Si este mes no llego, revisar la clave en app.brevo.com.',
    }),
  })
  if (!res.ok) throw new Error(`latido de Brevo fallo: HTTP ${res.status} ${await res.text()}`)
}

// Los correos de cuenta (confirmar registro, recuperar contrasena, cambiar correo) salen por
// el SMTP de Brevo configurado en Supabase Auth, con otra clave que tambien muere a los 90
// dias sin uso. Pedir una recuperacion para la cuenta tecnica hello@nvrkth.com (sin grupos)
// la mantiene viva, y el correo "Cambia tu contrasena" que llega cada mes confirma que el
// SMTP sigue funcionando.
async function smtpHeartbeat(env) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'hello@nvrkth.com' }),
  })
  if (!res.ok) throw new Error(`latido SMTP fallo: HTTP ${res.status} ${await res.text()}`)
}

export default {
  async scheduled(event, env) {
    if (event.cron === HEARTBEAT_CRON) {
      await heartbeat(env)
      return smtpHeartbeat(env)
    }
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
