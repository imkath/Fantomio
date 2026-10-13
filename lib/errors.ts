// Map technical errors to user-friendly messages
export function getUserFriendlyError(error: { code?: string; message?: string } | string): string {
  const message = typeof error === 'string' ? error : error.message || ''
  const code = typeof error === 'string' ? '' : error.code || ''

  // Supabase/PostgreSQL error codes
  const errorMap: Record<string, string> = {
    // Auth errors
    invalid_credentials: 'Credenciales incorrectas. Verifica tu email y contraseña.',
    user_not_found: 'No encontramos una cuenta con ese email.',
    email_taken: 'Ya existe una cuenta con ese email.',
    weak_password: 'La contraseña debe tener al menos 6 caracteres.',
    invalid_email: 'El formato del email no es válido.',
    email_not_confirmed: 'Debes confirmar tu email antes de iniciar sesión.',
    session_expired: 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.',
    invalid_token: 'El enlace ha expirado o es inválido.',
    over_email_send_rate_limit:
      'Demasiados intentos. Espera unos minutos antes de intentar de nuevo.',

    // Database errors
    '23505': 'Este registro ya existe.',
    '23503': 'No se puede completar la acción porque hay datos relacionados.',
    '23502': 'Faltan datos requeridos.',
    '22P02': 'El formato de los datos es incorrecto.',
    '42P17': 'Error de configuración. Por favor, contacta soporte.',
    '42501': 'No tienes permisos para realizar esta acción.',
    PGRST116: 'No se encontró el registro solicitado.',
    PGRST301: 'Error de conexión con la base de datos.',

    // Network errors
    FetchError: 'Error de conexión. Verifica tu internet e intenta de nuevo.',
    NetworkError: 'Error de red. Verifica tu conexión a internet.',
  }

  // Check by code first
  if (code && errorMap[code]) {
    return errorMap[code]
  }

  // Check by message content
  if (message.includes('infinite recursion')) {
    return 'Error de configuración del servidor. Por favor, contacta soporte.'
  }
  if (message.includes('duplicate key') || message.includes('already exists')) {
    return 'Este registro ya existe.'
  }
  if (message.includes('foreign key') || message.includes('referenced')) {
    return 'No se puede eliminar porque hay datos relacionados.'
  }
  if (message.includes('permission denied') || message.includes('not authorized')) {
    return 'No tienes permisos para realizar esta acción.'
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Error de conexión. Verifica tu internet e intenta de nuevo.'
  }
  if (message.includes('timeout')) {
    return 'La operación tardó demasiado. Intenta de nuevo.'
  }
  if (message.includes('Invalid login')) {
    return 'Credenciales incorrectas. Verifica tu email y contraseña.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Debes confirmar tu email antes de iniciar sesión.'
  }
  if (message.includes('User already registered')) {
    return 'Ya existe una cuenta con ese email.'
  }

  // Default message
  return 'Ocurrió un error inesperado. Por favor, intenta de nuevo.'
}
