/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: '#FFFFFF',
        'surface-muted': '#F7F7F8',
        border: '#E5E5E8',
        ink: '#18181B',
        'ink-muted': '#71717A',

        'surface-dark': '#121214',
        'surface-dark-muted': '#1C1C1F',
        'border-dark': '#2A2A2E',
        'ink-dark': '#F4F4F5',
        'ink-dark-muted': '#A1A1AA',

        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          300: '#A5B4FC',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },

        role: {
          student: '#22C55E',
          admin: '#6366F1',
          advisor: '#F59E0B',
          super: '#EF4444',
        },

        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
        'card-hover': '0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.10)',
        sidebar: '1px 0 0 rgba(0,0,0,0.05)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '320ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
}
