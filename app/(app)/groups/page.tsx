'use client'

import { groupPath } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Trash2,
  UserMinus,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import GroupLoading from './loading'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { ModePicker, type GroupMode } from '@/components/group/mode-picker'
import { BlindAssignment, BlindListsNotice, BlindResults } from '@/components/group/blind'
import {
  ArchiveButton,
  ArchivedNotice,
  EditionHistory,
  HideButton,
  PendingInvitations,
  RepeatGroupDialog,
  RevealedGiver,
  RevealYourself,
} from '@/components/group/editions'
import { createClient, getSessionUser } from '@/lib/supabase'
import { drawNames, resetDraw } from '@/lib/actions/draw'
import {
  updateGroup,
  deleteGroup,
  leaveGroup,
  getGroupActivities,
  removeMember,
  transferGroup,
} from '@/lib/actions/group'
import { RateApp } from '@/components/rate-app'
import { GhostMark } from '@/components/ghost-mark'
import { GhostAvatar } from '@/components/ghost-avatar'
import { celebrate } from '@/lib/confetti'
import { Notice } from '@/components/auth-shell'
import { WishlistEditor } from '@/components/wishlist-editor'
import { GroupPageSkeleton } from '@/components/skeletons'
import { GroupInfoCard } from '@/components/group-info-card'
import { ExclusionsManager } from '@/components/exclusions-manager'
import { AnonymousChat } from '@/components/anonymous-chat'
import { Input } from '@/components/ui/input'
import { formatName, todayIn } from '@/lib/utils'
import { toast } from 'sonner'

