/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        surface: "#F8FAFC",
        panel: "#FFFFFF",
        line: "#E2E8F0",
        "line-subtle": "#F1F5F9",
        muted: "#64748B",
        "muted-light": "#94A3B8",
        brand: "#0F172A",
        "brand-hover": "#1E293B",
        accent: "#2563EB",
        accent2: "#475569",
        pass: "#059669",
        "pass-bg": "#ECFDF5",
        "pass-border": "#A7F3D0",
        warn: "#D97706",
        "warn-bg": "#FFFBEB",
        "warn-border": "#FDE68A",
        fail: "#DC2626",
        "fail-bg": "#FFF1F2",
        "fail-border": "#FECDD3"
      },
      fontFamily: {
        display: ["'Inter'", "'IBM Plex Sans'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "'JetBrains Mono'", "ui-monospace", "monospace"]
      },
      borderRadius: {
        lg: "8px",
        xl: "12px",
        "2xl": "12px"
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)"
      }
    }
  },
  plugins: []
};
