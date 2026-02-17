/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background colors
        'bg-primary': '#000000',
        'bg-secondary': '#121212',
        'bg-tertiary': '#1E1E1E',
        'bg-elevated': '#252525',
        'bg-hover': '#2A2A2A',

        // Text colors
        'text-primary': '#FFFFFF',
        'text-secondary': '#A1A1AA',
        'text-tertiary': '#71717A',
        'text-disabled': '#52525B',

        // Theme colors
        'primary': {
          DEFAULT: '#10B981',  // Emerald
          hover: '#34D399',
          muted: 'rgba(16, 185, 129, 0.15)',
        },
        'secondary': '#6EE7B7',

        // Accent colors
        'accent': {
          DEFAULT: '#F97316',
          hover: '#FB923C',
        },

        // Status colors
        'success': {
          DEFAULT: '#10B981',
          muted: 'rgba(16, 185, 129, 0.15)',
        },
        'warning': {
          DEFAULT: '#F59E0B',
          muted: 'rgba(245, 158, 11, 0.15)',
        },
        'error': {
          DEFAULT: '#EF4444',
          muted: 'rgba(239, 68, 68, 0.15)',
        },
        'info': {
          DEFAULT: '#3B82F6',
          muted: 'rgba(59, 130, 246, 0.15)',
        },

        // Border colors
        'border': {
          DEFAULT: '#27272A',
          hover: '#3F3F46',
          focus: '#10B981',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.5)',
        'md': '0 4px 6px rgba(0, 0, 0, 0.5)',
        'lg': '0 10px 15px rgba(0, 0, 0, 0.5)',
        'glow': '0 0 20px rgba(16, 185, 129, 0.3)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
        'slow': '300ms',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-out-right': 'slideOutRight 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.2s ease-out',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
