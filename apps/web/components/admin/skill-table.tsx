'use client';

import { useState } from 'react';
import type { Skill } from '@clawteam/shared';
import { apiFetch } from '@/lib/api';

interface Props {
  initialSkills: Skill[];
}

function Badge({ color, children }: { color: 'green' | 'red' | 'yellow' | 'blue' | 'gray'; children: React.ReactNode }) {
  const styles: Record<string, { bg: string; text: string }> = {
    green:  { bg: 'var(--green-muted)',  text: 'var(--green)' },
    red:    { bg: 'var(--red-muted)',    text: 'var(--red)' },
    yellow: { bg: 'var(--yellow-muted)', text: 'var(--yellow)' },
    blue:   { bg: 'var(--blue-muted)',   text: 'var(--blue)' },
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

function ActionBtn({ onClick, color = 'default', children }: { onClick: () => void; color?: 'default' | 'danger'; children: React.ReactNode }) {
  const colorMap = {
    default: { normal: 'var(--accent)', hover: 'var(--accent-hover)' },
    danger:  { normal: 'var(--red)',    hover: '#fca5a5' },
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

export function SkillTable({ initialSkills }: Props) {
  const [skills, setSkills] = useState(initialSkills);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    const res = await apiFetch<{ data: Skill[] }>('/api/admin/skills');
    setSkills(res.data);
  };

  const addSkill = async () => {
    if (!name.trim() || !path.trim()) return;
    setAdding(true);
    try {
      await apiFetch('/api/admin/skills', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), path: path.trim() }),
      });
      setName('');
      setPath('');
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const toggleEnabled = async (skill: Skill) => {
    await apiFetch(`/api/admin/skills/${skill.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !skill.enabled }),
    });
    await refresh();
  };

  const deleteSkill = async (skill: Skill) => {
    if (!confirm(`Delete skill "${skill.name}"?`)) return;
    await apiFetch(`/api/admin/skills/${skill.id}`, { method: 'DELETE' });
    await refresh();
  };

  const typeColors: Record<string, 'red' | 'blue' | 'yellow'> = {
    mandatory: 'red',
    optional: 'blue',
    restricted: 'yellow',
  };

  return (
    <div>
      {/* Add skill form */}
      <div className="flex gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Skill name"
          className="px-3 py-2 text-sm rounded-lg"
        />
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Path (e.g. web-search)"
          className="flex-1 max-w-sm px-3 py-2 text-sm rounded-lg"
        />
        <button
          onClick={addSkill}
          disabled={adding}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{
            background: 'var(--accent)',
            color: 'var(--text-inverse)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
        >
          Add Skill
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
              {['Name', 'Path', 'Type', 'Status', 'Actions'].map((h) => (
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
            {skills.map((skill, i) => (
              <tr
                key={skill.id}
                className="transition-colors"
                style={{
                  borderBottom: i < skills.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {skill.name}
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {skill.path}
                </td>
                <td className="px-4 py-3">
                  <Badge color={typeColors[skill.type] || 'gray'}>
                    {skill.type}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge color={skill.enabled ? 'green' : 'gray'}>
                    {skill.enabled ? 'enabled' : 'disabled'}
                  </Badge>
                </td>
                <td className="px-4 py-3 space-x-3">
                  <ActionBtn onClick={() => toggleEnabled(skill)}>
                    {skill.enabled ? 'Disable' : 'Enable'}
                  </ActionBtn>
                  <ActionBtn onClick={() => deleteSkill(skill)} color="danger">
                    Delete
                  </ActionBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {skills.length === 0 && (
          <p
            className="text-center py-12 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            No skills configured
          </p>
        )}
      </div>
    </div>
  );
}
