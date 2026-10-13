import { describe, it, expect } from 'vitest'
import { generateDerangement } from '../derangement'

describe('generateDerangement - Propiedades Matemáticas', () => {
  describe('Propiedad 1: Nadie se asigna a sí mismo', () => {
    it('con 3 participantes - 1000 iteraciones', () => {
      const participants = ['A', 'B', 'C']

      for (let i = 0; i < 1000; i++) {
        const result = generateDerangement(participants)
        expect(result).not.toBeNull()

        // Verificar que ningún elemento está en su posición original
        for (let j = 0; j < participants.length; j++) {
          expect(result![j]).not.toBe(participants[j])
        }
      }
    })

    it('con 10 participantes - 500 iteraciones', () => {
      const participants = Array.from({ length: 10 }, (_, i) => `P${i}`)

      for (let i = 0; i < 500; i++) {
        const result = generateDerangement(participants)
        expect(result).not.toBeNull()

        for (let j = 0; j < participants.length; j++) {
          expect(result![j]).not.toBe(participants[j])
        }
      }
    })

    it('con 50 participantes - 100 iteraciones', () => {
      const participants = Array.from({ length: 50 }, (_, i) => `P${i}`)

      for (let i = 0; i < 100; i++) {
        const result = generateDerangement(participants)
        expect(result).not.toBeNull()

        for (let j = 0; j < participants.length; j++) {
          expect(result![j]).not.toBe(participants[j])
        }
      }
    })
  })

  describe('Propiedad 2: Cada persona aparece exactamente una vez como receptor', () => {
    it('con 3 participantes', () => {
      const participants = ['A', 'B', 'C']

      for (let i = 0; i < 100; i++) {
        const result = generateDerangement(participants)
        expect(result).not.toBeNull()

        // Crear un conjunto para contar cuántas veces aparece cada persona
        const receiverCount = new Map<string, number>()

        result!.forEach((receiver) => {
          receiverCount.set(receiver, (receiverCount.get(receiver) || 0) + 1)
        })

        // Cada persona debe aparecer exactamente 1 vez
        participants.forEach((person) => {
          expect(receiverCount.get(person)).toBe(1)
        })

        // No debe haber personas que no estén en la lista original
        expect(receiverCount.size).toBe(participants.length)
      }
    })

    it('con 20 participantes', () => {
      const participants = Array.from({ length: 20 }, (_, i) => `P${i}`)

      for (let i = 0; i < 100; i++) {
        const result = generateDerangement(participants)
        expect(result).not.toBeNull()

        const receiverCount = new Map<string, number>()

        result!.forEach((receiver) => {
          receiverCount.set(receiver, (receiverCount.get(receiver) || 0) + 1)
        })

        participants.forEach((person) => {
          expect(receiverCount.get(person)).toBe(1)
        })

        expect(receiverCount.size).toBe(participants.length)
      }
    })
  })

  describe('Propiedad 3: Es una biyección (función uno-a-uno)', () => {
    it('cada giver tiene exactamente un receiver y viceversa', () => {
      const participants = ['A', 'B', 'C', 'D', 'E']

      for (let i = 0; i < 100; i++) {
        const result = generateDerangement(participants)
        expect(result).not.toBeNull()

        // Crear el mapeo giver -> receiver
        const giverToReceiver = new Map<string, string>()
        participants.forEach((giver, index) => {
          giverToReceiver.set(giver, result![index])
        })

        // Verificar que es una función (cada giver tiene un receiver)
        expect(giverToReceiver.size).toBe(participants.length)

        // Verificar que es inyectiva (no hay dos givers con el mismo receiver)
        const receivers = Array.from(giverToReceiver.values())
        const uniqueReceivers = new Set(receivers)
        expect(uniqueReceivers.size).toBe(receivers.length)

        // Verificar que es sobreyectiva (todos los participantes son receivers)
        participants.forEach((person) => {
          expect(receivers).toContain(person)
        })
      }
    })
  })

  describe('Propiedad 4: Forma un ciclo completo o varios ciclos disjuntos', () => {
    it('todos los participantes están conectados en ciclos', () => {
      const participants = ['A', 'B', 'C', 'D', 'E', 'F']

      for (let i = 0; i < 50; i++) {
        const result = generateDerangement(participants)
        expect(result).not.toBeNull()

        // Crear el mapeo
        const mapping = new Map<string, string>()
        participants.forEach((giver, index) => {
          mapping.set(giver, result![index])
        })

        // Verificar que siguiendo la cadena eventualmente volvemos al inicio
        const visited = new Set<string>()

        for (const start of participants) {
          if (visited.has(start)) continue

          let current = start
          let cycleLength = 0
          const cycleNodes = new Set<string>()

          // Seguir el ciclo hasta volver al inicio
          do {
            visited.add(current)
            cycleNodes.add(current)
            current = mapping.get(current)!
            cycleLength++

            // Evitar ciclos infinitos (máximo n pasos)
            if (cycleLength > participants.length) {
              throw new Error('Ciclo infinito detectado')
            }
          } while (current !== start)

          // En un derangement, no puede haber ciclos de longitud 1
          expect(cycleLength).toBeGreaterThan(1)
        }

        // Todos los participantes deben haber sido visitados
        expect(visited.size).toBe(participants.length)
      }
    })
  })

  describe('Propiedad 5: El resultado es una permutación válida', () => {
    it('contiene exactamente los mismos elementos que la entrada', () => {
      const participants = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

      for (let i = 0; i < 100; i++) {
        const result = generateDerangement(participants)
        expect(result).not.toBeNull()

        // Ordenar ambos arrays para comparar
        const sortedInput = [...participants].sort()
        const sortedResult = [...result!].sort()

        expect(sortedResult).toEqual(sortedInput)
      }
    })
  })

  describe('Propiedad 6: Distribución de probabilidades (test estadístico)', () => {
    it('diferentes resultados tienen distribución uniforme aproximada', () => {
      const participants = ['A', 'B', 'C', 'D']
      const iterations = 1000

      // Contar cuántas veces cada persona recibe de cada giver
      const pairCounts = new Map<string, number>()

      for (let i = 0; i < iterations; i++) {
        const result = generateDerangement(participants)

        participants.forEach((giver, index) => {
          const receiver = result![index]
          const pair = `${giver}->${receiver}`
          pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1)
        })
      }

      // En un derangement de 4 elementos, hay 9 derangements posibles
      // Cada par válido debería aparecer con probabilidad razonable

      // Verificar que los pares prohibidos (A->A, B->B, etc) nunca ocurren
      participants.forEach((person) => {
        const prohibitedPair = `${person}->${person}`
        expect(pairCounts.get(prohibitedPair) || 0).toBe(0)
      })

      // Verificar que todos los pares permitidos ocurren al menos una vez
      participants.forEach((giver) => {
        participants.forEach((receiver) => {
          if (giver !== receiver) {
            const pair = `${giver}->${receiver}`
            const count = pairCounts.get(pair) || 0
            expect(count).toBeGreaterThan(0)

            // No debe estar muy desbalanceado (usando un rango amplio)
            // Esperamos ~iterations/9 por par válido, con margen de error
            expect(count).toBeGreaterThan(iterations / 40) // Mínimo
            expect(count).toBeLessThan(iterations / 2) // Máximo razonable
          }
        })
      })
    })
  })

  describe('Casos extremos', () => {
    it('con 2 participantes siempre produce el mismo resultado', () => {
      const participants = ['A', 'B']
      const results = new Set<string>()

      for (let i = 0; i < 100; i++) {
        const result = generateDerangement(participants)
        expect(result).not.toBeNull()
        results.add(JSON.stringify(result))

        // Con 2 elementos, solo hay un derangement: [B, A]
        expect(result![0]).toBe('B')
        expect(result![1]).toBe('A')
      }

      // Solo debe haber un resultado único
      expect(results.size).toBe(1)
    })

    it('con 100 participantes sigue cumpliendo todas las propiedades', () => {
      const participants = Array.from({ length: 100 }, (_, i) => `P${i}`)

      for (let i = 0; i < 10; i++) {
        const result = generateDerangement(participants)
        expect(result).not.toBeNull()

        // Propiedad 1: Nadie se asigna a sí mismo
        for (let j = 0; j < participants.length; j++) {
          expect(result![j]).not.toBe(participants[j])
        }

        // Propiedad 2: Cada persona aparece exactamente una vez
        const receiverCount = new Map<string, number>()
        result!.forEach((receiver) => {
          receiverCount.set(receiver, (receiverCount.get(receiver) || 0) + 1)
        })

        participants.forEach((person) => {
          expect(receiverCount.get(person)).toBe(1)
        })
      }
    })
  })

  describe('Verificación con UUIDs reales (caso de uso real)', () => {
    it('funciona correctamente con UUIDs de usuarios', () => {
      const userIds = [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
        '550e8400-e29b-41d4-a716-446655440004',
        '550e8400-e29b-41d4-a716-446655440005',
      ]

      for (let i = 0; i < 100; i++) {
        const result = generateDerangement(userIds)
        expect(result).not.toBeNull()

        // Crear el mapeo de assignments
        const assignments = userIds.map((giverId, index) => ({
          giver: giverId,
          receiver: result![index],
        }))

        // Verificar que nadie se tiene a sí mismo
        assignments.forEach(({ giver, receiver }) => {
          expect(receiver).not.toBe(giver)
        })

        // Verificar que cada UUID aparece exactamente una vez como receiver
        const receivers = assignments.map((a) => a.receiver)
        const uniqueReceivers = new Set(receivers)
        expect(uniqueReceivers.size).toBe(userIds.length)

        // Verificar que todos los receivers están en la lista original
        receivers.forEach((receiver) => {
          expect(userIds).toContain(receiver)
        })
      }
    })
  })
})
