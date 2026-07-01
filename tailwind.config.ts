import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        luna: {
          bg:      '#0a0a0f',
          surface: '#12121a',
          card:    '#1a1a24',
          border:  '#2a2a38',
          gold:    '#d4af37',
          goldsoft:'#e8d48a',
          purple:  '#7c3aed',
          text:    '#f5f5f7',
          muted:   '#9a9aa8',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { glow: '0 0 40px rgba(212,175,55,0.15)' },
    },
  },
  plugins: [],
}
export default config
