/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12141C",
        surface: "#F7F7F5",
        panel: "#FFFFFF",
        line: "#E4E4E0",
        accent: "#C77D2E",
        pass: "#2E7D5B",
        fail: "#B23A2E",
        muted: "#8A8A85"
      },
      fontFamily: {
        display: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"]
      }
    }
  },
  plugins: []
};
