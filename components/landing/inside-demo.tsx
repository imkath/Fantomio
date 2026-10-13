'use client'

import { useState, type FormEvent } from 'react'
import { GhostMark } from '@/components/ghost-mark'
import styles from './phone.module.css'

// What a participant sees in the app once the draw is done, with sample data.
// The reveal uses the red seal instead of confetti, as the redesigned app does.
const WISHES = [
  { text: 'Una planta que aguante poca luz', link: false },
  { text: 'Libro de cocina vegetariana', link: true },
  { text: 'Taza grande para té', link: false },
]

export function InsideDemo() {
  const [open, setOpen] = useState(false)
  const [asked, setAsked] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  const ask = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setAsked((list) => [...list, text])
    setDraft('')
  }

  return (
    <div className={styles.scene}>
      <div className={styles.slip} aria-hidden="true">
        <b>Oficina 2026</b>
        sorteo n.º 0417
        <span className={styles.slipSeal}>
          SOLO
          <br />
          PARA
          <br />
          TI
        </span>
      </div>

      <div
        className={styles.device}
        role="group"
        aria-label="Pantalla de ejemplo de la app con tu amigo secreto"
      >
        <div className={styles.screen}>
          <span className={styles.island} aria-hidden="true" />
          <div className={styles.status} aria-hidden="true">
            <span>9:41</span>
            <span className={styles.icons}>
              <svg viewBox="0 0 18 11">
                <rect x="0" y="7" width="3" height="4" rx="1" />
                <rect x="5" y="5" width="3" height="6" rx="1" />
                <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
                <rect x="15" y="0" width="3" height="11" rx="1" />
              </svg>
              <svg viewBox="0 0 16 11">
                <path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.2-1.3A10.5 10.5 0 0 0 8 .4 10.5 10.5 0 0 0 .6 3.4l1.2 1.3A8.7 8.7 0 0 1 8 2.2Zm0 3.4c1.4 0 2.7.5 3.7 1.4l1.2-1.3A7 7 0 0 0 8 3.8a7 7 0 0 0-4.9 1.9L4.3 7A5.3 5.3 0 0 1 8 5.6Zm0 3.3c.6 0 1.1.2 1.5.6L8 11 6.5 9.5c.4-.4.9-.6 1.5-.6Z" />
              </svg>
              <svg viewBox="0 0 27 12">
                <rect
                  x=".5"
                  y=".5"
                  width="22"
                  height="11"
                  rx="3.2"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity=".4"
                />
                <rect x="2" y="2" width="16" height="8" rx="2" />
                <rect x="24" y="4" width="2" height="4" rx="1" opacity=".45" />
              </svg>
            </span>
          </div>

          <div className={styles.scroll}>
            <div className={styles.appbar}>
              <span className="text-ink flex items-center gap-2">
                <GhostMark className="h-[21px] w-[18px]" />
                <span className="font-display text-base leading-none">ghostswap</span>
              </span>
              <span className={styles.avatar} aria-hidden="true">
                C
              </span>
            </div>
            <div className={styles.group}>
              <h3>Oficina 2026</h3>
              <p>intercambio 19 dic · $15.000 · 6 personas</p>
            </div>

            <div className={styles.card}>
              {!open ? (
                <>
                  <p className={styles.cap}>Tu amigo secreto</p>
                  <div className={styles.closed}>
                    <GhostMark />
                    <p>El sorteo ya está hecho. ¿Vemos a quién te tocó?</p>
                    <button type="button" className={styles.cardBtn} onClick={() => setOpen(true)}>
                      Ver a quién me tocó
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.cap}>
                    Tu amigo secreto
                    <button type="button" className={styles.hide} onClick={() => setOpen(false)}>
                      ocultar
                    </button>
                  </p>
                  <div className={styles.seal} aria-hidden="true">
                    SOLO
                    <br />
                    PARA
                    <br />
                    TI
                  </div>
                  <div className={styles.who}>
                    <span className={styles.init}>J</span>
                    <div>
                      <b>Javiera Soto</b>
                      <small>le regalas tú</small>
                    </div>
                  </div>
                  <p className={`${styles.cap} ${styles.wishCap}`}>Lo que le gustaría</p>
                  <ul className={styles.wish}>
                    {WISHES.map((w) => (
                      <li key={w.text}>
                        <span>{w.text}</span>
                        {w.link && (
                          <span className="text-hanko font-mono text-[11px]">ver link</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className={styles.chat}>
                    <p className={styles.chatCap}>Pregúntale algo sin que sepa que eres tú</p>
                    <div className={`${styles.bubble} ${styles.q}`}>
                      ¿Prefieres algo para la casa o para ti?
                    </div>
                    <div className={`${styles.bubble} ${styles.a}`}>
                      Para la casa, me cambié hace poco
                    </div>
                    {asked.map((text, i) => (
                      <div key={i} className={`${styles.bubble} ${styles.q}`}>
                        {text}
                      </div>
                    ))}
                    <form className={styles.compose} onSubmit={ask}>
                      <input
                        id="demo-question"
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Escribe tu pregunta"
                        aria-label="Pregunta anónima de ejemplo"
                      />
                      <button type="submit">Enviar</button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
          <span className={styles.homebar} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
