import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrlFromDotEnv } from "../paths.ts";

ensureDatabaseUrlFromDotEnv();

export const prisma = new PrismaClient();
