import { useContext } from 'react';
import { SidebarContext } from './sidebarContextValue';

export function useSidebar() {
  const context = useContext(SidebarContext);
  return context;
}

