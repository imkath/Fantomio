import { describe, it, expect } from 'vitest'
import { getEmailTemplate } from '../email'

describe('draw email', () => {
  it('escapes names that come from users', () => {
    const html = getEmailTemplate({
      recipientName: 'Ana <img src=x onerror=alert(1)>',
      groupName: 'Oficina "2026" & <b>amigos</b>',
      groupUrl: 'https://ghostswap.nvrkth.com/groups/abc',
    })
    expect(html).not.toMatch(/<img [^>]*onerror/i)
    expect(html).not.toContain('<b>amigos</b>')
    expect(html).toContain('Ana &lt;img')
    expect(html).toContain('Oficina &quot;2026&quot; &amp; &lt;b&gt;amigos&lt;/b&gt;')
    expect(html).toContain('href="https://ghostswap.nvrkth.com/groups/abc"')
  })
})
