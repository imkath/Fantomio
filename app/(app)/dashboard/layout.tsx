// Force dynamic rendering — this page needs Supabase at runtime
export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
