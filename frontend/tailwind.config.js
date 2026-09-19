/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: '#FFFFFF',
        'surface-muted': '#F5F5FA',
        border: '#E8E8F0',
        ink: '#17171F',
        'ink-muted': '#6B6B7B',

        'surface-dark': '#0E0E12',
        'surface-dark-muted': '#17171C',
        'border-dark': '#2A2A32',
        'ink-dark': '#F5F5F7',
        'ink-dark-muted': '#9B9BAA',

        brand: {
          50: '#F4F1FF',
          100: '#E9E3FF',
          300: '#B9A6FF',
          400: '#9F84FF',
          500: '#7C5CFC',
          600: '#6A46F0',
          700: '#5A38D6',
          800: '#4A2FAD',
        },
        accent: {
          400: '#F0ABFC',
          500: '#D946EF',
        },

        role: {
          student: '#22C55E',
          admin: '#7C5CFC',
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
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,23,31,0.04), 0 2px 8px rgba(23,23,31,0.04)',
        'card-hover': '0 2px 4px rgba(23,23,31,0.05), 0 12px 28px rgba(23,23,31,0.10)',
        sidebar: '1px 0 0 rgba(0,0,0,0.05)',
        glow: '0 0 0 4px rgba(124,92,252,0.14)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6A46F0 0%, #7C5CFC 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, rgba(124,92,252,0.12) 0%, rgba(124,92,252,0.05) 100%)',
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
