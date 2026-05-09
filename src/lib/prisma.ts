import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __ggitemPrisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (globalThis.__ggitemPrisma) {
    return globalThis.__ggitemPrisma;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Prisma storage mode.");
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  globalThis.__ggitemPrisma = new PrismaClient({
    adapter,
  });

  return globalThis.__ggitemPrisma;
}
