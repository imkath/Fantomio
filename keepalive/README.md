# Keep-alive de Supabase y Brevo

Worker con dos crons:

- Cada 6 horas consulta la base para que el plan gratuito de Supabase no pause
  el proyecto.
- El dia 1 de cada mes envia un correo a hola@fantomio.com (llega al Gmail de
  Kath) para que Brevo no desactive la clave API por 90 dias sin uso. Si un mes
  ese correo no llega, hay que revisar la clave. Ese mismo dia manda un segundo
  correo a hello@nvrkth.com con la clave `nvrkth-contacto` del formulario de
  nvrkth.com, que vive aca porque la cuenta gratis de Cloudflare ya usa sus 5 crons.

```bash
cd keepalive
npx wrangler deploy
npx wrangler secret put SUPABASE_URL       # https://<ref>.supabase.co
npx wrangler secret put SUPABASE_ANON_KEY  # la anon, para el keep-alive
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY  # solo para el latido SMTP: el captcha de Auth no deja pedir recuperaciones con la anon
npx wrangler secret put BREVO_API_KEY      # la misma clave "ghostswap" del sitio
npx wrangler secret put NVRKTH_BREVO_API_KEY  # la clave "nvrkth-contacto" del portafolio
```

Probar a mano: en el panel de Cloudflare, Workers > ghostswap-keepalive > Settings >
Triggers, disparar el cron y revisar los logs. No tiene URL publica (`workers_dev: false`
y sin handler `fetch`), para que nadie de afuera lo pueda llamar.

Se despliega aparte del sitio: no lo toca el workflow de deploy de la raiz.
