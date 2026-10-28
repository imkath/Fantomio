import { createClient, getSessionUser } from '@/lib/supabase'

// One theme preference, whatever switch changed it last. With a session, every choice also goes
// to the account, so a new device can start from it (see AppHeader). Best effort: if saving
// fails, this device still keeps the choice.
export async function saveThemeToAccount(theme: 'light' | 'dark' | 'system') {
  try {
    const user = await getSessionUser()
    if (!user) return
    await createClient().from('profiles').update({ theme }).eq('id', user.id)
  } catch {
    // Offline or signed out mid-way: nothing to undo.
  }
}

// Whether this device has ever picked a theme (next-themes keeps it under "theme").
export function deviceHasTheme(): boolean {
  try {
    return localStorage.getItem('theme') !== null
  } catch {
    return true
  }
}
