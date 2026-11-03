// Generates public/memberships/university/qr-university.png
// Run: node scripts/gen-university-qr.mjs
import QRCode from 'qrcode'
const URL = 'https://memberships.lunagroup.com.au/memberships/university'
await QRCode.toFile('public/memberships/university/qr-university.png', URL, {
  width: 600, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#07080B', light: '#FFFFFF' },
})
console.log('QR written for', URL)
