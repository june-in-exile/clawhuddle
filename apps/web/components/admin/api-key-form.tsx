'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { PROVIDERS, OAUTH_PROVIDERS } from '@clawhuddle/shared';

type FetchFn = <T>(path: string, options?: RequestInit) => Promise<T>;

interface ApiKeyDisplay {
  id: string;
  provider: string;
  key_masked: string;
  is_company_default: boolean;
  source?: string;
}

interface Props {
  initialKeys: ApiKeyDisplay[];
  fetchFn: FetchFn;
}

type OAuthState = 'idle' | 'authorizing' | 'exchanging';

export function ApiKeyForm({ initialKeys, fetchFn }: Props) {
  const { toast } = useToast();
  const [keys, setKeys] = useState(initialKeys);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // OAuth state per provider
  const [oauthState, setOAuthState] = useState<Record<string, OAuthState>>({});
  const [oauthFlowId, setOAuthFlowId] = useState<Record<string, string>>({});
  const [oauthCode, setOAuthCode] = useState<Record<string, string>>({});

  const refresh = async () => {
    const res = await fetchFn<{ data: ApiKeyDisplay[] }>('/api-keys');
    setKeys(res.data);
  };

  const saveKey = async (provider: string) => {
    const key = inputs[provider]?.trim();
    if (!key) return;
    setSaving(true);
    try {
      await fetchFn('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ provider, key }),
      });
      setInputs((prev) => ({ ...prev, [provider]: '' }));
      await refresh();
      const label = PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
      toast(`${label} key saved`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteKey = async (keyId: string, providerLabel: string) => {
    setSaving(true);
    try {
      await fetchFn(`/api-keys/${keyId}`, { method: 'DELETE' });
      await refresh();
      toast(`${providerLabel} key deleted`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // OAuth flow
  const startOAuth = async (provider: string) => {
    setOAuthState((prev) => ({ ...prev, [provider]: 'authorizing' }));
    try {
      const res = await fetchFn<{ data: { flowId: string; authorizeUrl: string } }>(
        '/oauth/authorize',
        { method: 'POST', body: JSON.stringify({ provider }) },
      );
      setOAuthFlowId((prev) => ({ ...prev, [provider]: res.data.flowId }));
      window.open(res.data.authorizeUrl, '_blank', 'width=600,height=700');
    } catch (err: any) {
      toast(err.message, 'error');
      setOAuthState((prev) => ({ ...prev, [provider]: 'idle' }));
    }
  };

  const submitOAuthCode = async (provider: string) => {
    const code = oauthCode[provider]?.trim();
    const flowId = oauthFlowId[provider];
    if (!code || !flowId) return;
    setOAuthState((prev) => ({ ...prev, [provider]: 'exchanging' }));
    try {
      await fetchFn('/oauth/callback', {
        method: 'POST',
        body: JSON.stringify({ flowId, code }),
      });
      await refresh();
      const label = PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
      toast(`${label} connected via OAuth`, 'success');
      setOAuthState((prev) => ({ ...prev, [provider]: 'idle' }));
      setOAuthCode((prev) => ({ ...prev, [provider]: '' }));
    } catch (err: any) {
      toast(err.message, 'error');
      setOAuthState((prev) => ({ ...prev, [provider]: 'authorizing' }));
    }
  };

  const cancelOAuth = (provider: string) => {
    setOAuthState((prev) => ({ ...prev, [provider]: 'idle' }));
    setOAuthCode((prev) => ({ ...prev, [provider]: '' }));
  };

  const currentKey = (provider: string) => keys.find((k) => k.provider === provider);

  return (
    <div className="space-y-6 max-w-lg">
      {PROVIDERS.map(({ id, label, placeholder, defaultModel, supportsOAuth }) => {
        const existing = currentKey(id);
        const providerOAuthState = oauthState[id] || 'idle';
        const hasOAuth = supportsOAuth && id in OAUTH_PROVIDERS;

        return (
          <div
            key={id}
            className="p-5 rounded-xl"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-baseline justify-between mb-1">
              <h3
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {label}
              </h3>
              <span
                className="text-[11px] font-mono"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {defaultModel}
              </span>
            </div>

            {existing && (
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Current:{' '}
                  <code
                    className="px-1.5 py-0.5 rounded text-[11px] font-mono"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    {existing.key_masked}
                  </code>
                  {existing.source === 'oauth' && (
                    <span
                      className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
                    >
                      via OAuth
                    </span>
                  )}
                </p>
                <button
                  onClick={() => deleteKey(existing.id, label)}
                  disabled={saving}
                  className="text-xs px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error, #ef4444)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                >
                  Delete
                </button>
              </div>
            )}

            {/* OAuth connect section */}
            {hasOAuth && providerOAuthState === 'idle' && (
              <button
                onClick={() => startOAuth(id)}
                disabled={saving}
                className="w-full mb-3 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
              >
                Connect with {label}
              </button>
            )}

            {hasOAuth && providerOAuthState === 'authorizing' && (
              <div className="mb-3 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Authorize in the popup window, then paste the code shown:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={oauthCode[id] ?? ''}
                    onChange={(e) => setOAuthCode((prev) => ({ ...prev, [id]: e.target.value }))}
                    placeholder="Paste code here..."
                    className="flex-1 px-3 py-2 text-sm rounded-lg font-mono"
                  />
                  <button
                    onClick={() => submitOAuthCode(id)}
                    disabled={!oauthCode[id]?.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
                  >
                    Submit
                  </button>
                  <button
                    onClick={() => cancelOAuth(id)}
                    className="px-3 py-2 rounded-lg text-xs transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {hasOAuth && providerOAuthState === 'exchanging' && (
              <div className="mb-3 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Connecting...
                </p>
              </div>
            )}

            {/* Divider between OAuth and manual */}
            {hasOAuth && providerOAuthState === 'idle' && (
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>or paste key manually</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="password"
                value={inputs[id] ?? ''}
                onChange={(e) => setInputs((prev) => ({ ...prev, [id]: e.target.value }))}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 text-sm rounded-lg"
              />
              <button
                onClick={() => saveKey(id)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--text-inverse)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
              >
                Save
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
