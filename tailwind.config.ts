import type { Config } from 'tailwindcss'

/**
 * The `luna-*` colours now resolve through CSS variables rather than being
 * baked in here.
 *
 * The reason is that this app serves two audiences from one set of classes.
 * Guests reach the sign-up and guestlist pages, which are branded to match
 * lunagroup.com.au — pure black, monochrome white. Staff reach the admin,
 * reception, venue and promoter screens, which sit beside Atlas all day and
 * should look like Atlas. Variables let the signed-in shell swap the whole
 * palette with one class (`.atlas-surface`, defined in globals.css) without a
 * single className changing and without the guest pages being able to inherit
 * it.
 *
 * Channel triples rather than hex, so Tailwind's opacity modifiers keep
 * working — `bg-luna-bg/85` on the sticky header depends on it.
 */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        luna: {
          bg:      rgb('--luna-bg'),
          surface: rgb('--luna-surface'),
          card:    rgb('--luna-card'),
          border:  rgb('--luna-border'),
          // "gold" is the primary-action token. On guest pages it stays Luna
          // monochrome white; on staff screens it becomes Atlas gold.
          gold:    rgb('--luna-gold'),
          goldsoft:rgb('--luna-goldsoft'),
          purple:  rgb('--luna-purple'),
          text:    rgb('--luna-text'),
          muted:   rgb('--luna-muted'),
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { glow: '0 0 30px rgba(255,255,255,0.10)' },
    },
  },
  plugins: [],
}
export default config
