import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f1f5fb", 100: "#e1e9f5", 200: "#c3d3ea", 300: "#94afd6", 400: "#5f84bb",
          500: "#3d64a0", 600: "#2d4d82", 700: "#243f6a", 800: "#1c3156", 900: "#142443", 950: "#0b1730",
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
