/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ไม่ให้ TypeScript / ESLint error หยุด production build บน Vercel
  // (โปรเจกต์นี้รัน `npm run typecheck` แยกใน CI แล้ว)
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // ให้ Next.js bundle server dependencies ที่มี native binding ให้ทำงานบน Vercel ได้
    serverComponentsExternalPackages: [
      '@react-pdf/renderer',
      'exceljs',
      '@supabase/supabase-js',
    ],
  },
};

module.exports = nextConfig;
