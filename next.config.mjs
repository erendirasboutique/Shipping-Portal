/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // The shared brand logo is served by the Customer Portal.
    remotePatterns: [{ protocol: "https", hostname: "my.erendirasboutique.com", pathname: "/brand/**" }],
  },
};
export default nextConfig;
