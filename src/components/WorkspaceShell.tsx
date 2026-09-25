import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { useSidebar } from '../context/useSidebar';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  const location = useLocation();

  const isTopNavRoute =
    location.pathname.startsWith('/student') ||
    location.pathname.startsWith('/community') ||
    location.pathname.startsWith('/messages');

  if (isTopNavRoute) {
    return <>{children}</>;
  }

  return (
    <div className={`transition-[padding] duration-300 ease-in-out ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
      <WorkspaceSidebar />
      {children}
    </div>
  );
}
