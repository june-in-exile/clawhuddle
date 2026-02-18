'use client';

import { useState, useEffect, useRef } from 'react';
import type { User } from '@clawteam/shared';
import { apiFetch } from '@/lib/api';

interface Props {
  initialUsers: User[];
}

function Badge({ color, children }: { color: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray'; children: React.ReactNode }) {
  const styles: Record<string, { bg: string; text: string }> = {
    green:  { bg: 'var(--green-muted)',  text: 'var(--green)' },
    red:    { bg: 'var(--red-muted)',    text: 'var(--red)' },
    yellow: { bg: 'var(--yellow-muted)', text: 'var(--yellow)' },
    blue:   { bg: 'var(--blue-muted)',   text: 'var(--blue)' },
    purple: { bg: 'var(--purple-muted)', text: 'var(--purple)' },
    gray:   { bg: 'var(--bg-tertiary)',  text: 'var(--text-tertiary)' },
  };
  const s = styles[color];
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ background: s.bg, color: s.text }}
    >
      {children}
    </span>
  );
}

function ActionBtn({ onClick, color = 'default', children }: { onClick: () => void; color?: 'default' | 'danger' | 'success'; children: React.ReactNode }) {
  const colorMap = {
    default: { normal: 'var(--accent)', hover: 'var(--accent-hover)' },
    danger:  { normal: 'var(--red)',    hover: '#fca5a5' },
    success: { normal: 'var(--green)',  hover: '#6ee7b7' },
  };
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      className="text-xs font-medium transition-colors"
      style={{ color: c.normal }}
      onMouseEnter={(e) => { e.currentTarget.style.color = c.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = c.normal; }}
    >
      {children}
    </button>
  );
}

export function UserTable({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [loadingGateway, setLoadingGateway] = useState<string | null>(null);

  const refresh = async () => {
    const res = await apiFetch<{ data: User[] }>('/api/admin/users');
    setUsers(res.data);
  };

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasDeploying = users.some((u) => u.gateway_status === 'deploying');

  useEffect(() => {
    if (hasDeploying) {
      pollingRef.current = setInterval(async () => {
        const deploying = users.filter((u) => u.gateway_status === 'deploying');
        for (const u of deploying) {
          try {
            const res = await apiFetch<{ data: { gateway_status: string } }>(
              `/api/admin/users/${u.id}/gateway/status`
            );
            if (res.data.gateway_status !== 'deploying') {
              await refresh();
              return;
            }
          } catch { /* ignore */ }
        }
      }, 2000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [hasDeploying, users]);

  const addUser = async () => {
    if (!email.trim()) return;
    setAdding(true);
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmail('');
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const toggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    await apiFetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    await refresh();
  };

  const gatewayAction = async (userId: string, action: 'deploy' | 'start' | 'stop' | 'remove' | 'redeploy') => {
    setLoadingGateway(userId);
    try {
      switch (action) {
        case 'deploy':
          await apiFetch(`/api/admin/users/${userId}/gateway`, { method: 'POST' });
          break;
        case 'start':
          await apiFetch(`/api/admin/users/${userId}/gateway/start`, { method: 'POST' });
          break;
        case 'stop':
          await apiFetch(`/api/admin/users/${userId}/gateway/stop`, { method: 'POST' });
          break;
        case 'redeploy':
          await apiFetch(`/api/admin/users/${userId}/gateway/redeploy`, { method: 'POST' });
          break;
        case 'remove':
          await apiFetch(`/api/admin/users/${userId}/gateway`, { method: 'DELETE' });
          break;
      }
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingGateway(null);
    }
  };

  const openGateway = (user: User) => {
    const hostname = window.location.hostname;
    window.open(`http://${hostname}:${user.gateway_port}/?token=${user.gateway_token}`, '_blank');
  };

  const gatewayStatusBadge = (user: User) => {
    if (!user.gateway_status) return <Badge color="gray">not deployed</Badge>;
    if (user.gateway_status === 'deploying') {
      return (
        <span className="animate-pulse-amber">
          <Badge color="blue">deploying...</Badge>
        </span>
      );
    }
    if (user.gateway_status === 'running') return <Badge color="green">running</Badge>;
    if (user.gateway_status === 'stopped') return <Badge color="yellow">stopped</Badge>;
    return <Badge color="blue">{user.gateway_status}</Badge>;
  };

  const gatewayActions = (user: User) => {
    const isLoading = loadingGateway === user.id;
    if (isLoading) {
      return (
        <span className="text-xs animate-pulse" style={{ color: 'var(--text-tertiary)' }}>
          working...
        </span>
      );
    }

    if (!user.gateway_status) {
      return <ActionBtn onClick={() => gatewayAction(user.id, 'deploy')}>Deploy</ActionBtn>;
    }

    if (user.gateway_status === 'deploying') {
      return <span className="text-xs" style={{ color: 'var(--blue)' }}>starting up...</span>;
    }

    if (user.gateway_status === 'running') {
      return (
        <span className="flex gap-3">
          <ActionBtn onClick={() => openGateway(user)} color="success">Open</ActionBtn>
          <ActionBtn onClick={() => gatewayAction(user.id, 'redeploy')}>Redeploy</ActionBtn>
          <ActionBtn onClick={() => gatewayAction(user.id, 'stop')}>Stop</ActionBtn>
          <ActionBtn onClick={() => gatewayAction(user.id, 'remove')} color="danger">Remove</ActionBtn>
        </span>
      );
    }

    if (user.gateway_status === 'stopped') {
      return (
        <span className="flex gap-3">
          <ActionBtn onClick={() => gatewayAction(user.id, 'start')} color="success">Start</ActionBtn>
          <ActionBtn onClick={() => gatewayAction(user.id, 'redeploy')}>Redeploy</ActionBtn>
          <ActionBtn onClick={() => gatewayAction(user.id, 'remove')} color="danger">Remove</ActionBtn>
        </span>
      );
    }

    return null;
  };

  return (
    <div>
      {/* Add employee form */}
      <div className="flex gap-2 mb-6">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="employee@company.com"
          className="flex-1 max-w-sm px-3 py-2 text-sm rounded-lg"
        />
        <button
          onClick={addUser}
          disabled={adding}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{
            background: 'var(--accent)',
            color: 'var(--text-inverse)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
        >
          Add Employee
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {['Name', 'Email', 'Role', 'Status', 'Gateway', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr
                key={user.id}
                className="transition-colors"
                style={{
                  borderBottom: i < users.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {user.name || '\u2014'}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {user.email}
                </td>
                <td className="px-4 py-3">
                  <Badge color={user.role === 'admin' ? 'purple' : 'gray'}>
                    {user.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge color={user.status === 'active' ? 'green' : 'red'}>
                    {user.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {gatewayStatusBadge(user)}
                    {user.gateway_port && (
                      <span
                        className="text-xs font-mono"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        :{user.gateway_port}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ActionBtn onClick={() => toggleStatus(user)}>
                      {user.status === 'active' ? 'Disable' : 'Enable'}
                    </ActionBtn>
                    {gatewayActions(user)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <p
            className="text-center py-12 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            No employees yet
          </p>
        )}
      </div>
    </div>
  );
}
