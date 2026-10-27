// A starting currency for a new group, guessed from the device so nobody in Mexico opens the form
// on Chilean pesos. Nothing leaves the browser: no IP lookup, no paid service. The time zone says
// where the device is, which beats the language (plenty of people in Chile browse in es-ES or
// English); the language region is the fallback. Anything else starts on dollars. It is only a
// preselection: the select stays open to change.

export type CurrencyCode = 'CLP' | 'USD' | 'EUR' | 'MXN' | 'ARS' | 'COP' | 'PEN' | 'BRL' | 'GBP'

const EURO_COUNTRIES =
  'AT BE HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME XK'.split(' ')

const BY_COUNTRY: Record<string, CurrencyCode> = {
  CL: 'CLP',
  MX: 'MXN',
  AR: 'ARS',
  CO: 'COP',
  PE: 'PEN',
  BR: 'BRL',
  GB: 'GBP',
  ...Object.fromEntries(EURO_COUNTRIES.map((c) => [c, 'EUR' as const])),
}

// Time zones of the countries whose currency the app supports (IANA names, including the
// older aliases some devices still report).
const BY_ZONE: Record<string, CurrencyCode> = {
  'America/Santiago': 'CLP',
  'America/Punta_Arenas': 'CLP',
  'Pacific/Easter': 'CLP',
  'Chile/Continental': 'CLP',
  'America/Bogota': 'COP',
  'America/Lima': 'PEN',
  'Europe/London': 'GBP',
}
const MEXICO =
  /^America\/(Mexico_City|Cancun|Merida|Monterrey|Matamoros|Chihuahua|Ciudad_Juarez|Ojinaga|Hermosillo|Mazatlan|Bahia_Banderas|Tijuana)$|^Mexico\//
const BRAZIL =
  /^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Maceio|Belem|Araguaina|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Eirunepe|Santarem|Noronha)$|^Brazil\//
const EURO_ZONES =
  /^Europe\/(Madrid|Paris|Berlin|Rome|Lisbon|Amsterdam|Brussels|Vienna|Dublin|Helsinki|Athens|Luxembourg|Valletta|Bratislava|Ljubljana|Zagreb|Tallinn|Riga|Vilnius|Monaco|Andorra|San_Marino|Vatican|Podgorica|Busingen)$|^Atlantic\/(Canary|Madeira|Azores)$|^Africa\/Ceuta$/

export function guessCurrency(
  timeZone: string | undefined,
  languages: readonly string[]
): CurrencyCode {
  if (timeZone) {
    if (BY_ZONE[timeZone]) return BY_ZONE[timeZone]
    if (timeZone.startsWith('America/Argentina/') || timeZone === 'America/Buenos_Aires')
      return 'ARS'
    if (MEXICO.test(timeZone)) return 'MXN'
    if (BRAZIL.test(timeZone)) return 'BRL'
    if (EURO_ZONES.test(timeZone)) return 'EUR'
  }
  for (const lang of languages) {
    const region = lang.split('-')[1]?.toUpperCase()
    if (region && BY_COUNTRY[region]) return BY_COUNTRY[region]
  }
  return 'USD'
}

export function deviceCurrency(): CurrencyCode {
  if (typeof window === 'undefined') return 'USD'
  let zone: string | undefined
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    // Very old browsers: fall through to the language.
  }
  return guessCurrency(zone, navigator.languages ?? [navigator.language])
}
