/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#005F56',
        hover: '#004E46',
        accent: '#2DD4BF',
        darkNavy: '#081521',
        background: '#F7F9FB',
        card: '#FFFFFF',
      },
    },
  },
  plugins: [],
};

