import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        store: {
          bg: "#f2f2f7",
          card: "#ffffff",
          accent: "#007aff",
          muted: "#8e8e93",
          border: "#e5e5ea",
        },
      },
      boxShadow: {
        card: "0 2px 12px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
