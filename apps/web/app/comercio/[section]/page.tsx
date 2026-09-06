import MerchantDashboard from '../page';
import { MerchantOperations } from '@/components/merchant-operations';

export default async function MerchantSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === 'pedidos') return <MerchantDashboard />;
  return <MerchantOperations section={section} />;
}
