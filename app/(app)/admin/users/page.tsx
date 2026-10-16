import { AdminUsers } from '@/components/admin/admin-users';
import { listUsersForAdmin, requireAdminPage } from '@/lib/admin';

// Accounts: create one, set a password, block, change the role or erase it.
export default async function AdminUsersPage() {
  const session = await requireAdminPage();
  const users = await listUsersForAdmin();
  return <AdminUsers users={users} currentUserId={session.userId} />;
}
