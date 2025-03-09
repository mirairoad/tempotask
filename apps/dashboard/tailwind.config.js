import * as tailwindcssPrimeui from 'tailwindcss-primeui';

/** @type {import('tailwindcss').Config} */
module.exports = {
  safelist: ['dark'],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    '../shared/src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {},
  plugins: [tailwindcssPrimeui],
};
