import { describe, it, expect } from 'vitest'
import { getUserFriendlyError } from '../errors'

describe('getUserFriendlyError', () => {
  describe('auth errors by code', () => {
    it('handles invalid_credentials', () => {
      const result = getUserFriendlyError({ code: 'invalid_credentials' })
      expect(result).toBe('Credenciales incorrectas. Verifica tu email y contraseña.')
    })

    it('handles user_not_found', () => {
      const result = getUserFriendlyError({ code: 'user_not_found' })
      expect(result).toBe('No encontramos una cuenta con ese email.')
    })

    it('handles email_taken', () => {
      const result = getUserFriendlyError({ code: 'email_taken' })
      expect(result).toBe('Ya existe una cuenta con ese email.')
    })

    it('handles weak_password', () => {
      const result = getUserFriendlyError({ code: 'weak_password' })
      expect(result).toBe('La contraseña debe tener al menos 6 caracteres.')
    })

    it('handles invalid_email', () => {
      const result = getUserFriendlyError({ code: 'invalid_email' })
      expect(result).toBe('El formato del email no es válido.')
    })

    it('handles email_not_confirmed', () => {
      const result = getUserFriendlyError({ code: 'email_not_confirmed' })
      expect(result).toBe('Debes confirmar tu email antes de iniciar sesión.')
    })

    it('handles session_expired', () => {
      const result = getUserFriendlyError({ code: 'session_expired' })
      expect(result).toBe('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.')
    })

    it('handles invalid_token', () => {
      const result = getUserFriendlyError({ code: 'invalid_token' })
      expect(result).toBe('El enlace ha expirado o es inválido.')
    })

    it('handles over_email_send_rate_limit', () => {
      const result = getUserFriendlyError({ code: 'over_email_send_rate_limit' })
      expect(result).toBe('Demasiados intentos. Espera unos minutos antes de intentar de nuevo.')
    })
  })

  describe('database errors by code', () => {
    it('handles 23505 (duplicate key)', () => {
      const result = getUserFriendlyError({ code: '23505' })
      expect(result).toBe('Este registro ya existe.')
    })

    it('handles 23503 (foreign key)', () => {
      const result = getUserFriendlyError({ code: '23503' })
      expect(result).toBe('No se puede completar la acción porque hay datos relacionados.')
    })

    it('handles 42P17 (configuration)', () => {
      const result = getUserFriendlyError({ code: '42P17' })
      expect(result).toBe('Error de configuración. Por favor, contacta soporte.')
    })

    it('handles 42501 (permission denied)', () => {
      const result = getUserFriendlyError({ code: '42501' })
      expect(result).toBe('No tienes permisos para realizar esta acción.')
    })

    it('handles PGRST116 (not found)', () => {
      const result = getUserFriendlyError({ code: 'PGRST116' })
      expect(result).toBe('No se encontró el registro solicitado.')
    })

    it('handles 23502 (not null violation)', () => {
      const result = getUserFriendlyError({ code: '23502' })
      expect(result).toBe('Faltan datos requeridos.')
    })

    it('handles 22P02 (invalid text representation)', () => {
      const result = getUserFriendlyError({ code: '22P02' })
      expect(result).toBe('El formato de los datos es incorrecto.')
    })

    it('handles PGRST301 (connection error)', () => {
      const result = getUserFriendlyError({ code: 'PGRST301' })
      expect(result).toBe('Error de conexión con la base de datos.')
    })
  })

  describe('network errors by code', () => {
    it('handles FetchError', () => {
      const result = getUserFriendlyError({ code: 'FetchError' })
      expect(result).toBe('Error de conexión. Verifica tu internet e intenta de nuevo.')
    })

    it('handles NetworkError', () => {
      const result = getUserFriendlyError({ code: 'NetworkError' })
      expect(result).toBe('Error de red. Verifica tu conexión a internet.')
    })
  })

  describe('errors by message content', () => {
    it('handles infinite recursion message', () => {
      const result = getUserFriendlyError({ message: 'infinite recursion detected' })
      expect(result).toBe('Error de configuración del servidor. Por favor, contacta soporte.')
    })

    it('handles duplicate key message', () => {
      const result = getUserFriendlyError({ message: 'duplicate key value violates unique' })
      expect(result).toBe('Este registro ya existe.')
    })

    it('handles already exists message', () => {
      const result = getUserFriendlyError({ message: 'this record already exists' })
      expect(result).toBe('Este registro ya existe.')
    })

    it('handles foreign key message', () => {
      const result = getUserFriendlyError({ message: 'foreign key constraint failed' })
      expect(result).toBe('No se puede eliminar porque hay datos relacionados.')
    })

    it('handles referenced message', () => {
      const result = getUserFriendlyError({ message: 'is still referenced from table' })
      expect(result).toBe('No se puede eliminar porque hay datos relacionados.')
    })

    it('handles permission denied message', () => {
      const result = getUserFriendlyError({ message: 'permission denied for table' })
      expect(result).toBe('No tienes permisos para realizar esta acción.')
    })

    it('handles not authorized message', () => {
      const result = getUserFriendlyError({ message: 'user not authorized' })
      expect(result).toBe('No tienes permisos para realizar esta acción.')
    })

    it('handles network error message', () => {
      const result = getUserFriendlyError({ message: 'network request failed' })
      expect(result).toBe('Error de conexión. Verifica tu internet e intenta de nuevo.')
    })

    it('handles fetch error message', () => {
      const result = getUserFriendlyError({ message: 'failed to fetch data' })
      expect(result).toBe('Error de conexión. Verifica tu internet e intenta de nuevo.')
    })

    it('handles timeout message', () => {
      const result = getUserFriendlyError({ message: 'request timeout' })
      expect(result).toBe('La operación tardó demasiado. Intenta de nuevo.')
    })

    it('handles Invalid login message', () => {
      const result = getUserFriendlyError({ message: 'Invalid login credentials' })
      expect(result).toBe('Credenciales incorrectas. Verifica tu email y contraseña.')
    })

    it('handles Email not confirmed message', () => {
      const result = getUserFriendlyError({ message: 'Email not confirmed' })
      expect(result).toBe('Debes confirmar tu email antes de iniciar sesión.')
    })

    it('handles User already registered message', () => {
      const result = getUserFriendlyError({ message: 'User already registered' })
      expect(result).toBe('Ya existe una cuenta con ese email.')
    })
  })

  describe('string errors', () => {
    it('handles plain string with duplicate key', () => {
      const result = getUserFriendlyError('duplicate key value')
      expect(result).toBe('Este registro ya existe.')
    })

    it('handles plain string with network', () => {
      const result = getUserFriendlyError('network error occurred')
      expect(result).toBe('Error de conexión. Verifica tu internet e intenta de nuevo.')
    })
  })

  describe('fallback behavior', () => {
    it('returns default message for unknown error', () => {
      const result = getUserFriendlyError({ message: 'some unknown error' })
      expect(result).toBe('Ocurrió un error inesperado. Por favor, intenta de nuevo.')
    })

    it('returns default message for empty error', () => {
      const result = getUserFriendlyError({})
      expect(result).toBe('Ocurrió un error inesperado. Por favor, intenta de nuevo.')
    })

    it('returns default message for empty string', () => {
      const result = getUserFriendlyError('')
      expect(result).toBe('Ocurrió un error inesperado. Por favor, intenta de nuevo.')
    })
  })

  describe('priority: code over message', () => {
    it('uses code when both code and message are provided', () => {
      const result = getUserFriendlyError({
        code: 'invalid_credentials',
        message: 'some other message',
      })
      expect(result).toBe('Credenciales incorrectas. Verifica tu email y contraseña.')
    })
  })
})
