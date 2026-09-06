import { DashboardShell } from '@/components/dashboard-shell';

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell variant="merchant">{children}</DashboardShell>;
}
