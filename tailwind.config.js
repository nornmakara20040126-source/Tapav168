/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Khmer first, then fallbacks
        sans: [
          '"Noto Sans Khmer"',
          '"Khmer OS Battambang"',
          '"Khmer OS Siemreap"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}