import React, { useEffect, useState } from 'react';
import { SidebarContext } from './sidebarContextValue';

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('cutcraft_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('cutcraft_sidebar_collapsed', String(collapsed));
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [collapsed]);

  const toggleCollapsed = () => {
    setCollapsedState((prev) => !prev);
  };

  const setCollapsed = (val: boolean) => {
    setCollapsedState(val);
  };

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggleCollapsed,
        setCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

