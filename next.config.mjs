import { execSync } from "node:child_process";

/* The commit this build is from, built into both the browser's and the
   server's code as NEXT_PUBLIC_APP_VERSION, so an installed app can tell it's
   out of date after a deploy (see lib/app-version.ts). Railway provides it;
   anywhere else it's read from git, and without either the check is off. */
function appVersion() {
  if (process.env.RAILWAY_GIT_COMMIT_SHA) return process.env.RAILWAY_GIT_COMMIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion() },
  // the service worker is always checked for a newer copy, so a deploy's
  // changes to it reach installed apps without waiting out a cache
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
};

export default nextConfig;
