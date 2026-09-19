import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Los seeds se ejecutan con `npm run db:seed` (tsx), no hace falta `prisma db seed`.
});
