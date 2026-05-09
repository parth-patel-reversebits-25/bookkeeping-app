'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  LayoutDashboard,
  FileText,
  Receipt,
  GitMerge,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bank-statements', label: 'Bank Statements', icon: FileText },
  { href: '/receipts', label: 'Receipts', icon: Receipt },
  { href: '/match-transactions', label: 'Match Transactions', icon: GitMerge },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-background">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <BookOpen className="h-5 w-5 text-primary" />
        <span className="text-lg font-semibold tracking-tight">Ledger</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
