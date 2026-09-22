import type { ReactNode } from 'react';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { useSidebar } from '../context/useSidebar';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className={`transition-[padding] duration-300 ease-in-out ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
      <WorkspaceSidebar />
      {children}
    </div>
  );
}
