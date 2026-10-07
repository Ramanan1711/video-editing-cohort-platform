/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'surface-base': '#050811',
        'surface-card': '#0a0f1d',
        'surface-elevated': '#10172a',
        'surface-subtle': 'rgba(255, 255, 255, 0.08)',
      },
      borderColor: {
        'surface-subtle': 'rgba(255, 255, 255, 0.08)',
      },
      boxShadow: {
        'specular': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
      },
    },
  },
  plugins: [],
};

