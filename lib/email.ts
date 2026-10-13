import { emailLayout, escapeHtml } from './email-layout'
import { formatName } from './utils'

interface DrawNotificationParams {
  to: string
  recipientName: string
  groupName: string
  groupId: string
}

// Brevo por su API HTTP: el SMTP no es confiable dentro de Cloudflare Workers.
// La clave muere tras 90 dias sin envios; el Worker keepalive manda un latido mensual.
const SENDER = { name: 'GhostSwap', email: 'hello@nvrkth.com' }

export async function sendDrawNotification({
  to,
  recipientName,
  groupName,
  groupId,
}: DrawNotificationParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ghostswap.nvrkth.com'
  const groupUrl = `${appUrl}/groups/${groupId}`

  try {
    const apiKey = process.env.BREVO_API_KEY
    if (!apiKey) throw new Error('BREVO_API_KEY no esta configurada')

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: to, name: recipientName }],
        subject: `Ya hicimos el sorteo de ${groupName}`,
        htmlContent: getEmailTemplate({ recipientName, groupName, groupUrl }),
      }),
    })
    if (!res.ok) throw new Error(`Brevo respondio ${res.status}: ${await res.text()}`)

    const { messageId } = (await res.json()) as { messageId: string }
    console.log('Email sent:', messageId)
    return { success: true, data: { id: messageId } }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error }
  }
}

interface EmailTemplateParams {
  recipientName: string
  groupName: string
  groupUrl: string
}

// Names come from users, so they are escaped before going into the HTML.
export function getEmailTemplate({ recipientName, groupName, groupUrl }: EmailTemplateParams) {
  const name = escapeHtml(formatName(recipientName))
  const group = escapeHtml(groupName)
  return emailLayout({
    label: group,
    title: 'Ya hicimos el sorteo',
    paragraphs: [
      `Hola ${name},`,
      `El sorteo de <strong style="color: #1b1b1a;">${group}</strong> ya está hecho. Entra para ver a quién le regalas y qué le gustaría recibir.`,
    ],
    cta: { text: 'Ver a quién me tocó', href: escapeHtml(groupUrl) },
    note: 'Solo tú puedes ver a quién te tocó. Si no esperabas este correo, puedes ignorarlo.',
  })
}

export async function sendDrawNotifications(
  participants: Array<{ email: string; name: string }>,
  groupName: string,
  groupId: string
) {
  const results = await Promise.allSettled(
    participants.map((participant) =>
      sendDrawNotification({
        to: participant.email,
        recipientName: participant.name,
        groupName,
        groupId,
      })
    )
  )

  const successful = results.filter(
    (r) => r.status === 'fulfilled' && (r.value as { success: boolean }).success
  ).length
  const failed = results.length - successful

  console.log(`Sent ${successful} emails, ${failed} failed for group ${groupId}`)

  return { successful, failed }
}
