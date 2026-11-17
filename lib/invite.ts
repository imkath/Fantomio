import { formatMoney } from '@/lib/currency'
import { parseLocalDate } from '@/lib/utils'

// The WhatsApp message that goes with the invite link. It is the first thing the group sees
// of Fantomio, so it says what to do (enter, write a list) and the facts people ask in the
// chat anyway: when and how much. *text* is bold in WhatsApp.
export function inviteMessage(group: {
  name: string
  url: string
  exchangeDate?: string | null
  budget?: number | null
  currency?: string
  blind?: boolean
}): string {
  const date =
    group.exchangeDate &&
    parseLocalDate(group.exchangeDate).toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  const money = group.budget != null ? formatMoney(group.budget, group.currency) : null
  const facts =
    date && money
      ? `El intercambio es el ${date} y el monto es de ${money}.`
      : date
        ? `El intercambio es el ${date}.`
        : money
          ? `El monto es de ${money}.`
          : null

  return [
    `Te invito al amigo secreto de *${group.name}*.`,
    facts,
    group.blind
      ? 'Es a ciegas, así que vas a regalar sin saber a quién, solo por lo que esa persona anotó.'
      : null,
    '',
    'Entra con este link y anota lo que te gustaría recibir. Cuando estemos todos, se hace el sorteo.',
    group.url,
  ]
    .filter((line) => line !== null)
    .join('\n')
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
