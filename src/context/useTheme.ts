import { useContext } from 'react';
import { ThemeContext } from './themeContextValue';

export function useTheme() {
  const context = useContext(ThemeContext);
  return context;
}
