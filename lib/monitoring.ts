// Error reports to Sentry (EU region), so a broken screen is noticed before someone writes about
// it. Only what is needed to find the bug leaves the browser: no IP, cookies, headers, bodies,
// query strings or user, and emails and links with codes are scrubbed from messages. The SDK is
// loaded after the page is up, so it adds nothing to the first load. Without a DSN (local dev,
// previews) nothing is sent.

import type { Breadcrumb, ErrorEvent } from '@sentry/browser'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
const EMAIL = /[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}/gi

let started = false

// Invite codes, merge codes and tokens travel in the query or the hash.
const stripUrl = (url: string) => url.split(/[?#]/)[0]
const scrubText = (text: string) =>
  text.replace(EMAIL, '[correo]').replace(/https?:\/\/[^\s"']+/g, stripUrl)

function scrubEvent(event: ErrorEvent): ErrorEvent {
  // An explicit null keeps Sentry from filling in the connection's IP (and a location from it).
  event.user = { ip_address: null }
  if (event.request) {
    event.request = { url: event.request.url && stripUrl(event.request.url) }
  }
  if (event.message) event.message = scrubText(event.message)
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value)
    // Code that runs inline on the page reports the page's full URL as its file name.
    for (const frame of ex.stacktrace?.frames ?? []) {
      if (frame.filename) frame.filename = stripUrl(frame.filename)
      if (frame.abs_path) frame.abs_path = stripUrl(frame.abs_path)
    }
  }
  return event
}

function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (crumb.message) crumb.message = scrubText(crumb.message)
  if (crumb.data) {
    for (const key of ['url', 'from', 'to']) {
      if (typeof crumb.data[key] === 'string') crumb.data[key] = stripUrl(crumb.data[key])
    }
  }
  return crumb
}

export function startErrorMonitoring() {
  if (!DSN || started) return
  started = true
  import('./monitoring-sdk')
    .then(({ init }) =>
      init({
        dsn: DSN,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          genAI: { inputs: false, outputs: false },
          databaseQueryData: false,
          graphQL: { document: false, variables: false },
        },
        // No console breadcrumbs (they can carry anything) and no session pings: errors only.
        integrations: (all) =>
          all.filter((i) => i.name !== 'Console' && i.name !== 'BrowserSession'),
        beforeSend: scrubEvent,
        beforeBreadcrumb: scrubBreadcrumb,
      })
    )
    .catch(() => {
      // Blocked by an extension or offline: the app works the same.
    })
}
