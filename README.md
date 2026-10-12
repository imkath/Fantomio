# 👻 GhostSwap

**Organiza tu Amigo Secreto o intercambio de regalos online gratis con sorteos automáticos y listas de deseos.**

[![Deploy](https://github.com/imkath/GhostSwap/actions/workflows/deploy.yml/badge.svg)](https://github.com/imkath/GhostSwap/actions/workflows/deploy.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)

---

## ✨ Características

### 🎯 Core Features

- 🎲 **Sorteo Automático** - Algoritmo de derangement verificado matemáticamente
- 👥 **Grupos Ilimitados** - Crea y gestiona múltiples grupos
- 🎁 **Wishlist** - Hasta 5 items por participante con URLs y descripciones
- 🚫 **Exclusiones** - Configura restricciones (ej: parejas que no se regalan entre sí)
- 💰 **Multi-Moneda** - Soporte para 9 monedas (CLP, USD, EUR, MXN, ARS, COP, PEN, BRL, GBP)
- 📅 **Fecha del Evento** - Contador de días hasta el intercambio
- 📧 **Notificaciones Email** - Aviso automático cuando se realiza el sorteo
- 🔐 **100% Privado** - Nadie ve las asignaciones, ni siquiera el admin
- 📱 **Responsive** - Funciona perfecto en mobile y desktop

### 🌎 Monedas Soportadas

| Moneda             | Símbolo    | Ejemplo     |
| ------------------ | ---------- | ----------- |
| 🇨🇱 Peso Chileno    | CLP ($)    | $50.000     |
| 🇺🇸 Dólar           | USD (US$)  | US$50       |
| 🇪🇺 Euro            | EUR (€)    | €50         |
| 🇲🇽 Peso Mexicano   | MXN (MX$)  | MX$1.000    |
| 🇦🇷 Peso Argentino  | ARS (AR$)  | AR$50.000   |
| 🇨🇴 Peso Colombiano | COP (COL$) | COL$200.000 |
| 🇵🇪 Sol Peruano     | PEN (S/)   | S/200       |
| 🇧🇷 Real Brasileño  | BRL (R$)   | R$250       |
| 🇬🇧 Libra Esterlina | GBP (£)    | £40         |

---

## 🚀 Demo

👉 **[ghostswap.nvrkth.com](https://ghostswap.nvrkth.com)**

---

## 📸 Screenshots

### Landing Page

![Landing](docs/images/landing.png)

### Crear Grupo

![Create Group](docs/images/create-group.png)

### Dashboard

![Dashboard](docs/images/dashboard.png)

---

## 🛠️ Tech Stack

### Frontend

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 + Tailwind CSS
- **Components:** Radix UI
- **Animations:** Framer Motion
- **Forms:** React Hook Form + Zod

### Backend

- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (Google OAuth + Email)
- **Email:** Brevo (API HTTP)
- **API:** Next.js Server Actions
- **Validation:** Zod

### Deployment

- **Hosting:** Cloudflare Workers
- **Build:** OpenNext for Cloudflare
- **CLI:** Wrangler

### Testing

- **Framework:** Vitest
- **Testing Library:** React Testing Library
- **Enfoque:** la lógica del sorteo se verifica con property-based testing y pruebas de estrés

---

## 🏃 Quick Start

### Prerequisites

- Node.js 22+ (ver `.nvmrc`)
- npm
- Cuenta de Supabase
- Cuenta de Cloudflare (para deploy)

### 1. Clonar el repositorio

```bash
git clone https://github.com/imkath/GhostSwap.git
cd GhostSwap
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` y agrega:

```env
NEXT_PUBLIC_SUPABASE_URL=tu-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key

# Email (Brevo API) - Opcional, para notificaciones
BREVO_API_KEY=xkeysib-...
```

### 4. Configurar la base de datos

```bash
# Ejecuta el schema en tu proyecto de Supabase
# Copia el contenido de supabase/schema.sql
# Pégalo en el SQL Editor de Supabase
```

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## ☁️ Deploy a Cloudflare Workers

```bash
# Build y deploy en un solo comando
npm run build:cloudflare && npm run deploy

# O por separado:
npm run build:cloudflare  # Build para Cloudflare
npm run preview           # Preview local
npm run deploy            # Deploy a producción
```

### Configurar secrets en Cloudflare

```bash
npx wrangler secret put BREVO_API_KEY
```

---

## ⏰ Keep-alive de Supabase

El plan gratuito de Supabase **pausa el proyecto por inactividad**, y cuando eso
pasa el sitio deja de existir sin aviso. Ya ocurrio en agosto de 2026.

Supabase pide "a few user requests to the database each day over the previous
week", o sea **solicitudes diarias**, no una cada tanto. Por eso el primer
intento, un workflow de GitHub Actions cada 3 dias, **no basto y la base se
pauso igual**.

La solucion quedo en dos capas:

1. **Worker de Cloudflare `ghostswap-keepalive`** (carpeta `keepalive/`), que es
   el keep-alive principal. Consulta la base **cada 6 horas**
   (`"crons": ["0 3,9,15,21 * * *"]`).
2. **Workflow `.github/workflows/keep-alive.yml`** como red de seguridad. Corre
   a diario y, si la base no responde, GitHub avisa por correo.

Ojo con dos trampas de GitHub Actions: deshabilita los workflows programados
tras **60 dias sin actividad en el repo**, y por eso no puede ser la unica capa.

GhostSwap es un producto **estacional** (se usa en diciembre), asi que la
ventana de baja actividad es larga y previsible. Mejor que la falla aparezca en
agosto y no en temporada.

El mismo Worker manda **un correo el dia 1 de cada mes** a hello@nvrkth.com. Brevo
desactiva toda clave que pase 90 dias sin un envio exitoso, y en octubre de 2026
la clave anterior ya habia muerto asi. Si un mes ese correo no llega, revisar la
clave en app.brevo.com.

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Tests en modo watch
npm run test

# Tests con UI
npm run test:ui

# Coverage report
npm run test:coverage
```

### Qué se prueba

El foco está en el algoritmo de sorteo, que es donde un error rompe el producto:
que nadie se saque a sí mismo, que se respeten las exclusiones y que el resultado
no sea predecible.

- **Derangement:** property-based testing sobre miles de iteraciones, verificando
  que ninguna asignación sea un punto fijo
- **Exclusiones:** casos límite donde las restricciones hacen imposible el sorteo
- **Códigos de invitación:** unicidad y resistencia a manipulación de la URL
- **Validación:** los esquemas que protegen la escritura en base de datos

---

## 📚 Documentación

- [FEATURES.md](FEATURES.md) - Lista completa de características
- [supabase/migrations/README.md](supabase/migrations/README.md) - Guía de migraciones
- [lib/**tests**/DERANGEMENT_VERIFICATION.md](lib/__tests__/DERANGEMENT_VERIFICATION.md) - Verificación matemática del algoritmo

---

## 🔐 Seguridad

- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Validación de entrada con Zod
- ✅ Autenticación requerida
- ✅ Solo ves tu propia asignación
- ✅ Admin no ve asignaciones
- ✅ HTTPS only

---

## 🗂️ Estructura del Proyecto

```
ghostswap/
├── app/                    # Next.js App Router
│   ├── actions/           # Server Actions
│   ├── dashboard/         # Dashboard page
│   ├── groups/           # Group pages
│   └── ...
├── components/            # React components
│   ├── ui/               # Radix UI components
│   └── ...
├── lib/                   # Utilidades
│   ├── __tests__/        # Tests
│   ├── derangement.ts    # Algoritmo de sorteo
│   ├── email.ts          # Envío de emails (Brevo API)
│   ├── validations.ts    # Schemas Zod
│   └── ...
├── hooks/                 # Custom hooks
├── supabase/             # Database
│   ├── schema.sql        # Schema completo
│   └── migrations/       # Migraciones
├── wrangler.jsonc         # Configuración Cloudflare Workers
├── open-next.config.ts    # Configuración OpenNext
└── public/               # Assets estáticos
```

---

**GhostSwap** - La plataforma más completa para organizar tu Amigo Secreto 🎁👻
