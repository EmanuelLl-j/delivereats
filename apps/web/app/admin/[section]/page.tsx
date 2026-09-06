import { AdminOperations } from '@/components/admin-operations';

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <AdminOperations section={section} />;
}
