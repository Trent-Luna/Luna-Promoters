/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  async rewrites() {
    return [
      {
        // guestlist.lunagroup.com.au -> the public guestlist page
        source: '/',
        has: [{ type: 'host', value: 'guestlist.lunagroup.com.au' }],
        destination: '/guestlist',
      },
    ]
  },
}
module.exports = nextConfig
