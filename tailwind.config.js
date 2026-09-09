/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./dashboard.html', './CampusFlowDashboard.jsx', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1E293B',
        indigo: { 600: '#4F46E5' },
      },
    },
  },
  plugins: [],
};
