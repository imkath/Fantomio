'use client'

import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { drawNames, resetDraw } from '@/app/actions/draw'
import {
  updateGroup,
  deleteGroup,
  leaveGroup,
  getGroupActivities,
  removeMember,
} from '@/app/actions/group'
import { GhostMark } from '@/components/ghost-mark'
import { Notice } from '@/components/auth-shell'
import { WishlistEditor } from '@/components/wishlist-editor'
import { GroupPageSkeleton } from '@/components/skeletons'
import { GroupInfoCard } from '@/components/group-info-card'
import { ExclusionsManager } from '@/components/exclusions-manager'
import { AnonymousChat } from '@/components/anonymous-chat'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface Member {
  id: string
  user_id: string
  wishlist: Array<{ description: string; url?: string }>
  is_admin: boolean
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
}

export default function GroupPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentMember, setCurrentMember] = useState<Member | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)

  // Match reveal state
  const [match, setMatch] = useState<Match | null>(null)
  const [showMatch, setShowMatch] = useState(false)
  const [showDrawConfirm, setShowDrawConfirm] = useState(false)

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
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null)
  const [showRemoveMemberDialog, setShowRemoveMemberDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const fetchGroupData = useCallback(async () => {
    const supabase = createClient()

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserId(user.id)

      // Get group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (groupError || !groupData) {
        setError('Grupo no encontrado')
        setIsLoading(false)
        return
      }

      setGroup(groupData)
      setIsAdmin(groupData.admin_id === user.id)

      // Get members with profiles
      const { data: membersData } = await supabase
        .from('members')
        .select(
          `
          id,
          user_id,
          wishlist,
          is_admin,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        `
        )
        .eq('group_id', groupId)

      if (membersData) {
        const formattedMembers = membersData.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          wishlist: m.wishlist || [],
          is_admin: m.is_admin,
          profile: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
        }))
        setMembers(formattedMembers)

        // Set current member
        const myMember = formattedMembers.find((m) => m.user_id === user.id)
        if (myMember) {
          setCurrentMember(myMember)
        }
      }

      // If group is drawn, get current user's match
      if (groupData.status === 'DRAWN') {
        const { data: matchData } = await supabase
          .from('matches')
          .select(
            `
            id,
            receiver_id,
            receiver:receiver_id (
              full_name,
              email,
              avatar_url
            )
          `
          )
          .eq('group_id', groupId)
          .eq('giver_id', user.id)
          .single()

        if (matchData) {
          // Get receiver's wishlist
          const { data: receiverMember } = await supabase
            .from('members')
            .select('wishlist')
            .eq('group_id', groupId)
            .eq('user_id', matchData.receiver_id)
            .single()

          const receiverData = matchData.receiver as unknown as {
            full_name: string | null
            email: string
            avatar_url: string | null
          }
          setMatch({
            id: matchData.id,
            receiver_id: matchData.receiver_id,
            receiver: receiverData,
            receiver_wishlist:
              (receiverMember?.wishlist as Array<{ description: string; url?: string }>) || [],
          })
        }
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
          if (newGroup.status !== group?.status) {
            fetchGroupData()
            if (newGroup.status === 'DRAWN') {
              toast.success('¡El sorteo ha sido realizado!')
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
  }, [groupId, group?.status, fetchGroupData])

  const handleDraw = async () => {
    if (!group) return
    setShowDrawConfirm(false)
    setIsDrawing(true)
    setError('')

    const result = await drawNames(group.id)

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

  // The seal animates on mount (see .seal-thump in globals.css), so revealing is just state.
  const handleRevealMatch = () => setShowMatch(true)

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
      <div className="bg-paper min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-[1040px] px-4 py-10 md:px-8">
          <GroupPageSkeleton />
        </main>
      </div>
    )
  }

  if (error && !group) {
    return (
      <div className="bg-paper text-ink min-h-screen">
        <AppHeader />
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
  const linkBtn = 'text-graphite hover:text-ink min-h-11 text-[15px] underline underline-offset-4'

  return (
    <div className="bg-paper text-ink min-h-screen pb-16">
      <AppHeader />

      <main className="mx-auto max-w-[1040px] px-4 py-10 md:px-8">
        <Link href="/dashboard" className={linkBtn}>
          Volver a mis grupos
        </Link>

        {error && (
          <div className="mt-6">
            <Notice>{error}</Notice>
          </div>
        )}

        {/* Header */}
        <div className="mt-8 mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="min-w-0">
            <p className="text-graphite mb-2 font-mono text-sm">
              {drawn ? 'sorteado' : 'sin sortear'} · {members.length}{' '}
              {members.length === 1 ? 'persona' : 'personas'}
            </p>
            <h1 className="text-[34px] leading-tight font-light break-words md:text-[44px]">
              {group.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleShare}>
              {copied ? 'Link copiado' : 'Copiar link de invitación'}
            </Button>
            {isAdmin && drawn && (
              <Button
                variant="outline"
                onClick={() => {
                  const groupUrl = `${window.location.origin}/groups/${group.id}`
                  const text = `Ya hicimos el sorteo de *${group.name}*.\n\nEntra para ver a quién le regalas:\n${groupUrl}`
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
                }}
              >
                Avisar por WhatsApp
              </Button>
            )}
            {isAdmin && !drawn && members.length >= 3 && (
              <Button onClick={() => setShowDrawConfirm(true)} disabled={isDrawing}>
                {isDrawing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Hacer el sorteo
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          {/* Main column */}
          <div className="min-w-0 space-y-8">
            {!drawn && (
              <section className="border-rule bg-slip rounded-[4px] border p-6 md:p-8">
                <p className="text-graphite mb-3 font-mono text-sm tracking-[0.12em] uppercase">
                  Tu amigo secreto
                </p>
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
                  </div>
                </div>
              </section>
            )}

            {drawn && match && (
              <section className="border-rule bg-raised relative rounded-[4px] border p-6 md:p-8">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-graphite font-mono text-sm tracking-[0.12em] uppercase">
                    Tu amigo secreto
                  </p>
                  {showMatch && (
                    <button
                      type="button"
                      onClick={() => setShowMatch(false)}
                      className="text-graphite hover:text-ink min-h-8 font-mono text-[13px] underline underline-offset-[3px]"
                    >
                      ocultar
                    </button>
                  )}
                </div>

                {!showMatch ? (
                  <div className="grid justify-items-center gap-4 py-6 text-center">
                    <GhostMark className="text-ink h-[74px] w-[64px]" />
                    <p className="text-graphite max-w-[30ch]">
                      El sorteo ya está hecho. ¿Vemos a quién te tocó?
                    </p>
                    <Button size="lg" onClick={handleRevealMatch}>
                      Ver a quién me tocó
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div
                      className="seal-thump bg-hanko text-hanko-ink absolute top-[78px] right-5 grid h-[76px] w-[76px] rotate-[-12deg] place-items-center rounded-full text-center text-[11px] leading-tight font-bold tracking-[0.08em] md:right-8"
                      aria-hidden="true"
                    >
                      SOLO
                      <br />
                      PARA
                      <br />
                      TI
                    </div>
                    <div className="flex items-center gap-4 pr-24">
                      <span className="border-hanko text-hanko grid h-12 w-12 shrink-0 place-items-center rounded-full border-[1.5px] text-lg font-bold">
                        {(match.receiver.full_name || match.receiver.email).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-2xl leading-tight font-bold break-words">
                          {match.receiver.full_name || match.receiver.email}
                        </p>
                        <p className="text-graphite text-[15px]">le regalas tú</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-graphite mb-3 font-mono text-sm tracking-[0.12em] uppercase">
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
                                  className="text-hanko shrink-0 font-mono text-[13px] underline underline-offset-[3px]"
                                  title={item.url}
                                >
                                  ver link
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

                    <AnonymousChat
                      matchId={match.id}
                      groupId={groupId}
                      role="giver"
                      receiverName={match.receiver.full_name || undefined}
                    />
                  </div>
                )}
              </section>
            )}

            {/* Anonymous messages received (someone is asking YOU) */}
            {drawn && <AnonymousChat matchId={null} groupId={groupId} role="receiver" />}

            {currentMember && (
              <section className="border-rule rounded-[4px] border p-6 md:p-8">
                <WishlistEditor
                  groupId={groupId}
                  memberId={currentMember.id}
                  initialItems={currentMember.wishlist}
                  onSave={fetchGroupData}
                />
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="min-w-0 space-y-8">
            <GroupInfoCard
              budget={group.budget}
              currency={group.currency}
              exchangeDate={group.exchange_date}
              inviteCode={group.invite_code}
            />

            <section className="border-rule rounded-[4px] border p-6">
              <div className="mb-1 flex items-baseline justify-between">
                <h2 className="text-lg font-bold">Participantes</h2>
                <span className="text-graphite font-mono text-sm">{members.length}</span>
              </div>
              <p className="text-faint mb-4 text-sm">
                <span aria-hidden="true">✓</span> ya anotó su lista
              </p>
              <ul className="divide-rule divide-y">
                {members.map((member) => {
                  const me = member.user_id === currentUserId
                  const name = me ? 'Tú' : member.profile.full_name || member.profile.email
                  return (
                    <li key={member.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`truncate ${me ? 'font-bold' : ''}`}>{name}</span>
                        {member.is_admin && (
                          <span className="text-faint shrink-0 font-mono text-xs">organiza</span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        {member.wishlist.length > 0 ? (
                          <span className="text-ink" title="Ya anotó su lista">
                            <span aria-hidden="true">✓</span>
                            <span className="sr-only">Ya anotó su lista</span>
                          </span>
                        ) : (
                          <span className="text-faint font-mono text-xs">sin lista</span>
                        )}
                        {isAdmin && !drawn && !me && (
                          <button
                            type="button"
                            onClick={() => {
                              setMemberToRemove({
                                id: member.id,
                                name: member.profile.full_name || member.profile.email,
                              })
                              setShowRemoveMemberDialog(true)
                            }}
                            className="text-graphite hover:text-destructive min-h-8 font-mono text-xs underline underline-offset-[3px]"
                            aria-label={`Quitar a ${name} del grupo`}
                          >
                            quitar
                          </button>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>

            <div className="flex flex-col items-start gap-1">
              <button type="button" onClick={handleShowActivity} className={linkBtn}>
                Ver lo que ha pasado en el grupo
              </button>
              {isAdmin && (
                <button type="button" onClick={handleOpenEdit} className={linkBtn}>
                  Editar grupo
                </button>
              )}
              {isAdmin && (
                <ExclusionsManager
                  groupId={groupId}
                  members={members}
                  isAdmin={isAdmin}
                  isDrawn={drawn}
                />
              )}
              {isAdmin && drawn && (
                <button
                  type="button"
                  onClick={() => setShowResetDialog(true)}
                  className="text-destructive min-h-11 text-[15px] underline underline-offset-4"
                >
                  Reiniciar el sorteo
                </button>
              )}
              {!isAdmin && !drawn && (
                <button
                  type="button"
                  onClick={() => setShowLeaveDialog(true)}
                  className="text-graphite hover:text-destructive min-h-11 text-[15px] underline underline-offset-4"
                >
                  Salir del grupo
                </button>
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
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDrawConfirm(false)}>
              Todavía no
            </Button>
            <Button onClick={handleDraw}>Sortear ahora</Button>
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
                  className="border-input bg-paper text-ink focus-visible:border-ink h-11 rounded-[2px] border px-3 text-base outline-none"
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
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setShowEditDialog(false)
                setShowDeleteDialog(true)
              }}
              className="text-destructive min-h-11 text-[15px] underline underline-offset-4 sm:mr-auto"
            >
              Eliminar grupo
            </button>
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
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              {isLeaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              {removingMemberId === memberToRemove?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Quitar
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
              {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                    <p className="text-faint font-mono text-xs">
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
