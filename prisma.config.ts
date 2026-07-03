import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

try {
  loadEnvFile(".env");
} catch {
  // no .env file — rely on the process environment
}

// Placeholder keeps `prisma validate/generate` working before Supabase is
// configured; `prisma migrate` needs the real URLs in .env.
const PLACEHOLDER = "postgresql://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma CLI connects directly; prefer DIRECT_URL (port 5432) for
    // migrations and fall back to DATABASE_URL.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || PLACEHOLDER,
  },
});
