'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

interface ApiKeyDisplay {
  id: string;
  provider: string;
  key_masked: string;
  is_company_default: boolean;
}

interface Props {
  initialKeys: ApiKeyDisplay[];
}

export function ApiKeyForm({ initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const res = await apiFetch<{ data: ApiKeyDisplay[] }>('/api/admin/api-keys');
    setKeys(res.data);
  };

  const saveKey = async (provider: string, key: string, clearFn: (v: string) => void) => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ provider, key: key.trim() }),
      });
      clearFn('');
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const currentKey = (provider: string) => keys.find((k) => k.provider === provider);

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Anthropic</h3>
        {currentKey('anthropic') && (
          <p className="text-sm text-gray-500 mb-2">
            Current: <code className="bg-gray-100 px-1 rounded">{currentKey('anthropic')!.key_masked}</code>
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => saveKey('anthropic', anthropicKey, setAnthropicKey)}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">OpenAI</h3>
        {currentKey('openai') && (
          <p className="text-sm text-gray-500 mb-2">
            Current: <code className="bg-gray-100 px-1 rounded">{currentKey('openai')!.key_masked}</code>
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => saveKey('openai', openaiKey, setOpenaiKey)}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
