import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        luna: {
          bg:      '#000000',
          surface: '#0d0d0f',
          card:    '#141416',
          border:  '#26262b',
          // "gold" token retained for compatibility but now Luna monochrome white
          gold:    '#ffffff',
          goldsoft:'#ffffff',
          purple:  '#6b6b74',
          text:    '#ffffff',
          muted:   '#8a8a92',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { glow: '0 0 30px rgba(255,255,255,0.10)' },
    },
  },
  plugins: [],
}
export default config
