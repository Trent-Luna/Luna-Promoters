import localFont from 'next/font/local'

// Michroma (SIL Open Font License, see ./fonts/Michroma-OFL.txt): the display
// face for card and section titles in the Silver glass skin, the same file
// Atlas uses. Local, so a build never depends on reaching Google Fonts.
export const displayFont = localFont({
  src: './fonts/Michroma-Regular.ttf',
  weight: '400',
  display: 'swap',
  variable: '--font-display',
})
