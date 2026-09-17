import type { ReactNode } from 'react';
import { WorkspaceSidebar } from './WorkspaceSidebar';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return <div className="lg:pl-64"><WorkspaceSidebar />{children}</div>;
}
