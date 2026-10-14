import { useContext } from 'react';
import { AdminCoursesContext } from './adminCoursesContextValue';

export function useAdminCourses() {
  const context = useContext(AdminCoursesContext);
  if (!context) {
    throw new Error('useAdminCourses must be used within an AdminCoursesProvider');
  }
  return context;
}

