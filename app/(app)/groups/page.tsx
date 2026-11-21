'use client'

import { groupPath } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import {
  Check,
  Crown,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Link2,
  Loader2,
  LogOut,
  MessageCircle,
  Pencil,
  Repeat,
  RotateCcw,
  Shuffle,
  UserMinus,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import GroupLoading from './loading'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/breadcrumbs'
import type { GroupMode } from '@/components/group/mode-picker'
import { BlindAssignment, BlindListsNotice, BlindResults } from '@/components/group/blind'
import {
  ArchiveButton,
  ArchivedNotice,
  EditionHistory,
  HideButton,
  PendingInvitations,
  RevealedGiver,
  RevealYourself,
} from '@/components/group/editions'
import { createClient, getSessionUser } from '@/lib/supabase'
import { clearGroupCache, readGroupCache, writeGroupCache } from '@/lib/group-cache'
import { drawNames, resetDraw } from '@/lib/actions/draw'
import {
  deleteGroup,
  leaveGroup,
  getGroupActivities,
  removeMember,
  transferGroup,
} from '@/lib/actions/group'
import { RateApp } from '@/components/rate-app'
import { getExclusions } from '@/lib/actions/exclusions'
import { forcedGivers } from '@/lib/guessable'
import { OrganizeYourOwn } from '@/components/group/organize-your-own'
import { inviteMessage, whatsappUrl } from '@/lib/invite'
import { GhostMark } from '@/components/ghost-mark'
import { GhostAvatar } from '@/components/ghost-avatar'
import { celebrate } from '@/lib/confetti'
import { Notice } from '@/components/auth-shell'
import { WishlistEditor } from '@/components/wishlist-editor'
import { GroupPageSkeleton } from '@/components/skeletons'
import { GroupInfoCard } from '@/components/group-info-card'
import { ExclusionsManager } from '@/components/exclusions-manager'
import { AnonymousChat } from '@/components/anonymous-chat'
import { formatName, todayIn } from '@/lib/utils'
import type { PlaceKind } from '@/lib/place'
import { toast } from 'sonner'
import type { Activity } from '@/components/group/group-dialogs'
import { useOpenedOnce } from '@/hooks/use-opened-once'

// Dialogs load the first time one opens: none of them is needed to draw the group.
const dialogs = () => import('@/components/group/group-dialogs')
const DrawConfirmDialog = dynamic(() => dialogs().then((m) => m.DrawConfirmDialog))
const MissingListsDialog = dynamic(() => dialogs().then((m) => m.MissingListsDialog))
const EditGroupDialog = dynamic(() => dialogs().then((m) => m.EditGroupDialog))
const DeleteGroupDialog = dynamic(() => dialogs().then((m) => m.DeleteGroupDialog))
const LeaveGroupDialog = dynamic(() => dialogs().then((m) => m.LeaveGroupDialog))
const RemoveMemberDialog = dynamic(() => dialogs().then((m) => m.RemoveMemberDialog))
const TransferDialog = dynamic(() => dialogs().then((m) => m.TransferDialog))
const ResetDrawDialog = dynamic(() => dialogs().then((m) => m.ResetDrawDialog))
const ActivityDialog = dynamic(() => dialogs().then((m) => m.ActivityDialog))
const RepeatGroupDialog = dynamic(() => dialogs().then((m) => m.RepeatGroupDialog))

interface Member {
  id: string
  user_id: string
  // null: hidden (a blind group shows only your own and the total)
  hasList: boolean | null
  is_admin: boolean
  hidden: boolean
  profile: {
    full_name: string | null
    avatar_url: string | null
  }
}

interface Match {
  id: string
  receiver_id: string
  receiver: {
    full_name: string | null
    avatar_url: string | null
  }
  receiver_wishlist: Array<{ description: string; url?: string }>
  revealed: boolean
}

interface Group {
  id: string
  name: string
  budget: number | null
  currency: string
  exchange_date: string | null
  status: 'PLANNING' | 'DRAWN'
  invite_code: string
  admin_id: string
  archived_at: string | null
  previous_group_id: string | null
  mode: GroupMode
  reveal_at: string | null
  revealed_at: string | null
  time_zone: string
  place_kind: PlaceKind | null
  place_name: string | null
  place_detail: string | null
}

type Items = Array<{ description: string; url?: string }>

// Everything the page draws from its main load; also what is kept for the next visit.
interface GroupSnapshot {
  group: Group
  members: Member[]
  myWishlist: Items
  match: Match | null
  missingLists: string[]
  listCount: { with_list: number; total: number } | null
}

// Errors that mean "this group isn't there for you" (no row under RLS, or a malformed id).
const NOT_FOUND_CODES = new Set(['PGRST116', '22P02'])

function GroupPage() {
  const params = useSearchParams()
  const router = useRouter()
  const groupId = params.get('id') ?? ''

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentMember, setCurrentMember] = useState<Member | null>(null)
  const [myWishlist, setMyWishlist] = useState<Array<{ description: string; url?: string }>>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  // On screen is last visit's copy (see lib/group-cache.ts): nothing can be changed until the
  // real data arrives, so no action runs on old data.
  const [stale, setStale] = useState(false)
  // The group whose real data has already arrived; the cache is only for the first paint.
  const freshFor = useRef<string | null>(null)
  // The group's mode as last seen (cache or real data), to ask for blind-only data up front.
  const knownMode = useRef<{ groupId: string; mode: GroupMode } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)

  // Match reveal state
  const [match, setMatch] = useState<Match | null>(null)
  const [showMatch, setShowMatch] = useState(false)
  const [showDrawConfirm, setShowDrawConfirm] = useState(false)
  // People whose pair anyone who knows the exclusions could work out (see lib/guessable.ts).
  const [guessable, setGuessable] = useState<string[]>([])
  // For the organizer only: the start of each member's email, to tell namesakes apart.
  const [emailHints, setEmailHints] = useState<Map<string, string>>(new Map())
  const [avoidPrevious, setAvoidPrevious] = useState(true)
  const [missingLists, setMissingLists] = useState<string[]>([])
  const [showMissingLists, setShowMissingLists] = useState(false)
  const [listCount, setListCount] = useState<{ with_list: number; total: number } | null>(null)
  const wasHidden = useRef<boolean | null>(null)
  const [showRepeat, setShowRepeat] = useState(false)

  // Group management dialogs
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [showActivityDialog, setShowActivityDialog] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)

  // Bumped on every open, so the edit form starts again from the group as it is.
  const [editKey, setEditKey] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null)
  const [showRemoveMemberDialog, setShowRemoveMemberDialog] = useState(false)
  const [newOrganizer, setNewOrganizer] = useState<{ userId: string; name: string } | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const applySnapshot = useCallback((s: GroupSnapshot, userId: string) => {
    knownMode.current = { groupId: s.group.id, mode: s.group.mode }
    setGroup(s.group)
    setIsAdmin(s.group.admin_id === userId)
    setMembers(s.members)
    setCurrentMember(s.members.find((m) => m.user_id === userId) ?? null)
    setMyWishlist(s.myWishlist)
    setMatch(s.match)
    setMissingLists(s.missingLists)
    setListCount(s.listCount)
    // After a blind reveal there's nothing left to uncover: show the person right away.
    if (s.group.mode === 'blind' && s.group.revealed_at && s.group.status === 'DRAWN') {
      setShowMatch(true)
    }
  }, [])

  const fetchGroupData = useCallback(async () => {
    const supabase = createClient()
    let showingCache = false

    try {
      const user = await getSessionUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserId(user.id)

      // Coming back to a group: draw last visit's copy now, and replace it when the real data
      // arrives. Only this user's copy, and only until the first real answer for this group.
      if (freshFor.current !== groupId) {
        const cached = readGroupCache<GroupSnapshot>(groupId, user.id)
        if (cached) {
          // The match is never cached: it only shows with the real answer.
          applySnapshot({ ...cached, match: null }, user.id)
          setStale(true)
          setIsLoading(false)
          showingCache = true
        }
      }

      // One round trip: group, members, lists and (if any) my match load in parallel.
      // The match query simply returns nothing until the group is drawn. Wishlists come back
      // filtered by the database: mine and, after the draw, the one of the person I give to.
      // For everyone else we only learn whether they wrote one (wishlist_status).
      // A blind group also needs who's missing a list and how many wrote one. Unless this group
      // is known to be classic, those go in the same trip and are dropped if it isn't blind
      // (blind_missing_lists answers empty once the group is drawn).
      const blindData = () =>
        Promise.all([
          supabase.rpc('blind_missing_lists', { p_group_id: groupId }),
          supabase.rpc('wishlist_count', { p_group_id: groupId }),
        ])
      const knownClassic =
        knownMode.current?.groupId === groupId && knownMode.current.mode !== 'blind'
      const [groupRes, membersRes, matchRes, listsRes, statusRes, earlyBlindRes] =
        await Promise.all([
          supabase.from('groups').select('*').eq('id', groupId).single(),
          supabase
            .from('members')
            .select('id, user_id, is_admin, hidden_at, profiles:user_id (full_name, avatar_url)')
            .eq('group_id', groupId),
          supabase
            .from('matches')
            .select('id, receiver_id, revealed_at, receiver:receiver_id (full_name, avatar_url)')
            .eq('group_id', groupId)
            .eq('giver_id', user.id)
            .maybeSingle(),
          supabase.from('wishlists').select('user_id, items').eq('group_id', groupId),
          supabase.rpc('wishlist_status', { p_group_id: groupId }),
          knownClassic ? null : blindData(),
        ])

      const groupData = groupRes.data as Group | null
      if (groupRes.error && !NOT_FOUND_CODES.has(groupRes.error.code)) throw groupRes.error
      if (!groupData) {
        // Gone, or no longer ours: the real answer wins over the copy.
        clearGroupCache(groupId, user.id)
        setStale(false)
        setGroup(null)
        setError('Grupo no encontrado')
        return
      }

      let missing: string[] = []
      let listCount: GroupSnapshot['listCount'] = null
      if (groupData.mode === 'blind') {
        // Only a group that just turned blind (it was classic last time) needs a second trip.
        const [missingRes, countRes] = earlyBlindRes ?? (await blindData())
        missing = groupData.status === 'PLANNING' ? ((missingRes.data ?? []) as string[]) : []
        listCount = countRes.data as { with_list: number; total: number }
        // Confetti for everyone watching when the blind draw is revealed.
        const hidden = !groupData.revealed_at
        if (wasHidden.current === true && !hidden) celebrate()
        wasHidden.current = hidden
      }

      const lists = new Map<string, Items>(
        (listsRes.data ?? []).map((w) => [w.user_id as string, (w.items ?? []) as Items])
      )
      const listStatus = new Map(
        ((statusRes.data ?? []) as Array<{ user_id: string; has_items: boolean | null }>).map(
          (s) => [s.user_id, s.has_items] as const
        )
      )
      const withList = new Set(
        ((statusRes.data ?? []) as Array<{ user_id: string; has_items: boolean | null }>)
          .filter((s) => s.has_items)
          .map((s) => s.user_id)
      )

      const formattedMembers: Member[] = (membersRes.data ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        hasList: listStatus.get(m.user_id) ?? (withList.has(m.user_id) ? true : null),
        is_admin: m.is_admin,
        hidden: !!m.hidden_at,
        profile: (() => {
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
          return { ...p, full_name: formatName(p?.full_name) || null }
        })(),
      }))

      const matchData = groupData.status === 'DRAWN' ? matchRes.data : null
      const snapshot: GroupSnapshot = {
        group: groupData,
        members: formattedMembers,
        myWishlist: lists.get(user.id) ?? [],
        match: matchData
          ? {
              id: matchData.id,
              receiver_id: matchData.receiver_id,
              receiver: (() => {
                const r = matchData.receiver as unknown as {
                  full_name: string | null
                  avatar_url: string | null
                }
                return { ...r, full_name: formatName(r.full_name) || null }
              })(),
              receiver_wishlist: lists.get(matchData.receiver_id) ?? [],
              revealed: !!matchData.revealed_at,
            }
          : null,
        missingLists: missing,
        listCount,
      }

      applySnapshot(snapshot, user.id)
      freshFor.current = groupId
      setStale(false)
      if (formattedMembers.some((m) => m.user_id === user.id)) {
        writeGroupCache(groupId, user.id, snapshot)
      } else {
        clearGroupCache(groupId, user.id)
      }
    } catch {
      // With last visit's copy on screen it stays visible but locked, and says why.
      setError(
        showingCache
          ? 'No pudimos actualizar el grupo. Lo que ves es de tu última visita: recarga la página para intentarlo de nuevo.'
          : 'Error al cargar el grupo'
      )
    } finally {
      setIsLoading(false)
    }
  }, [groupId, router, applySnapshot])

  useEffect(() => {
    fetchGroupData()
  }, [fetchGroupData])

  // Real-time subscription to group changes
  useEffect(() => {
    const supabase = createClient()

    // Subscribe to changes in the group's status
    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'groups',
          filter: `id=eq.${groupId}`,
        },
        (payload) => {
          // When group is updated (e.g., status changed to DRAWN), refresh data
          const newGroup = payload.new as Group
          if (newGroup.status !== group?.status || newGroup.revealed_at !== group?.revealed_at) {
            fetchGroupData()
            if (newGroup.status === 'DRAWN' && group?.status !== 'DRAWN') {
              toast.success('Ya se hizo el sorteo')
            } else if (newGroup.revealed_at && !group?.revealed_at) {
              toast.success('¡Se reveló el sorteo!')
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // fetchGroupData es estable mientras no cambie el grupo, así que incluirla
    // no provoca resuscripciones extra al canal de realtime.
  }, [groupId, group?.status, group?.revealed_at, fetchGroupData])

  const handleDraw = async () => {
    if (!group) return
    setShowDrawConfirm(false)
    setIsDrawing(true)
    setError('')

    const result = await drawNames(group.id, !!group.previous_group_id && avoidPrevious)

    if (!result.success) {
      setError(result.error || 'Error al realizar el sorteo')
      toast.error('Error al realizar el sorteo')
    } else {
      toast.success('Sorteo listo. Cada quien ya puede ver a quién le tocó.')
      // Reload data to get match
      await fetchGroupData()
    }

    setIsDrawing(false)
  }

  useEffect(() => {
    if (!showDrawConfirm) return setGuessable([])
    let cancelled = false
    getExclusions(groupId).then((res) => {
      if (cancelled || !res.success || !res.exclusions?.length) return
      const ids = members.map((m) => m.user_id)
      const forced = forcedGivers(
        ids,
        res.exclusions.map((e) => ({ giver: e.giver_id, receiver: e.excluded_receiver_id }))
      )
      setGuessable(
        forced.map((id) => members.find((m) => m.user_id === id)?.profile.full_name || 'Sin nombre')
      )
    })
    return () => {
      cancelled = true
    }
  }, [showDrawConfirm, groupId, members])

  useEffect(() => {
    if (!isAdmin) return
    createClient()
      .rpc('group_email_hints', { p_group_id: groupId })
      .then(({ data }) => {
        const rows = (data ?? []) as Array<{ user_id: string; hint: string }>
        setEmailHints(new Map(rows.map((r) => [r.user_id, r.hint])))
      })
  }, [isAdmin, groupId, members.length])

  // Names shared by two or more members (compared without case or extra spaces).
  const sameName = (name: string | null) => (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  const repeatedNames = Array.from(
    members.reduce((seen, m) => {
      const key = sameName(m.profile.full_name)
      seen.set(key, (seen.get(key) ?? 0) + 1)
      return seen
    }, new Map<string, number>())
  )
    .filter(([key, n]) => key && n > 1)
    .map(([key]) => members.find((m) => sameName(m.profile.full_name) === key)!.profile.full_name!)
  const myName = members.find((m) => m.user_id === currentUserId)?.profile.full_name ?? null
  const iShareMyName = !!myName && repeatedNames.some((n) => sameName(n) === sameName(myName))

  const handleShare = async () => {
    if (!group) return
    const inviteUrl = `${window.location.origin}/join?code=${group.invite_code}`

    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success('Link copiado')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = inviteUrl
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      toast.success('Link copiado')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenEdit = () => {
    if (!group) return
    setEditKey((k) => k + 1)
    setShowEditDialog(true)
  }

  const handleDelete = async () => {
    if (!group) return
    setIsDeleting(true)

    const result = await deleteGroup(group.id)

    if (result.success) {
      toast.success('Grupo eliminado')
      router.push('/dashboard')
    } else {
      toast.error(result.error || 'Error al eliminar')
      setIsDeleting(false)
    }
  }

  const handleLeave = async () => {
    if (!group) return
    setIsLeaving(true)

    const result = await leaveGroup(group.id)

    if (result.success) {
      toast.success('Saliste del grupo')
      router.push('/dashboard')
    } else {
      toast.error(result.error || 'Error al abandonar')
      setIsLeaving(false)
    }
  }

  const handleShowActivity = async () => {
    setShowActivityDialog(true)
    setIsLoadingActivities(true)

    const result = await getGroupActivities(groupId)

    if (result.success) {
      setActivities(result.activities as typeof activities)
    } else {
      toast.error(result.error || 'Error al cargar actividades')
    }

    setIsLoadingActivities(false)
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return
    setRemovingMemberId(memberToRemove.id)

    const result = await removeMember(groupId, memberToRemove.id)

    if (result.success) {
      toast.success('Persona quitada del grupo')
      setShowRemoveMemberDialog(false)
      setMemberToRemove(null)
      await fetchGroupData()
    } else {
      toast.error(result.error || 'Error al eliminar miembro')
    }

    setRemovingMemberId(null)
  }

  const handleTransfer = async () => {
    if (!newOrganizer) return
    setIsTransferring(true)

    const result = await transferGroup(groupId, newOrganizer.userId)

    if (result.success) {
      toast.success(`Ahora organiza ${newOrganizer.name}`)
      setNewOrganizer(null)
      await fetchGroupData()
    } else {
      toast.error(result.error || 'No pudimos pasar la organización')
    }

    setIsTransferring(false)
  }

  const handleRevealMatch = () => {
    setShowMatch(true)
    celebrate()
  }

  const handleResetDraw = async () => {
    if (!group) return
    setIsResetting(true)

    const result = await resetDraw(group.id)

    if (result.success) {
      toast.success('Sorteo reiniciado')
      setShowResetDialog(false)
      setShowMatch(false)
      setMatch(null)
      await fetchGroupData()
    } else {
      toast.error(result.error || 'Error al reiniciar el sorteo')
    }

    setIsResetting(false)
  }

  const drawOpened = useOpenedOnce(showDrawConfirm)
  const repeatOpened = useOpenedOnce(showRepeat)
  const missingOpened = useOpenedOnce(showMissingLists)
  const editOpened = useOpenedOnce(showEditDialog)
  const deleteOpened = useOpenedOnce(showDeleteDialog)
  const leaveOpened = useOpenedOnce(showLeaveDialog)
  const removeOpened = useOpenedOnce(showRemoveMemberDialog)
  const transferOpened = useOpenedOnce(!!newOrganizer)
  const resetOpened = useOpenedOnce(showResetDialog)
  const activityOpened = useOpenedOnce(showActivityDialog)

  if (isLoading) {
    return (
      <div className="bg-paper min-h-[calc(100vh-69px)]">
        <main className="mx-auto max-w-[1040px] px-4 py-10 md:px-8">
          <GroupPageSkeleton />
        </main>
      </div>
    )
  }

  if (error && !group) {
    return (
      <div className="bg-paper text-ink min-h-[calc(100vh-69px)]">
        <main className="mx-auto max-w-[520px] px-4 py-16">
          <h1 className="mb-2 text-[34px] leading-tight font-light">No pudimos abrir este grupo</h1>
          <p className="text-graphite mb-8">{error}</p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Volver a mis grupos</Link>
          </Button>
        </main>
      </div>
    )
  }

  if (!group) return null

  const drawn = group.status === 'DRAWN'
  // A keepsake: everything shows, nothing changes (the database enforces it too).
  const archived = !!group.archived_at
  // The group's calendar, the same one the database uses to allow the reveal.
  const today = todayIn(group.time_zone)
  const exchangeDone = archived || (!!group.exchange_date && group.exchange_date <= today)
  const blind = group.mode === 'blind'
  const blindHidden = blind && !group.revealed_at
  const blindBlocked = blind && missingLists.length > 0

  return (
    <div className="bg-paper text-ink min-h-[calc(100vh-69px)] pb-16">
      <main className="mx-auto max-w-[1040px] px-4 pt-8 pb-10 md:px-8">
        <Breadcrumbs items={[{ label: 'Mis grupos', href: '/dashboard' }, { label: group.name }]} />

        {error && (
          <div className="mt-6">
            <Notice>{error}</Notice>
          </div>
        )}

        {/* Last visit's copy: readable at once, but every button waits for the real data. */}
        <div inert={stale} aria-busy={stale}>
          {/* Header */}
          <div className="mt-6 mb-10 flex flex-col justify-between gap-6 min-[1440px]:mt-0 md:flex-row md:items-end">
            <div className="min-w-0">
              <p className="text-graphite mb-2 text-[15px]">
                {blind && 'A ciegas · '}
                {archived ? 'Archivado' : drawn ? 'Sorteado' : 'Sin sortear'} · {members.length}{' '}
                {members.length === 1 ? 'persona' : 'personas'}
              </p>
              <h1 className="text-[34px] leading-tight font-light break-words md:text-[44px]">
                {group.name}
              </h1>
            </div>

            <div className={`flex flex-wrap items-center gap-3 ${archived ? 'hidden' : ''}`}>
              {!drawn && (
                // The invite is how a whole group meets Fantomio: a ready message, not a bare link.
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(
                      whatsappUrl(
                        inviteMessage({
                          name: group.name,
                          url: `${window.location.origin}/join?code=${group.invite_code}`,
                          exchangeDate: group.exchange_date,
                          budget: group.budget,
                          currency: group.currency,
                          blind,
                        })
                      ),
                      '_blank',
                      'noopener'
                    )
                  }
                >
                  <MessageCircle aria-hidden="true" />
                  Invitar por WhatsApp
                </Button>
              )}
              <Button variant="outline" onClick={handleShare}>
                {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                {copied ? 'Link copiado' : 'Copiar link de invitación'}
              </Button>
              {isAdmin && drawn && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const groupUrl = `${window.location.origin}${groupPath(group.id)}`
                    const text = `Ya hicimos el sorteo de *${group.name}*.\n\nEntra para ver a quién le regalas:\n${groupUrl}`
                    window.open(whatsappUrl(text), '_blank', 'noopener')
                  }}
                >
                  <MessageCircle aria-hidden="true" />
                  Avisar por WhatsApp
                </Button>
              )}
              {isAdmin && !drawn && members.length >= 3 && (
                // Never a silently disabled button: if lists are missing, tapping explains why.
                <Button
                  onClick={() =>
                    blindBlocked ? setShowMissingLists(true) : setShowDrawConfirm(true)
                  }
                  disabled={isDrawing}
                >
                  {isDrawing ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Shuffle aria-hidden="true" />
                  )}
                  Hacer el sorteo
                </Button>
              )}
            </div>
          </div>

          {archived && (
            <ArchivedNotice groupId={group.id} isAdmin={isAdmin} onChange={fetchGroupData} />
          )}

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            {/* Main column */}
            <div className="min-w-0 space-y-8">
              {!drawn && (
                <section className="border-rule bg-slip rounded-[4px] border p-6 md:p-8">
                  <p className="text-graphite mb-3 text-[15px] font-medium">Tu amigo secreto</p>
                  <div className="flex items-start gap-5">
                    <GhostMark className="text-ink h-[46px] w-[40px] shrink-0" />
                    <div>
                      <h2 className="mb-1 text-xl font-bold">Todavía no hay sorteo</h2>
                      <p className="text-graphite">
                        {isAdmin
                          ? members.length < 3
                            ? `Hacen falta al menos 3 personas para sortear. Van ${members.length}. Comparte el link para que se sumen.`
                            : 'Cuando estén todos, aprieta "Hacer el sorteo". A cada quien le aparecerá aquí su persona.'
                          : 'Cuando estén todos, quien organiza hará el sorteo y aquí verás a quién le regalas.'}
                      </p>
                      {blind && (
                        <div className="mt-3">
                          <BlindListsNotice missing={missingLists} isAdmin={isAdmin} />
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {drawn && blindHidden && (
                <BlindAssignment
                  groupId={groupId}
                  people={members
                    .filter((m) => m.user_id !== currentUserId)
                    .map((m) => ({
                      id: m.user_id,
                      name: m.profile.full_name || 'Sin nombre',
                    }))}
                  revealAt={group.reveal_at}
                  isAdmin={isAdmin}
                  onRevealed={fetchGroupData}
                />
              )}
              {drawn && blind && !blindHidden && <BlindResults groupId={groupId} />}

              {drawn && stale && !blindHidden && (
                // Who you give to is never kept in this browser: it waits for the real data.
                <section
                  className="border-rule bg-raised rounded-[4px] border p-6 md:p-8"
                  aria-busy="true"
                >
                  <p className="text-graphite mb-3 text-[15px] font-medium">Tu amigo secreto</p>
                  <div className="flex justify-center py-8">
                    <Loader2 className="text-faint h-6 w-6 animate-spin" aria-hidden="true" />
                    <span className="sr-only">Cargando tu sorteo</span>
                  </div>
                </section>
              )}
              {drawn && match && (
                <section className="border-rule bg-raised relative rounded-[4px] border p-6 md:p-8">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-graphite text-[15px] font-medium">Tu amigo secreto</p>
                    {showMatch && (
                      <Button variant="outline" size="sm" onClick={() => setShowMatch(false)}>
                        <EyeOff aria-hidden="true" />
                        Ocultar
                      </Button>
                    )}
                  </div>

                  {!showMatch ? (
                    <div className="grid justify-items-center gap-4 py-6 text-center">
                      <GhostMark className="text-ink h-[74px] w-[64px]" />
                      <p className="text-graphite">
                        El sorteo ya está hecho.
                        <br />
                        ¿Vemos a quién te tocó?
                      </p>
                      <Button size="lg" onClick={handleRevealMatch}>
                        <Eye aria-hidden="true" />
                        Ver a quién me tocó
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-7">
                      <div className="reveal-pop flex items-center gap-5">
                        <GhostAvatar
                          seed={match.receiver_id}
                          src={match.receiver.avatar_url}
                          size={76}
                        />
                        <div className="min-w-0">
                          <p className="text-[28px] leading-tight font-bold break-words">
                            {match.receiver.full_name || 'Sin nombre'}
                          </p>
                          <p className="text-graphite text-[17px]">Le regalas tú</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-graphite mb-3 text-[15px] font-medium">
                          Lo que le gustaría
                        </p>
                        {match.receiver_wishlist.length > 0 ? (
                          <ul className="grid gap-2">
                            {match.receiver_wishlist.map((item, index) => (
                              <li
                                key={index}
                                className="bg-slip flex items-baseline justify-between gap-4 rounded-[3px] px-4 py-3"
                              >
                                <span className="min-w-0 break-words">
                                  {String(item.description ?? '')}
                                </span>
                                {typeof item.url === 'string' && item.url && (
                                  <a
                                    href={
                                      item.url.startsWith('http') ? item.url : `https://${item.url}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-hanko inline-flex shrink-0 items-center gap-1.5 text-[15px] underline underline-offset-[3px]"
                                    title={item.url}
                                  >
                                    Ver link
                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-graphite bg-slip rounded-[3px] px-4 py-3">
                            Todavía no anota nada. Puedes preguntarle abajo, sin que sepa que eres
                            tú.
                          </p>
                        )}
                      </div>

                      {exchangeDone && (
                        <RevealYourself
                          groupId={groupId}
                          receiverName={match.receiver.full_name || 'Sin nombre'}
                          revealed={match.revealed}
                          onChange={fetchGroupData}
                        />
                      )}

                      {!archived && (
                        <AnonymousChat
                          matchId={match.id}
                          groupId={groupId}
                          role="giver"
                          receiverName={match.receiver.full_name || undefined}
                        />
                      )}
                    </div>
                  )}
                </section>
              )}
              {drawn && match && showMatch && <RateApp />}

              {/* Anonymous messages received (someone is asking YOU) */}
              {drawn && !archived && (
                <AnonymousChat matchId={null} groupId={groupId} role="receiver" />
              )}
              {drawn && exchangeDone && <RevealedGiver groupId={groupId} />}
              {drawn && (exchangeDone || (blind && !!group.revealed_at)) && <OrganizeYourOwn />}

              {currentMember && (
                <section className="border-rule rounded-[4px] border p-6 md:p-8">
                  {blind && !drawn && !archived && myWishlist.length === 0 && (
                    <div className="mb-6">
                      <Notice tone="ok">
                        Este es un sorteo a ciegas: quien te regale solo va a tener tu lista como
                        pista. Anota al menos una cosa, porque sin las listas de todos no se puede
                        sortear.
                      </Notice>
                    </div>
                  )}
                  {/* The editor only starts from the real list: a draft kept in this browser is
                    matched against it, and it saves on its own. */}
                  {archived || stale ? (
                    <div>
                      <h2 className="text-xl font-bold">Tu lista</h2>
                      {myWishlist.length ? (
                        <ul className="mt-4 grid gap-2">
                          {myWishlist.map((item, i) => (
                            <li key={i} className="bg-slip rounded-[3px] px-4 py-3 break-words">
                              {String(item.description ?? '')}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-graphite mt-2">
                          {stale ? 'Cargando tu lista…' : 'No anotaste nada esta vez.'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <WishlistEditor
                      // A fresh editor per group and person, so an unsaved list never follows
                      // someone to another group.
                      key={`${groupId}:${currentMember.user_id}`}
                      groupId={groupId}
                      userId={currentMember.user_id}
                      initialItems={myWishlist}
                      previousGroupId={group.previous_group_id}
                      onSave={fetchGroupData}
                    />
                  )}
                </section>
              )}

              {group.previous_group_id && <EditionHistory groupId={groupId} />}
            </div>

            {/* Sidebar */}
            <aside className="min-w-0 space-y-8">
              <GroupInfoCard
                budget={group.budget}
                currency={group.currency}
                exchangeDate={group.exchange_date}
                timeZone={group.time_zone}
                place={
                  group.place_kind
                    ? { kind: group.place_kind, name: group.place_name, detail: group.place_detail }
                    : null
                }
                inviteCode={archived ? undefined : group.invite_code}
              />

              {/* The group's actions come before the list, so they don't sink below a long group. */}
              <div className="grid gap-2">
                <Button variant="outline" className="justify-start" onClick={handleShowActivity}>
                  <History aria-hidden="true" />
                  Ver lo que ha pasado en el grupo
                </Button>
                {isAdmin && drawn && (
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => setShowRepeat(true)}
                  >
                    <Repeat aria-hidden="true" />
                    Repetir con las mismas personas
                  </Button>
                )}
                {isAdmin && !archived && (
                  <Button variant="outline" className="justify-start" onClick={handleOpenEdit}>
                    <Pencil aria-hidden="true" />
                    Editar grupo
                  </Button>
                )}
                {isAdmin && !archived && (
                  <ExclusionsManager
                    groupId={groupId}
                    members={members}
                    isAdmin={isAdmin}
                    isDrawn={drawn}
                  />
                )}
                {isAdmin && drawn && !archived && (
                  <Button
                    variant="danger"
                    className="justify-start"
                    onClick={() => setShowResetDialog(true)}
                  >
                    <RotateCcw aria-hidden="true" />
                    Reiniciar el sorteo
                  </Button>
                )}
                {!isAdmin && !drawn && !archived && (
                  <Button
                    variant="danger"
                    className="justify-start"
                    onClick={() => setShowLeaveDialog(true)}
                  >
                    <LogOut aria-hidden="true" />
                    Salir del grupo
                  </Button>
                )}
                {isAdmin && !archived && drawn && (
                  <ArchiveButton groupId={group.id} onChange={fetchGroupData} />
                )}
                {currentMember && (
                  <HideButton
                    groupId={group.id}
                    hidden={currentMember.hidden}
                    onChange={fetchGroupData}
                  />
                )}
              </div>

              <section className="border-rule rounded-[4px] border p-6">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="flex items-center gap-2.5 text-lg font-bold">
                    <GhostMark className="h-[22px] w-[19px]" />
                    Participantes
                  </h2>
                  <span className="text-graphite text-[15px]">{members.length}</span>
                </div>
                <p className="text-graphite mb-4 text-[15px]">
                  {blind && listCount ? (
                    // Per person would let a giver guess an empty list by elimination.
                    <>
                      {listCount.with_list} de {listCount.total} ya anotaron su lista
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">✓</span> Ya anotó su lista
                    </>
                  )}
                </p>
                {iShareMyName && !archived && (
                  <div className="mb-4">
                    <Notice tone="ok">
                      Hay otra persona llamada {myName} en el grupo. Para que no los confundan,
                      agrega tu apellido o un apodo.{' '}
                      <Link
                        href="/account#perfil"
                        className="font-bold underline underline-offset-4"
                      >
                        Cambiar mi nombre
                      </Link>
                    </Notice>
                  </div>
                )}
                <ul className="divide-rule divide-y">
                  {members.map((member) => {
                    const me = member.user_id === currentUserId
                    const name = me ? 'Tú' : member.profile.full_name || 'Sin nombre'
                    return (
                      <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                        <span className="flex min-w-0 items-center gap-3">
                          <GhostAvatar
                            seed={member.user_id}
                            src={member.profile.avatar_url}
                            size={38}
                          />
                          <span className="min-w-0">
                            <span className={`block truncate ${me ? 'font-bold' : ''}`}>
                              {name}
                            </span>
                            {isAdmin && !me && emailHints.get(member.user_id) && (
                              <span className="text-faint block truncate text-[14px] leading-tight">
                                {emailHints.get(member.user_id)}
                              </span>
                            )}
                            {member.is_admin && (
                              <span className="text-graphite block text-[15px] leading-tight">
                                Organiza
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          {member.hasList === null ? null : member.hasList ? (
                            <span className="text-ink" title="Ya anotó su lista">
                              <span aria-hidden="true">✓</span>
                              <span className="sr-only">Ya anotó su lista</span>
                            </span>
                          ) : (
                            <span className="text-graphite text-[15px]">Sin lista</span>
                          )}
                          {isAdmin && !me && !archived && (
                            <Button
                              variant="outline"
                              size="icon-sm"
                              onClick={() =>
                                setNewOrganizer({
                                  userId: member.user_id,
                                  name: member.profile.full_name || 'Sin nombre',
                                })
                              }
                              aria-label={`Pasarle la organización a ${name}`}
                              title={`Pasarle la organización a ${name}`}
                            >
                              <Crown aria-hidden="true" />
                            </Button>
                          )}
                          {isAdmin && !drawn && !me && !archived && (
                            <Button
                              variant="danger"
                              size="icon-sm"
                              onClick={() => {
                                setMemberToRemove({
                                  id: member.id,
                                  name: member.profile.full_name || 'Sin nombre',
                                })
                                setShowRemoveMemberDialog(true)
                              }}
                              aria-label={`Quitar a ${name} del grupo`}
                              title={`Quitar a ${name}`}
                            >
                              <UserMinus aria-hidden="true" />
                            </Button>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                {!drawn && !archived && (
                  <PendingInvitations
                    groupId={groupId}
                    isAdmin={isAdmin}
                    refreshKey={members.length}
                  />
                )}
              </section>
            </aside>
          </div>
        </div>
      </main>

      {drawOpened && (
        <DrawConfirmDialog
          open={showDrawConfirm}
          onOpenChange={setShowDrawConfirm}
          blind={blind}
          repeatedNames={repeatedNames}
          guessable={guessable}
          hasPrevious={!!group.previous_group_id}
          avoidPrevious={avoidPrevious}
          onAvoidPreviousChange={setAvoidPrevious}
          onConfirm={handleDraw}
        />
      )}

      {repeatOpened && (
        <RepeatGroupDialog group={group} open={showRepeat} onOpenChange={setShowRepeat} />
      )}

      {missingOpened && (
        <MissingListsDialog
          open={showMissingLists}
          onOpenChange={setShowMissingLists}
          missing={missingLists}
          groupId={group.id}
          groupName={group.name}
        />
      )}

      {editOpened && (
        <EditGroupDialog
          key={editKey}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          group={group}
          onSaved={fetchGroupData}
          onDelete={() => {
            setShowEditDialog(false)
            setShowDeleteDialog(true)
          }}
        />
      )}

      {deleteOpened && (
        <DeleteGroupDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          groupName={group.name}
          busy={isDeleting}
          onConfirm={handleDelete}
        />
      )}

      {leaveOpened && (
        <LeaveGroupDialog
          open={showLeaveDialog}
          onOpenChange={setShowLeaveDialog}
          groupName={group.name}
          busy={isLeaving}
          onConfirm={handleLeave}
        />
      )}

      {removeOpened && (
        <RemoveMemberDialog
          open={showRemoveMemberDialog}
          onOpenChange={setShowRemoveMemberDialog}
          name={memberToRemove?.name}
          busy={removingMemberId === memberToRemove?.id}
          onConfirm={handleRemoveMember}
          onCancel={() => {
            setShowRemoveMemberDialog(false)
            setMemberToRemove(null)
          }}
        />
      )}

      {transferOpened && (
        <TransferDialog
          open={!!newOrganizer}
          onOpenChange={(open) => !open && setNewOrganizer(null)}
          name={newOrganizer?.name}
          busy={isTransferring}
          onConfirm={handleTransfer}
        />
      )}

      {resetOpened && (
        <ResetDrawDialog
          open={showResetDialog}
          onOpenChange={setShowResetDialog}
          busy={isResetting}
          onConfirm={handleResetDraw}
        />
      )}

      {activityOpened && (
        <ActivityDialog
          open={showActivityDialog}
          onOpenChange={setShowActivityDialog}
          loading={isLoadingActivities}
          activities={activities}
        />
      )}
    </div>
  )
}

// useSearchParams needs a Suspense boundary in a static export.
export default function GroupPageWithId() {
  return (
    <Suspense fallback={<GroupLoading />}>
      <GroupPage />
    </Suspense>
  )
}
