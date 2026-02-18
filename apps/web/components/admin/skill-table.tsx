'use client';

import { useState } from 'react';
import type { Skill } from '@clawteam/shared';
import { apiFetch } from '@/lib/api';

interface Props {
  initialSkills: Skill[];
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

  const typeColors: Record<string, string> = {
    mandatory: 'bg-red-100 text-red-700',
    optional: 'bg-blue-100 text-blue-700',
    restricted: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Skill name"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Path (e.g. web-search)"
          className="flex-1 max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addSkill}
          disabled={adding}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Add Skill
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Path</th>
            <th className="pb-3 font-medium">Type</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {skills.map((skill) => (
            <tr key={skill.id}>
              <td className="py-3 font-medium">{skill.name}</td>
              <td className="py-3 text-gray-600 font-mono text-xs">{skill.path}</td>
              <td className="py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[skill.type] || ''}`}>
                  {skill.type}
                </span>
              </td>
              <td className="py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  skill.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {skill.enabled ? 'enabled' : 'disabled'}
                </span>
              </td>
              <td className="py-3 space-x-2">
                <button onClick={() => toggleEnabled(skill)} className="text-sm text-blue-600 hover:underline">
                  {skill.enabled ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => deleteSkill(skill)} className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {skills.length === 0 && (
        <p className="text-center text-gray-400 py-8">No skills configured</p>
      )}
    </div>
  );
}
