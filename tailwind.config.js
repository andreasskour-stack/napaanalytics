/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        napa: {
          navy: "#0B1F3B",
          navy2: "#163A5F",
          teal: "#2FB9C5",
          white: "#FFFFFF",
        },
      },
    },
  },
  plugins: [],
};
