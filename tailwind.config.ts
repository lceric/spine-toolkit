import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      boxShadow: {
        panel: '0 18px 60px rgba(15, 23, 42, 0.12)',
        dock: '0 24px 80px rgba(79, 70, 229, 0.24), 0 12px 32px rgba(15, 23, 42, 0.18)'
      }
    }
  },
  plugins: []
};

export default config;
