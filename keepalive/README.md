# Keep-alive de Supabase y Brevo

Worker con dos crons:

- Cada 6 horas consulta la base para que el plan gratuito de Supabase no pause
  el proyecto.
- El dia 1 de cada mes envia un correo a hola@fantomio.com (llega al Gmail de
  Kath) para que Brevo no desactive la clave API por 90 dias sin uso. Si un mes
  ese correo no llega, hay que revisar la clave.

```bash
cd keepalive
npx wrangler deploy
npx wrangler secret put SUPABASE_URL       # https://<ref>.supabase.co
npx wrangler secret put SUPABASE_ANON_KEY  # la anon, nunca la service_role
npx wrangler secret put BREVO_API_KEY      # la misma clave "ghostswap" del sitio
```

Probar a mano: `curl https://ghostswap-keepalive.<subdominio>.workers.dev/`
devuelve `{"ok":true,"status":200}`.

Se despliega aparte del sitio: no lo toca el workflow de deploy de la raiz.
