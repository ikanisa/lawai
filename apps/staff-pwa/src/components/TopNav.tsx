'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const links = [
  { href: '/', label: 'Today' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/offline', label: 'Offline guide' },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation">
      <ul
        style={{
          display: 'flex',
          gap: '0.75rem',
          listStyle: 'none',
          padding: 0,
          margin: '1rem 0 1.5rem',
          flexWrap: 'wrap',
        }}
      >
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={clsx('badge', {
                active: pathname === link.href,
              })}
              style={{
                background: pathname === link.href ? 'rgba(56, 189, 248, 0.32)' : undefined,
                color: pathname === link.href ? '#0f172a' : undefined,
              }}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
