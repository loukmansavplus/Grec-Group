/** Config Tailwind du site public (build : npm run build:css) */
module.exports = {
  content: ['./index.html', './pages/**/*.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        gold: '#C8893A',
        'gold-light': '#E5A84B',
        navy: '#0D1B2A',
        'navy-mid': '#1A2E42',
        cream: '#F2EDE3',
        'off-white': '#F8F5EF',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
};
