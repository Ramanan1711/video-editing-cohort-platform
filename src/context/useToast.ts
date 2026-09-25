import { useContext } from 'react';
import { ToastContext } from './toastContextValue';

const fallbackToast = {
  showToast: () => '',
  success: () => '',
  error: () => '',
  warning: () => '',
  info: () => '',
  removeToast: () => {},
};

export function useToast() {
  const context = useContext(ToastContext);
  return context ?? fallbackToast;
}

