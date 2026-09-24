import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'maps.gstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // Only genuinely public (NEXT_PUBLIC_) values that need to be inlined into the
  // client bundle belong here. Server-only secrets (OPENAI_API_KEY, STRIPE_SECRET_KEY,
  // WEATHER_API_KEY, etc.) must NOT appear in this block — they are already available
  // in API routes via process.env and would be leaked to the browser if placed here.
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_GOOGLE_PLACES_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;