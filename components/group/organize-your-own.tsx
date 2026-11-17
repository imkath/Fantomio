import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GhostMark } from '@/components/ghost-mark'

// After the exchange, everyone in the group has just used Fantomio and liked it (or not). Many
// of them have another draw coming, with family, friends or work: one quiet card, no pop-up.
export function OrganizeYourOwn() {
  return (
    <section className="border-rule flex flex-col gap-4 rounded-[4px] border p-6 sm:flex-row sm:items-center">
      <GhostMark className="text-ink h-[46px] w-10 shrink-0" />
      <div className="flex-1">
        <h2 className="text-lg font-bold">¿Tienes otro amigo secreto pendiente?</h2>
        <p className="text-graphite">
          Arma el de tu familia, tus amigos o la pega en un minuto. Es gratis.
        </p>
      </div>
      <Button asChild variant="outline" className="shrink-0">
        <Link href="/dashboard?new=1">
          <Plus aria-hidden="true" />
          Crear un grupo
        </Link>
      </Button>
    </section>
  )
}
