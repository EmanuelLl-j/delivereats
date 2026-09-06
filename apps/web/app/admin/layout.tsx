import { DashboardShell } from '@/components/dashboard-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell variant="admin">{children}</DashboardShell>;
}
