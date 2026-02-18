import { ApiKeyForm } from '@/components/admin/api-key-form';

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function getApiKeys() {
  try {
    const res = await fetch(`${API_URL}/api/admin/api-keys`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export default async function ApiKeysPage() {
  const keys = await getApiKeys();

  return (
    <div>
      <h1
        className="text-xl font-semibold tracking-tight mb-6"
        style={{ color: 'var(--text-primary)' }}
      >
        API Keys
      </h1>
      <ApiKeyForm initialKeys={keys} />
    </div>
  );
}
