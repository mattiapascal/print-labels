// app/db.server.js
import { PrismaClient } from "@prisma/client";

let prismaClient;

if (process.env.NODE_ENV === "production") {
  prismaClient = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prismaClient = global.__prisma;
}

export const prisma = prismaClient;
