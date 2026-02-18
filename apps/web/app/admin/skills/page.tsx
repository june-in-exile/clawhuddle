import { SkillTable } from '@/components/admin/skill-table';

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function getSkills() {
  try {
    const res = await fetch(`${API_URL}/api/admin/skills`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export default async function SkillsPage() {
  const skills = await getSkills();

  return (
    <div>
      <h1
        className="text-xl font-semibold tracking-tight mb-6"
        style={{ color: 'var(--text-primary)' }}
      >
        Skills
      </h1>
      <SkillTable initialSkills={skills} />
    </div>
  );
}
