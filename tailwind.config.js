/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#040A14',
          900: '#07111F',
          800: '#0E1B2D',
          700: '#15263D',
          600: '#1E3452',
        },
        arena: {
          blue: '#2583FF',
          red: '#FF455A',
          cyan: '#3EE7FF',
          success: '#35D49A',
          warning: '#FFC857',
          purple: '#A66BFF',
          text: '#F5F8FF',
          muted: '#A8B7CC',
        },
      },
      fontFamily: {
        logo: ['Orbitron', 'Oxanium', 'system-ui', 'sans-serif'],
        display: ['Oxanium', 'Exo 2', 'system-ui', 'sans-serif'],
        sans: ['"Exo 2"', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(62, 231, 255, 0.25)',
        'glow-blue': '0 0 32px rgba(37, 131, 255, 0.45)',
        'glow-red': '0 0 32px rgba(255, 69, 90, 0.45)',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        scan: 'scan 3s linear infinite',
      },
    },
  },
  plugins: [],
};
