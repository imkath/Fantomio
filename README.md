# 👻 GhostSwap

**Organiza tu Amigo Secreto online gratis: sorteo automático, listas de deseos y mensajes anónimos.**

[![Deploy](https://github.com/imkath/GhostSwap/actions/workflows/deploy.yml/badge.svg)](https://github.com/imkath/GhostSwap/actions/workflows/deploy.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)

👉 **[ghostswap.nvrkth.com](https://ghostswap.nvrkth.com)**

---

## ✨ Características

- 🎲 **Sorteo automático** dentro de la base de datos: nadie se saca a sí mismo y se respetan las exclusiones
- 👥 **Grupos ilimitados**, con invitación por link o código
- 🎁 **Lista de deseos** de hasta 10 cosas por persona, con links. Solo la ves tú y, después del sorteo, quien te regala
- 🚫 **Exclusiones** (por ejemplo, parejas que no se regalan entre sí)
- 💬 **Mensajes anónimos** para preguntarle cosas a tu amigo secreto sin que sepa que eres tú
- 🔔 **Avisos** en la app y por correo: sorteo hecho, preguntas, respuestas y cambios en la lista de tu amigo secreto
- 💰 **9 monedas** (CLP, USD, EUR, MXN, ARS, COP, PEN, BRL, GBP) y fecha del intercambio
- 🌗 Tema claro y oscuro según la preferencia del sistema, o el que elijas en tu cuenta
- 👤 **Mi cuenta**: nombre y foto, correo, contraseña, conectar o desconectar Google, unir dos
  cuentas tuyas, avisos por correo, cerrar sesión en todos lados, descargar tus datos y eliminar
  la cuenta

---

## 🔐 Privacidad y seguridad

El sitio es estático: no hay servidor propio. Todas las consultas salen del navegador con la sesión
de cada persona, así que **la privacidad la garantizan las políticas de Row Level Security de
Postgres**, no el código de la interfaz. Lo que cada uno puede leer:

| Dato                     | Quién lo puede leer                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------- |
| A quién le regalas       | Solo tú. Ni quien organiza ve las asignaciones de los demás                         |
| Tu lista de deseos       | Tú y, después del sorteo, la persona que te regala                                  |
| Si ya anotaste tu lista  | Los miembros de tu grupo (un sí o no, sin el contenido)                             |
| Tu nombre, correo y foto | Tú y quienes comparten un grupo contigo                                             |
| Mensajes anónimos        | Las dos personas del emparejamiento; quien recibe la pregunta no sabe quién la hizo |

Cómo se sostiene eso:

- **El sorteo corre en la base** (`draw_group()`, SECURITY DEFINER). La lista completa de quién le
  regala a quién nunca llega a un navegador, tampoco al de quien organiza. Nadie puede insertar
  emparejamientos a mano, y el estado del grupo solo cambia a través de esas funciones.
- **Las listas viven en su propia tabla** (`wishlists`) con una política de lectura que solo deja
  pasar a la dueña o dueño y a quien le regala (`gives_to()`). El grupo ve los ✓ a través de
  `wishlist_status()`, que devuelve un sí o no por persona.
- **Los correos salen desde la base** (pg_net a Brevo, con la clave en Supabase Vault). La app
  nunca necesita la dirección de nadie.
- Las funciones que leen o cambian un grupo trabajan con la sesión de quien llama
  (`auth.uid()`), y el sorteo y las listas no se pueden pedir sin sesión. El login vuelve a la app
  con un redirect validado (`safeRedirect`), sin open redirects.
- Sin analítica, sin anuncios, sin cookies de terceros.

El esquema completo, con todas las políticas, está en [supabase/schema.sql](supabase/schema.sql).

---

## 🛠️ Stack

| Capa         | Qué se usa                                                                |
| ------------ | ------------------------------------------------------------------------- |
| Interfaz     | Next.js 16 (App Router) con `output: 'export'`, React 19, Tailwind, Radix |
| Hosting      | Cloudflare Workers Static Assets (solo archivos, sin código en el edge)   |
| Base y login | Supabase: Postgres con RLS, Auth (Google y correo), Realtime              |
| Correo       | Brevo, llamado desde Postgres con pg_net                                  |
| Tests        | Vitest y Testing Library                                                  |

---

## 🏃 Desarrollo local

Requisitos: Node.js 22 (ver `.nvmrc`), npm y un proyecto de Supabase.

```bash
git clone https://github.com/imkath/GhostSwap.git
cd GhostSwap
npm install
cp .env.example .env.local   # completa la URL y la anon key de Supabase
npm run dev
```

### Base de datos

1. Ejecuta [supabase/schema.sql](supabase/schema.sql) en el SQL Editor de Supabase. Es el estado
   actual completo; el historial de cambios está en `supabase/migrations/`.
2. Carga las plantillas de correo: [supabase/templates/notification-emails.sql](supabase/templates/notification-emails.sql)
   (se generan con `scripts/build-auth-emails.ts`).
3. Para que salgan los avisos (sorteo, preguntas, listas), guarda la clave API de Brevo en Vault
   con el nombre `brevo_api_key`. Sin ella la app funciona igual, solo que sin avisos.
4. Los correos de cuenta (confirmar registro, recuperar contraseña, cambiar correo) los manda
   Supabase Auth y necesitan un SMTP propio: el que trae Supabase solo entrega a los miembros del
   equipo del proyecto, 2 por hora. Aquí se usa el SMTP de Brevo (`smtp-relay.brevo.com:587`,
   remitente `hello@nvrkth.com`), con las plantillas de `supabase/templates/*.html`.

---

## ☁️ Deploy

Cada push a `main` corre lint y tests y, si pasan, publica en Cloudflare
(`.github/workflows/deploy.yml`). A mano:

```bash
npm run build    # genera out/
npm run deploy   # wrangler deploy de los archivos estáticos
```

Las variables `NEXT_PUBLIC_*` se incrustan en el build, así que tienen que estar presentes al
compilar, no como secrets de Cloudflare.

---

## ⏰ Keep-alive de Supabase

El plan gratuito de Supabase **pausa el proyecto por inactividad**, y cuando eso pasa el sitio
deja de funcionar sin aviso. Ya ocurrió en agosto de 2026.

Supabase pide "a few user requests to the database each day over the previous week", o sea
**solicitudes diarias**. Por eso el primer intento, un workflow de GitHub Actions cada 3 días,
**no bastó y la base se pausó igual**.

La solución quedó en dos capas:

1. **Worker de Cloudflare `ghostswap-keepalive`** (carpeta `keepalive/`), el keep-alive
   principal. Consulta la base **cada 6 horas** (`"crons": ["0 3,9,15,21 * * *"]`).
2. **Workflow `.github/workflows/keep-alive.yml`** como red de seguridad. Corre a diario y, si la
   base no responde, GitHub avisa por correo.

GitHub deshabilita los workflows programados tras **60 días sin actividad en el repo**, y por eso
no puede ser la única capa. GhostSwap es un producto **estacional** (se usa en diciembre), así que
la ventana de baja actividad es larga y previsible.

El mismo Worker manda **dos correos el día 1 de cada mes** a hello@nvrkth.com. Brevo desactiva
toda clave que pase 90 días sin un envío exitoso, y en octubre de 2026 tanto la clave SMTP como la
de la API ya habían muerto así. El primero ("el correo sigue funcionando") usa la clave API; el
segundo es una recuperación de contraseña para una cuenta técnica con ese correo, que sale por el
SMTP de Supabase Auth. Si un mes falta alguno de los dos, hay que revisar esa clave en
app.brevo.com.

---

## 🧪 Tests

```bash
npm run test:run       # una pasada
npm test               # modo watch
npm run test:coverage  # cobertura
```

Qué se verifica:

- **Sorteo:** `lib/derangement.ts` se prueba con property-based testing sobre miles de
  iteraciones (nadie se saca a sí mismo, se respetan las exclusiones, el resultado no es
  predecible). Ese código alimenta la demo de la portada; el sorteo real es `draw_group()` en
  Postgres, que aplica las mismas reglas.
- **Códigos de invitación:** formato, entropía y unicidad sobre miles de generaciones.
- **Validación:** los esquemas Zod que filtran lo que se escribe en la base.

---

## 🗂️ Estructura

```
ghostswap/
├── app/                  # Páginas (App Router, exportadas como estáticas)
│   ├── (app)/            # Rutas con sesión: dashboard y grupo (/groups?id=)
│   ├── auth/callback/    # Vuelta del login, en el navegador
│   └── ...
├── components/           # Componentes de React (ui/ son los de Radix)
├── lib/
│   ├── actions/          # Acciones que corren en el navegador con la sesión (RLS)
│   ├── derangement.ts    # Sorteo de la demo
│   ├── email-layout.ts   # HTML de todos los correos
│   └── ...
├── supabase/
│   ├── schema.sql        # Esquema actual, generado desde la base
│   ├── migrations/       # Historial de cambios
│   └── templates/        # Correos de Auth y de notificaciones
├── keepalive/            # Worker que evita que Supabase se pause
├── public/_headers       # Cabeceras de seguridad y caché
├── public/_redirects     # Rutas antiguas
└── wrangler.jsonc        # Cloudflare: solo archivos estáticos
```

---

## 📄 Licencia

Código propietario. Puedes leerlo para evaluarlo, pero no usarlo, copiarlo, desplegarlo ni crear
derivados sin permiso. Detalle en [LICENSE](LICENSE).
