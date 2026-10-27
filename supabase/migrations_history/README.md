# Migraciones de Base de Datos - GhostSwap

## Cómo aplicar migraciones

### Opción 1: Supabase CLI (Recomendado para desarrollo)

```bash
# Asegúrate de tener Supabase CLI instalado
npm install -g supabase

# Enlaza tu proyecto
supabase link --project-ref tu-proyecto-id

# Aplica todas las migraciones pendientes
supabase db push
```

### Opción 2: SQL Editor (Producción)

1. Ve a tu proyecto en [supabase.com](https://supabase.com)
2. Abre el **SQL Editor**
3. Ejecuta cada archivo `.sql` en orden cronológico

---

## Migraciones Disponibles

### `20251124140000_add_exclusions_table.sql`

**Fecha:** 24 de Noviembre, 2025
**Propósito:** Agregar soporte para restricciones de gifting

**Cambios:**

- Crea tabla `exclusions` para restricciones
- Define relaciones con `groups` y `profiles`
- Agrega políticas RLS para seguridad
- Índices para optimización

**SQL:**

```sql
CREATE TABLE exclusions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  giver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  excluded_receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, giver_id, excluded_receiver_id),
  CHECK (giver_id != excluded_receiver_id)
);
```

**Casos de uso:**

- Parejas que no quieren intercambiar regalos entre sí
- Familiares cercanos
- Restricciones jerárquicas en empresas
- Ver [documentación completa](../../docs/EXCLUSIONS.md)

**Backward Compatibility:** ✅ Sí

- Tabla nueva, no afecta funcionalidad existente
- Los sorteos sin restricciones siguen funcionando igual

---

### `20251124135813_add_currency_to_groups.sql`

**Fecha:** 24 de Noviembre, 2025
**Propósito:** Agregar soporte multi-moneda a grupos

**Cambios:**

- Agrega columna `currency VARCHAR(3)` a tabla `groups`
- Valor por defecto: `CLP` (Peso Chileno)
- Índice para optimizar búsquedas por moneda

**SQL:**

```sql
ALTER TABLE groups ADD COLUMN currency VARCHAR(3) DEFAULT 'CLP';
CREATE INDEX idx_groups_currency ON groups(currency);
COMMENT ON COLUMN groups.currency IS 'ISO 4217 currency code (e.g., CLP, USD, EUR, MXN, ARS, COP)';
```

**Monedas soportadas:**

- `CLP` - Peso Chileno ($)
- `USD` - Dólar Estadounidense (US$)
- `EUR` - Euro (€)
- `MXN` - Peso Mexicano (MX$)
- `ARS` - Peso Argentino (AR$)
- `COP` - Peso Colombiano (COL$)
- `PEN` - Sol Peruano (S/)
- `BRL` - Real Brasileño (R$)
- `GBP` - Libra Esterlina (£)

**Backward Compatibility:** ✅ Sí

- Los grupos existentes automáticamente obtendrán `currency = 'CLP'`
- El sitio seguirá funcionando sin cambios

---

## Verificación Post-Migración

Después de aplicar la migración, verifica:

```sql
-- 1. Verificar que la columna existe
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'groups' AND column_name = 'currency';

-- 2. Verificar que todos los grupos tienen moneda
SELECT COUNT(*) FROM groups WHERE currency IS NULL;
-- Debe retornar 0

-- 3. Ver distribución de monedas
SELECT currency, COUNT(*) as grupos
FROM groups
GROUP BY currency
ORDER BY grupos DESC;
```

---

## Rollback (si es necesario)

Si necesitas revertir esta migración:

```sql
-- ADVERTENCIA: Esto eliminará la información de moneda
DROP INDEX IF EXISTS idx_groups_currency;
ALTER TABLE groups DROP COLUMN IF EXISTS currency;
```

⚠️ **Nota:** Esto eliminará permanentemente la información de moneda de todos los grupos.

---

## Estado de Migraciones

| Archivo                                     | Estado       | Fecha Aplicada | Notas                    |
| ------------------------------------------- | ------------ | -------------- | ------------------------ |
| `fix_matches_policies.sql`                  | ✅ Aplicada  | -              | Migración inicial        |
| `20251124135813_add_currency_to_groups.sql` | ⏳ Pendiente | -              | Soporte multi-moneda     |
| `20251124140000_add_exclusions_table.sql`   | ⏳ Pendiente | -              | Restricciones de gifting |

---

## Troubleshooting

### Error: "column already exists"

La migración ya fue aplicada. Verifica con:

```sql
SELECT * FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'currency';
```

### Error: "permission denied"

Asegúrate de tener permisos de administrador en la base de datos.

### La migración no aparece en producción

1. Verifica que el archivo esté en el repositorio
2. Ejecuta manualmente desde el SQL Editor
3. Documenta la aplicación manual

---

## Buenas Prácticas

1. **Siempre haz backup** antes de aplicar migraciones en producción
2. **Prueba primero** en un ambiente de desarrollo/staging
3. **Documenta** cualquier problema encontrado
4. **Verifica** que la migración se aplicó correctamente
5. **Monitorea** la aplicación después de la migración

---

## Contacto

Si tienes problemas con las migraciones, revisa:

- [Documentación de Supabase](https://supabase.com/docs/guides/database/migrations)
- Logs de la base de datos en el dashboard de Supabase
