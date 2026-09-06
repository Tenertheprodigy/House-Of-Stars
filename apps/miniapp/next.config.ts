import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
try {
  process.loadEnvFile(path.join(workspaceRoot, ".env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: [
    "@house-of-stars/database",
    "@house-of-stars/shared",
    "@house-of-stars/telegram",
  ],
};
export default nextConfig;
