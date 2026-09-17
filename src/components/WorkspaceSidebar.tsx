import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, BookOpen, CalendarDays, ChevronLeft, ChevronRight, FileCheck2, Home, Menu, X } from 'lucide-react';
import { useAuth } from '../context/useAuth';

const links = [
  { to: '/admin', label: 'Overview', icon: BarChart3 },
  { to: '/admin/courses', label: 'Course content', icon: BookOpen },
  { to: '/review/submissions', label: 'Review queue', icon: FileCheck2 },
  { to: '/student/dashboard', label: 'Student view', icon: Home },
];

export function WorkspaceSidebar() {
  const { profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const visibleLinks = profile?.role === 'admin'
    ? links
    : links.filter((link) => link.to === '/review/submissions' || link.to === '/student/dashboard');
  const navigation = <nav className="space-y-1">{visibleLinks.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/admin'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${isActive ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'} ${collapsed ? 'justify-center' : ''}`} title={collapsed ? label : undefined}><Icon size={19} className="shrink-0" />{!collapsed && <span>{label}</span>}</NavLink>)}</nav>;
  return <><button onClick={() => setMobileOpen(true)} className="fixed left-4 top-4 z-40 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm lg:hidden" aria-label="Open workspace navigation"><Menu size={19} /></button>{mobileOpen && <button className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close workspace navigation" />}<aside className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white p-5 shadow-xl transition-transform lg:translate-x-0 lg:shadow-none ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}><div className={`mb-8 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white"><CalendarDays size={18} /></span>{!collapsed && <div><p className="text-sm font-black tracking-tight text-slate-950">CUT / CRAFT</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Workspace</p></div>}</div><button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-slate-400 lg:hidden" aria-label="Close navigation"><X size={18} /></button></div>{!collapsed && <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Navigate</p>}{navigation}<button onClick={() => setCollapsed(!collapsed)} className="absolute bottom-5 right-4 hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-950 lg:block" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button></aside></>;
}
