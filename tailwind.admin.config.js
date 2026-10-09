/** Config Tailwind du tableau de bord (npm run build:css) */
module.exports = {
  content: ['./admin/**/*.html'],
  theme: {
    extend: {
      opacity: { 8: '0.08', 72: '0.72', 78: '0.78' },
      colors: {
        gold: '#C8893A',
        'gold-light': '#E5A84B',
        navy: '#0D1B2A',
        'navy-mid': '#1A2E42',
        cream: '#F7F4EE',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
};
