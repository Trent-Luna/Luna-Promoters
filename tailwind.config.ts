import type { Config } from 'tailwindcss'

/**
 * Palette mirrors Luna Atlas (atlas.lunagroup.com.au) so the Promoters admin
 * reads as the same product. Values were sampled from Atlas's computed styles:
 *
 *   page background   rgb(9,9,11)          #09090b
 *   sidebar           rgb(14,14,16)        #0e0e10   (240px wide)
 *   card / panel      rgb(23,23,26)        #17171a   (12px radius)
 *   hairline border   rgba(255,255,255,.07)
 *   body text         rgb(250,250,250)     #fafafa
 *   muted text        rgb(138,138,144)     #8a8a90
 *   secondary text    rgb(161,161,166)     #a1a1a6
 *   accent (gold)     rgb(212,162,76)      #d4a24c   active fill @ 12%
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        luna: {
          bg:      '#09090b',
          surface: '#0e0e10',
          card:    '#17171a',
          border:  '#1e1e22',
          // Atlas accent. This was previously flattened to #ffffff for a
          // monochrome look; restored so admin matches Atlas.
          gold:    '#d4a24c',
          goldsoft:'#e0b877',
          purple:  '#6b6b74',
          text:    '#fafafa',
          muted:   '#8a8a90',
          subtle:  '#a1a1a6',
        },
      },
      borderColor: { hairline: 'rgba(255,255,255,0.07)' },
      fontFamily: {
        sans: [
          'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI',
          'Roboto', 'Helvetica', 'Arial', 'sans-serif',
        ],
      },
      maxWidth: { atlas: '1280px' },
      boxShadow: { glow: '0 0 30px rgba(212,162,76,0.10)' },
    },
  },
  plugins: [],
}
export default config
