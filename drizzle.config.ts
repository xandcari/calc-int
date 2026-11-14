import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit no lee .env.local solo (eso lo hace Next): se carga acá a mano.
config({ path: ".env.local" });
config();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
