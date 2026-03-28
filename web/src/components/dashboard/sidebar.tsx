'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Gavel,
  Search,
  MessageSquare,
  User,
  Sparkles,
  BookOpen,
  Users,
  Mail,
  Calendar,
  FilePen,
  LayoutDashboard,
  Briefcase,
  LucideIcon,
} from 'lucide-react';
import SignOutButton from '@/components/auth/sign-out-button';

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Gavel, Search, MessageSquare, User, Sparkles,
  BookOpen, Users, Mail, Calendar, FilePen, LayoutDashboard, Briefcase,
};

const COLLAPSED_WIDTH = 72;
const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 72;
const MAX_WIDTH = 400;
const COLLAPSE_THRESHOLD = 120;

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  category?: string;
}

interface SidebarProps {
  items: NavItem[];
  branding: { title: string; icon: string };
}

export default function DashboardSidebar({ items, branding }: SidebarProps) {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDTH;
    const savedWidth = window.localStorage.getItem('sidebar-width');
    if (!savedWidth) return DEFAULT_WIDTH;
    const parsed = Number.parseInt(savedWidth, 10);
    if (Number.isNaN(parsed)) return DEFAULT_WIDTH;
    return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed));
  });
  const pathname = usePathname();
  const isDragging = useRef(false);
  const lastSavedWidth = useRef(width);

  const isCollapsed = width <= COLLAPSE_THRESHOLD;

  const persist = (w: number) => {
    localStorage.setItem('sidebar-width', String(w));
    lastSavedWidth.current = w;
  };

  // Toggle: if expanded → collapse; if collapsed → restore last expanded width
  const toggleSidebar = () => {
    if (isCollapsed) {
      const target = lastSavedWidth.current > COLLAPSE_THRESHOLD ? lastSavedWidth.current : DEFAULT_WIDTH;
      setWidth(target);
      persist(target);
    } else {
      persist(width); // save current expanded width before collapsing
      setWidth(COLLAPSED_WIDTH);
      localStorage.setItem('sidebar-width', String(COLLAPSED_WIDTH));
    }
  };

  // ── Drag-to-resize ────────────────────────────────────────────
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX));
    setWidth(newWidth);
  }, []);

  const onMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // Stay exactly where released — no snapping
    const finalWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX));
    setWidth(finalWidth);
    persist(finalWidth);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  // ────────────────────────────────────────────────────────────────

  const BrandIcon = ICON_MAP[branding.icon] ?? Briefcase;

  const categories: string[] = [];
  items.forEach((item) => {
    const cat = item.category ?? '';
    if (!categories.includes(cat)) categories.push(cat);
  });

  return (
    <aside
      className="relative flex flex-col bg-white border-r border-gray-200 shadow-sm flex-shrink-0"
      style={{ width, height: '100vh', minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}
    >
      {/* ── Branding strip ── */}
      <div className="flex-shrink-0 px-3 pt-4 pb-3">
        <div
          className={`flex items-center gap-2 p-2.5 rounded-lg bg-gradient-to-r from-teal-700 to-teal-600 shadow-sm ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <div className="p-1 bg-white/20 rounded flex-shrink-0">
            <BrandIcon className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-sm font-bold text-white tracking-wide truncate">
              {branding.title}
            </span>
          )}
        </div>
      </div>

      {/* ── Collapse toggle — its own dedicated row ── */}
      <div className={`flex-shrink-0 px-3 pb-2 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <button
          onClick={toggleSidebar}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-teal-600 hover:bg-teal-50 border border-gray-100 hover:border-teal-200 transition-all ${
            isCollapsed ? 'justify-center w-10' : 'w-full'
          }`}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 flex-shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      <div className="h-px bg-gray-100 mx-3 mb-1 flex-shrink-0" />

      {/* ── Scrollable nav ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        <nav>
          {categories.map((cat) => {
            const catItems = items.filter((i) => (i.category ?? '') === cat);
            return (
              <div key={cat} className="mb-3">
                {cat && !isCollapsed && (
                  <p className="px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    {cat}
                  </p>
                )}
                {cat && isCollapsed && <div className="h-px bg-gray-100 mx-1 mb-2" />}
                <div className="space-y-0.5">
                  {catItems.map((item) => {
                    const Icon = ICON_MAP[item.icon] ?? Home;
                    const isActive =
                      item.href === '/dashboard/advocate' || item.href === '/dashboard/client'
                        ? pathname === item.href
                        : pathname.startsWith(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={isCollapsed ? item.label : undefined}
                        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm group ${
                          isActive
                            ? 'bg-teal-50 text-teal-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-teal-600'
                        } ${isCollapsed ? 'justify-center' : ''}`}
                      >
                        {isActive && isCollapsed && (
                          <span className="absolute left-0 w-1 h-6 bg-teal-600 rounded-r-full" />
                        )}
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? 'text-teal-600' : 'text-gray-400 group-hover:text-teal-500'
                          }`}
                        />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* ── Fixed bottom: sign out ── */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white p-3">
        <SignOutButton isCollapsed={isCollapsed} />
      </div>

      {/* ── Drag handle on right edge ── */}
      <div
        onMouseDown={startDrag}
        className="absolute top-0 right-0 w-2 h-full cursor-col-resize z-20 group"
        title="Drag to resize"
      >
        <div className="absolute inset-y-0 left-1/2 w-px bg-transparent group-hover:bg-teal-400 group-active:bg-teal-600 transition-colors" />
      </div>
    </aside>
  );
}
