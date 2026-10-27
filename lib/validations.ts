import { z } from 'zod'

// Supported currencies
export const currencySchema = z.enum(
  ['CLP', 'USD', 'EUR', 'MXN', 'ARS', 'COP', 'PEN', 'BRL', 'GBP'],
  {
    errorMap: () => ({ message: 'Moneda no soportada' }),
  }
)

// Group schemas
export const updateGroupSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es muy largo').optional(),
  budget: z.number().positive('El presupuesto debe ser positivo').nullable().optional(),
  currency: currencySchema.optional(),
  exchange_date: z
    .string()
    .refine((val) => val === '' || /^\d{4}-\d{2}-\d{2}$/.test(val), 'Fecha inválida')
    .nullable()
    .optional()
    .transform((val) => (val === '' ? null : val)),
  mode: z.enum(['classic', 'blind']).optional(),
  // Backup time for a blind reveal (ISO with offset); null clears it.
  reveal_at: z.string().datetime({ offset: true }).nullable().optional(),
  // Where the exchange happens (see lib/place.ts); the database checks the same rules.
  place_kind: z.enum(['in_person', 'online']).nullable().optional(),
  place_name: z.string().max(80, 'El nombre del lugar es muy largo').nullable().optional(),
  place_detail: z.string().max(300, 'La dirección es muy larga').nullable().optional(),
})

export const groupIdSchema = z.string().uuid('ID de grupo inválido')

export const memberIdSchema = z.string().uuid('ID de miembro inválido')

// Draw schemas
export const drawNamesSchema = z.object({
  groupId: z.string().uuid('ID de grupo inválido'),
})

// Exclusion schemas
export const addExclusionSchema = z
  .object({
    groupId: z.string().uuid('ID de grupo inválido'),
    giverId: z.string().uuid('ID de giver inválido'),
    excludedReceiverId: z.string().uuid('ID de receiver inválido'),
  })
  .refine((data) => data.giverId !== data.excludedReceiverId, {
    message: 'No puedes excluir a una persona de sí misma',
  })

export const removeExclusionSchema = z.object({
  exclusionId: z.string().uuid('ID de exclusión inválido'),
})

// Wishlist schemas
export const wishlistItemSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200, 'El nombre es muy largo'),
  url: z.string().url('URL inválida').optional().or(z.literal('')),
  description: z.string().max(500, 'La descripción es muy larga').optional(),
  priority: z.number().min(1).max(5).optional(),
})

export const updateWishlistSchema = z.array(wishlistItemSchema).max(5, 'Máximo 5 items permitidos')

// Type exports
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>
export type WishlistItem = z.infer<typeof wishlistItemSchema>
export type AddExclusionInput = z.infer<typeof addExclusionSchema>
export type RemoveExclusionInput = z.infer<typeof removeExclusionSchema>
