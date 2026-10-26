import type { ReactNode } from 'react'

export function AccountSection({
  id,
  title,
  lede,
  children,
}: {
  id: string
  title: string
  lede?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="border-rule scroll-mt-24 rounded-[4px] border p-6 md:p-8">
      <h2 className="text-xl font-bold">{title}</h2>
      {lede && <p className="text-graphite mt-1">{lede}</p>}
      <div className="mt-6 space-y-8">{children}</div>
    </section>
  )
}

// One setting inside a section: a label, a line about it, and its controls.
export function Setting({
  title,
  hint,
  children,
}: {
  title: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="border-rule space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="font-bold">{title}</h3>
        {hint && <p className="text-graphite mt-1 text-[15px]">{hint}</p>}
      </div>
      {children}
    </div>
  )
}