interface Member {
  id: string
  user_id: string
  // null: hidden (a blind group shows only your own and the total)
  hasList: boolean | null
  is_admin: boolean
  hidden: boolean
  profile: {
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

interface Match {
  id: string
  receiver_id: string
  receiver: {
    full_name: string | null
    email: string
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
}

// "2026-12-24T20:00" for <input type="datetime-local">, in the viewer's time zone.
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

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
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)

  // Match reveal state
  const [match, setMatch] = useState<Match | null>(null)
  const [showMatch, setShowMatch] = useState(false)
  const [showDrawConfirm, setShowDrawConfirm] = useState(false)
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
  const [activities, setActivities] = useState<
    Array<{
      id: string
      type: string
      message: string
      created_at: string
      profiles: { full_name: string | null; email: string; avatar_url: string | null }
    }>
  >([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editBudget, setEditBudget] = useState('')
  const [editCurrency, setEditCurrency] = useState('CLP')
  const [editDate, setEditDate] = useState('')
  const [editMode, setEditMode] = useState<GroupMode>('classic')
  const [editRevealAt, setEditRevealAt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null)
  const [showRemoveMemberDialog, setShowRemoveMemberDialog] = useState(false)
  const [newOrganizer, setNewOrganizer] = useState<{ userId: string; name: string } | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const fetchGroupData = useCallback(async () => {
    const supabase = createClient()

    try {
      const user = await getSessionUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserId(user.id)

      // One round trip: group, members, lists and (if any) my match load in parallel.
      // The match query simply returns nothing until the group is drawn. Wishlists come back
      // filtered by the database: mine and, after the draw, the one of the person I give to.
      // For everyone else we only learn whether they wrote one (wishlist_status).
      const [groupRes, membersRes, matchRes, listsRes, statusRes] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        supabase
          .from('members')
          .select(
            'id, user_id, is_admin, hidden_at, profiles:user_id (full_name, email, avatar_url)'
          )
          .eq('group_id', groupId),
        supabase
          .from('matches')
          .select(
            'id, receiver_id, revealed_at, receiver:receiver_id (full_name, email, avatar_url)'
          )
          .eq('group_id', groupId)
          .eq('giver_id', user.id)
          .maybeSingle(),
        supabase.from('wishlists').select('user_id, items').eq('group_id', groupId),
        supabase.rpc('wishlist_status', { p_group_id: groupId }),
      ])

      const groupData = groupRes.data
      if (groupRes.error || !groupData) {
        setError('Grupo no encontrado')
        setIsLoading(false)
        return
      }
      setGroup(groupData)
      if (groupData.mode === 'blind') {
        const [missingRes, countRes] = await Promise.all([
          groupData.status === 'PLANNING'
            ? supabase.rpc('blind_missing_lists', { p_group_id: groupId })
            : Promise.resolve({ data: [] }),
          supabase.rpc('wishlist_count', { p_group_id: groupId }),
        ])
        setMissingLists((missingRes.data ?? []) as string[])
        setListCount(countRes.data as { with_list: number; total: number })
        // Confetti for everyone watching when the blind draw is revealed.
        const hidden = !groupData.revealed_at
        if (wasHidden.current === true && !hidden) celebrate()
        wasHidden.current = hidden
        // After a blind reveal there's nothing left to uncover: show the person right away.
        if (!hidden && groupData.status === 'DRAWN') setShowMatch(true)
      }
      setIsAdmin(groupData.admin_id === user.id)

      type Items = Array<{ description: string; url?: string }>
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
      setMyWishlist(lists.get(user.id) ?? [])

      const formattedMembers = (membersRes.data ?? []).map((m) => ({
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
      setMembers(formattedMembers)
      setCurrentMember(formattedMembers.find((m) => m.user_id === user.id) ?? null)

      const matchData = groupData.status === 'DRAWN' ? matchRes.data : null
      if (matchData) {
        setMatch({
          id: matchData.id,
          receiver_id: matchData.receiver_id,
          receiver: (() => {
            const r = matchData.receiver as unknown as {
              full_name: string | null
              email: string
              avatar_url: string | null
            }
            return { ...r, full_name: formatName(r.full_name) || null }
          })(),
          receiver_wishlist: lists.get(matchData.receiver_id) ?? [],
          revealed: !!matchData.revealed_at,
        })
      } else {
        setMatch(null)
      }
    } catch {
      setError('Error al cargar el grupo')
    } finally {
      setIsLoading(false)
    }
  }, [groupId, router])

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
    if (group) {
      setEditName(group.name)
      setEditBudget(group.budget?.toString() || '')
      setEditCurrency(group.currency || 'CLP')
      setEditDate(group.exchange_date || '')
      setEditMode(group.mode)
      setEditRevealAt(group.reveal_at ? toLocalInput(group.reveal_at) : '')
      setShowEditDialog(true)
    }
  }

  const handleSaveEdit = async () => {
    if (!group) return
    setIsSaving(true)

    const result = await updateGroup(group.id, {
      name: editName,
      budget: editBudget ? parseFloat(editBudget) : null,
      currency: editCurrency,
      exchange_date: editDate || null,
      // The mode is locked once there is a draw (the database refuses it too).
      ...(group.status === 'PLANNING' ? { mode: editMode } : {}),
      ...(group.revealed_at
        ? {}
        : {
            reveal_at:
              editMode === 'blind' && editRevealAt ? new Date(editRevealAt).toISOString() : null,
          }),
    })

    if (result.success) {
      toast.success('Grupo actualizado')
      setShowEditDialog(false)
      await fetchGroupData()
    } else {
      toast.error(result.error || 'Error al actualizar')
    }

    setIsSaving(false)
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
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
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
                    name: m.profile.full_name || m.profile.email,
                  }))}
                revealAt={group.reveal_at}
                isAdmin={isAdmin}
                onRevealed={fetchGroupData}
              />
            )}
            {drawn && blind && !blindHidden && <BlindResults groupId={groupId} />}

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
                          {match.receiver.full_name || match.receiver.email}
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
                              <span className="min-w-0 break-words">{item.description}</span>
                              {item.url && (
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
                          Todavía no anota nada. Puedes preguntarle abajo, sin que sepa que eres tú.
                        </p>
                      )}
                    </div>

                    {exchangeDone && (
                      <RevealYourself
                        groupId={groupId}
                        receiverName={match.receiver.full_name || match.receiver.email}
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
                {archived ? (
                  <div>
                    <h2 className="text-xl font-bold">Tu lista</h2>
                    {myWishlist.length ? (
                      <ul className="mt-4 grid gap-2">
                        {myWishlist.map((item, i) => (
                          <li key={i} className="bg-slip rounded-[3px] px-4 py-3 break-words">
                            {item.description}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-graphite mt-2">No anotaste nada esta vez.</p>
                    )}
                  </div>
                ) : (
                  <WishlistEditor
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
              inviteCode={archived ? undefined : group.invite_code}
            />

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
              <ul className="divide-rule divide-y">
                {members.map((member) => {
                  const me = member.user_id === currentUserId
                  const name = me ? 'Tú' : member.profile.full_name || member.profile.email
                  return (
                    <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <GhostAvatar
                          seed={member.user_id}
                          src={member.profile.avatar_url}
                          size={38}
                        />
                        <span className="min-w-0">
                          <span className={`block truncate ${me ? 'font-bold' : ''}`}>{name}</span>
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
                                name: member.profile.full_name || member.profile.email,
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
                                name: member.profile.full_name || member.profile.email,
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
          </aside>
        </div>
      </main>

      {/* Draw confirmation */}
      <Dialog open={showDrawConfirm} onOpenChange={setShowDrawConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Hacemos el sorteo?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>Cuando lo hagas:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>a cada persona le aparece a quién le regala</li>
                  <li>ya no se puede sumar gente al grupo</li>
                  <li>si algo sale mal, puedes reiniciarlo, pero todos pierden lo que vieron</li>
                  <li>quien no haya respondido la invitación queda fuera de esta vuelta</li>
                  {blind && (
                    <li>
                      es a ciegas: cada uno verá solo una lista, sin nombre, hasta que la reveles
                    </li>
                  )}
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          {group.previous_group_id && (
            <label className="flex items-start gap-3 text-[15px]">
              <input
                type="checkbox"
                className="accent-ink mt-1 size-4"
                checked={avoidPrevious}
                onChange={(e) => setAvoidPrevious(e.target.checked)}
              />
              <span>
                Que a nadie le toque la misma persona que la vez anterior. Usamos el sorteo anterior
                sin mostrárselo a nadie.
              </span>
            </label>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDrawConfirm(false)}>
              Todavía no
            </Button>
            <Button onClick={handleDraw}>
              <Shuffle aria-hidden="true" />
              Sortear ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RepeatGroupDialog group={group} open={showRepeat} onOpenChange={setShowRepeat} />

      {/* Blind draw blocked: say why and help fix it */}
      <Dialog open={showMissingLists} onOpenChange={setShowMissingLists}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Todavía falta que anoten su lista</DialogTitle>
            <DialogDescription>
              En el sorteo a ciegas, la lista es la única pista de quien regala, así que se puede
              sortear cuando todos hayan anotado al menos una cosa.
            </DialogDescription>
          </DialogHeader>
          <div>
            <p className="text-graphite mb-2 text-[15px]">
              {missingLists.length === 1
                ? 'Falta 1 persona'
                : `Faltan ${missingLists.length} personas`}
            </p>
            <ul className="divide-rule divide-y">
              {missingLists.map((name) => (
                <li key={name} className="py-2.5">
                  {name}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const url = `${window.location.origin}${groupPath(group.id)}`
                const text = `Para el amigo secreto a ciegas de *${group.name}* falta que anotes tu lista de deseos. Sin ella no podemos sortear:\n${url}`
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
              }}
            >
              <MessageCircle aria-hidden="true" />
              Avisarles por WhatsApp
            </Button>
            <Button onClick={() => setShowMissingLists(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit group */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid gap-1.5">
              <label htmlFor="edit-name" className="text-[15px] font-medium">
                Nombre del grupo
              </label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="edit-budget" className="text-[15px] font-medium">
                Presupuesto por regalo
              </label>
              <div className="flex gap-2">
                <select
                  aria-label="Moneda"
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  className="border-input bg-paper text-ink focus-visible:border-ink h-11 rounded-[8px] border px-3 text-base outline-none"
                >
                  <option value="CLP">CLP ($)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="MXN">MXN ($)</option>
                  <option value="ARS">ARS ($)</option>
                  <option value="COP">COP ($)</option>
                  <option value="PEN">PEN (S/)</option>
                  <option value="BRL">BRL (R$)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
                <Input
                  id="edit-budget"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="edit-date" className="text-[15px] font-medium">
                Día del intercambio
              </label>
              <Input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <ModePicker
              value={editMode}
              onChange={setEditMode}
              disabled={group.status === 'DRAWN'}
            />
            {editMode === 'blind' && !group.revealed_at && (
              <div className="grid gap-1.5">
                <label htmlFor="edit-reveal" className="text-[15px] font-medium">
                  Hora de revelación (opcional)
                </label>
                <Input
                  id="edit-reveal"
                  type="datetime-local"
                  value={editRevealAt}
                  onChange={(e) => setEditRevealAt(e.target.value)}
                />
                <p className="text-graphite text-sm">
                  Lo normal es que toques &quot;Revelar ahora&quot; cuando estén todos juntos. Si a
                  esta hora nadie lo ha hecho, se revela solo.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="danger"
              className="sm:mr-auto"
              onClick={() => {
                setShowEditDialog(false)
                setShowDeleteDialog(true)
              }}
            >
              <Trash2 aria-hidden="true" />
              Eliminar grupo
            </Button>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || !editName.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete group */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar {group?.name}?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>Se borra para siempre, junto con:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>las personas del grupo y sus listas</li>
                  <li>el historial</li>
                  <li>el resultado del sorteo, si ya lo hicieron</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 aria-hidden="true" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave group */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Salir de {group?.name}?</DialogTitle>
            <DialogDescription>
              Dejarás de ver el grupo. Para volver, necesitarás el link de nuevo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleLeave} disabled={isLeaving}>
              {isLeaving ? <Loader2 className="animate-spin" /> : <LogOut aria-hidden="true" />}
              Salir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove member */}
      <Dialog open={showRemoveMemberDialog} onOpenChange={setShowRemoveMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Quitar a {memberToRemove?.name}?</DialogTitle>
            <DialogDescription>
              Sale del grupo y se borra su lista. Si quiere volver, tendrá que entrar con el link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRemoveMemberDialog(false)
                setMemberToRemove(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={removingMemberId === memberToRemove?.id}
            >
              {removingMemberId === memberToRemove?.id ? (
                <Loader2 className="animate-spin" />
              ) : (
                <UserMinus aria-hidden="true" />
              )}
              Quitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hand the group over */}
      <Dialog open={!!newOrganizer} onOpenChange={(open) => !open && setNewOrganizer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Pasarle la organización a {newOrganizer?.name}?</DialogTitle>
            <DialogDescription>
              Podrá editar el grupo, hacer o reiniciar el sorteo y quitar personas. Tú sigues en el
              grupo como participante, y para recuperar la organización tendría que devolvértela.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewOrganizer(null)}>
              Cancelar
            </Button>
            <Button onClick={handleTransfer} disabled={isTransferring}>
              {isTransferring ? <Loader2 className="animate-spin" /> : <Crown aria-hidden="true" />}
              Pasar la organización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset draw */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Reiniciar el sorteo?</DialogTitle>
            <DialogDescription>
              Se borra quién le regala a quién y habrá que sortear de nuevo. Lo que cada persona ya
              vio deja de valer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleResetDraw} disabled={isResetting}>
              {isResetting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RotateCcw aria-hidden="true" />
              )}
              Reiniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent className="max-h-[80vh] max-w-md">
          <DialogHeader>
            <DialogTitle>Lo que ha pasado</DialogTitle>
          </DialogHeader>
          <div className="-mx-6 max-h-[50vh] overflow-y-auto px-6">
            {isLoadingActivities ? (
              <div className="flex justify-center py-8">
                <Loader2 className="text-faint h-6 w-6 animate-spin" />
              </div>
            ) : activities.length === 0 ? (
              <p className="text-graphite py-8 text-center">Todavía no hay nada.</p>
            ) : (
              <ol className="divide-rule divide-y">
                {activities.map((activity) => (
                  <li key={activity.id} className="py-3">
                    <p>{activity.message}</p>
                    <p className="text-graphite text-[15px]">
                      {new Date(activity.created_at).toLocaleDateString('es-CL', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
