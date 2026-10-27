'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Eye, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GhostAvatar } from '@/components/ghost-avatar'
import { GhostMark } from '@/components/ghost-mark'
import { celebrate } from '@/lib/confetti'
import styles from './blind-demo.module.css'

// The blind draw, playable: a list with the name taped over, a chat that hides names the way the
// app does (censor_names in the database), a guess and the reveal. Same people as the draw demo.
type Person = { name: string; wishes: string[]; clues: string[] }

const PEOPLE: Person[] = [
  {
    name: 'Ana',
    wishes: ['Una planta que aguante poca luz', 'Aros de plata, chicos', 'Té de frutos rojos'],
    clues: ['Soy la que siempre llega tarde, Luis lo sabe', 'Trabajo con Carmen hace años'],
  },
  {
    name: 'Tomás',
    wishes: ['Calcetines con dibujos, talla 42', 'Un juego de mesa corto', 'Café de grano'],
    clues: ['En el último asado yo hice el pan', 'Javiera me gana siempre al UNO'],
  },
  {
    name: 'Javiera',
    wishes: ['Libreta de puntos A5', 'Plumones de colores pastel', 'Algo para la bici'],
    clues: ['Llego a todas partes en bici', 'Con Ana compartimos oficina'],
  },
  {
    name: 'Luis',
    wishes: ['Audífonos para correr', 'Botella que mantenga frío', 'Un libro de viajes'],
    clues: ['Corro todos los domingos temprano', 'Tomás y yo nos conocemos del colegio'],
  },
  {
    name: 'Carmen',
    wishes: ['Una taza grande para té', 'Semillas para el huerto', 'Chocolate amargo'],
    clues: ['Tengo un huerto en el balcón', 'Pedro me regaló algo el año pasado'],
  },
]
const OTHERS = ['Pedro', ...PEOPLE.map((p) => p.name)]

// Accent-proof pattern, so "tomas" and "Tomás" both get covered.
const fold = (s: string) =>
  s
    .replace(/[aá]/gi, '[aá]')
    .replace(/[eé]/gi, '[eé]')
    .replace(/[ií]/gi, '[ií]')
    .replace(/[oó]/gi, '[oó]')
    .replace(/[uú]/gi, '[uú]')
const NAMES = new RegExp(`(?<!\\p{L})(${OTHERS.map(fold).join('|')})(?!\\p{L})`, 'giu')
const hide = (text: string) => text.replace(NAMES, '•••')

type Line = { from: 'me' | 'them'; text: string }
const opening = (p: Person): Line[] => [
  { from: 'me', text: '¿Me das una pista?' },
  { from: 'them', text: hide(p.clues[0]) },
]

export function BlindDemo() {
  const [index, setIndex] = useState(2)
  const person = PEOPLE[index]
  const [chat, setChat] = useState<Line[]>(() => opening(PEOPLE[2]))
  const [draft, setDraft] = useState('')
  const [guess, setGuess] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [clue, setClue] = useState(1)
  const log = useRef<HTMLOListElement>(null)

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [chat])

  const send = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    const reply = person.clues[clue] ?? 'No te voy a decir más, ja'
    setClue((n) => n + 1)
    setChat((c) => [...c, { from: 'me', text: hide(text) }])
    window.setTimeout(() => setChat((c) => [...c, { from: 'them', text: hide(reply) }]), 700)
  }

  const reveal = () => {
    setRevealed(true)
    if (guess === person.name) celebrate()
  }

  const again = () => {
    // A different person each round; random only after the first, so server and browser agree.
    let next = index
    while (next === index) next = Math.floor(Math.random() * PEOPLE.length)
    setIndex(next)
    setChat(opening(PEOPLE[next]))
    setGuess(null)
    setRevealed(false)
    setClue(1)
    setDraft('')
  }

  return (
    <div className={styles.board}>
      <div className={styles.envelope}>
        <div className={styles.to}>
          <GhostMark blindfold={!revealed} className={styles.ghost} />
          <div>
            <p className={styles.step}>
              <span>1</span> Le regalas a
            </p>
            <p className={styles.name} aria-live="polite">
              {revealed ? (
                <span className={styles.realName}>{person.name}</span>
              ) : (
                <span className={styles.tape} aria-label="Nombre tapado">
                  <span aria-hidden="true">secreto</span>
                </span>
              )}
            </p>
          </div>
        </div>
        <p className={styles.listLabel}>Lo que le gustaría</p>
        <ul className={styles.wishes}>
          {person.wishes.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>

      <div className={styles.chat}>
        <p className={styles.step}>
          <span>2</span> Chat anónimo
        </p>
        <ol ref={log} className={styles.log} aria-live="polite" aria-label="Mensajes de ejemplo">
          {chat.map((line, i) => (
            <li key={i} className={line.from === 'me' ? styles.me : styles.them}>
              {line.text.split('•••').map((part, j) => (
                <span key={j}>
                  {j > 0 && (
                    <span className={styles.redacted} role="img" aria-label="nombre tapado" />
                  )}
                  {part}
                </span>
              ))}
            </li>
          ))}
        </ol>
        <form onSubmit={send} className={styles.compose}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Prueba escribir «¿eres Tomás?»"
            aria-label="Escribe un mensaje de prueba"
            maxLength={120}
          />
          <Button type="submit" size="icon" aria-label="Enviar">
            <Send aria-hidden="true" />
          </Button>
        </form>
        <p className={styles.hint}>Cualquier nombre del grupo se tapa al enviarlo.</p>
      </div>

      <div className={styles.footer}>
        <fieldset className={styles.guess} disabled={revealed}>
          <legend className={styles.step}>
            <span>3</span> ¿De quién crees que es?
          </legend>
          <div className={styles.chips}>
            {PEOPLE.map((p) => (
              <button
                key={p.name}
                type="button"
                aria-pressed={guess === p.name}
                className={styles.chip}
                onClick={() => setGuess(p.name)}
              >
                <GhostAvatar seed={`demo-${p.name}`} size={28} />
                {p.name}
              </button>
            ))}
          </div>
        </fieldset>
        <div className={styles.reveal}>
          <p className={styles.step}>
            <span>4</span> La revelación
          </p>
          {revealed ? (
            <div className={styles.result}>
              <p aria-live="polite">
                {guess === person.name
                  ? `Era ${person.name}. Acertaste.`
                  : guess
                    ? `Era ${person.name}. Apostaste por ${guess}.`
                    : `Era ${person.name}.`}
              </p>
              <Button variant="outline" onClick={again}>
                <RotateCcw aria-hidden="true" />
                Otra ronda
              </Button>
            </div>
          ) : (
            <div className={styles.result}>
              <p>{guess ? `Apostaste por ${guess}.` : 'Apuesta primero, o revela a la suerte.'}</p>
              <Button onClick={reveal}>
                <Eye aria-hidden="true" />
                Revelar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
