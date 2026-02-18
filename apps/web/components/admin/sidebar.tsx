'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Employees', href: '/admin' },
  { label: 'Skills', href: '/admin/skills' },
  { label: 'API Keys', href: '/admin/api-keys' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 border-r border-gray-200 bg-gray-50 p-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Admin
      </h2>
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded-lg text-sm ${
              pathname === item.href
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
