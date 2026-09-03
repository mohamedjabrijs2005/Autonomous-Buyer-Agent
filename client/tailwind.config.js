/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C1917",
        surface: "#FBFBF9",
        panel: "#FFFFFF",
        line: "#E7E5E4",
        "line-subtle": "#F5F5F4",
        muted: "#78716C",
        "muted-light": "#A8A29E",
        gold: {
          DEFAULT: "#C77D2E",
          hover: "#B36E24",
          light: "#FDF8F3",
          border: "#EED8C0",
          dark: "#965917"
        },
        brand: "#C77D2E",
        "brand-hover": "#B36E24",
        accent: "#C77D2E",
        accent2: "#3E6E8E",
        pass: "#2E7D5B",
        "pass-bg": "#F0FDF4",
        "pass-border": "#BBF7D0",
        warn: "#C77D2E",
        "warn-bg": "#FFFBEB",
        "warn-border": "#FDE68A",
        fail: "#B23A2E",
        "fail-bg": "#FEF2F2",
        "fail-border": "#FECACA"
      },
      fontFamily: {
        display: ["'IBM Plex Sans'", "'Inter'", "system-ui", "sans-serif"],
        body: ["'Inter'", "'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"]
      },
      borderRadius: {
        lg: "8px",
        xl: "12px",
        "2xl": "12px"
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)",
        gold: "0 2px 8px -1px rgba(199, 125, 46, 0.25)"
      }
    }
  },
  plugins: []
};
