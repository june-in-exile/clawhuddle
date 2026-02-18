import { UserTable } from '@/components/admin/user-table';

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function getUsers() {
  try {
    const res = await fetch(`${API_URL}/api/admin/users`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export default async function AdminPage() {
  const users = await getUsers();

  return (
    <div>
      <h1
        className="text-xl font-semibold tracking-tight mb-6"
        style={{ color: 'var(--text-primary)' }}
      >
        Employees
      </h1>
      <UserTable initialUsers={users} />
    </div>
  );
}
