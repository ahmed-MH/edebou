import { once } from "node:events";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnvironment } from "dotenv";
import { z } from "zod";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashAdminPassword } from "../src/lib/admin/password";
import { normalizeAdminEmail } from "../src/lib/admin/security";

loadEnvironment({
  path: process.env.DATABASE_ENV_FILE ?? ".env.database",
  override: false,
  quiet: true,
});
loadEnvironment({ path: ".env.local", override: false, quiet: true });

function requiredMigrationUrl(): string {
  const value = process.env.MIGRATION_DATABASE_URL;
  if (!value) {
    throw new Error(
      "MIGRATION_DATABASE_URL est requis dans .env.database pour créer un administrateur.",
    );
  }
  return value;
}

async function readHiddenPassword(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY || !stdin.setRawMode) {
    throw new Error("Cette commande doit être exécutée dans un terminal interactif.");
  }

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let password = "";

  try {
    while (true) {
      const [chunk] = (await once(stdin, "data")) as [string];
      for (const character of chunk) {
        if (character === "\u0003") throw new Error("Création annulée.");
        if (character === "\r" || character === "\n") {
          stdout.write("\n");
          return password;
        }
        if (character === "\u007f" || character === "\b") {
          password = password.slice(0, -1);
        } else if (character >= " ") {
          password += character;
        }
      }
    }
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
  }
}

const emailSchema = z.string().trim().email().max(254);
const displayNameSchema = z.string().trim().min(2).max(120);

async function main(): Promise<void> {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("La création d’un compte admin exige un terminal interactif.");
  }

  const prompt = createInterface({ input: stdin, output: stdout });
  let displayName: string;
  let email: string;
  try {
    displayName = displayNameSchema.parse(
      await prompt.question("Nom affiché de l’administrateur : "),
    );
    email = normalizeAdminEmail(
      emailSchema.parse(await prompt.question("Adresse e-mail : ")),
    );
  } finally {
    prompt.close();
  }

  const password = await readHiddenPassword(
    "Mot de passe (14+ caractères, majuscule, minuscule, chiffre et symbole) : ",
  );
  const confirmation = await readHiddenPassword("Confirmez le mot de passe : ");
  if (password !== confirmation) {
    throw new Error("Les mots de passe ne correspondent pas.");
  }
  const passwordHash = await hashAdminPassword(password);

  const adapter = new PrismaPg({
    connectionString: requiredMigrationUrl(),
    max: 1,
    connectionTimeoutMillis: 3_000,
    statement_timeout: 8_000,
    application_name: "edebou-admin-bootstrap",
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (transaction) => {
      const user = await transaction.adminUser.upsert({
        where: { email },
        create: {
          displayName,
          email,
          passwordHash,
          role: "OWNER",
        },
        update: {
          displayName,
          passwordHash,
          role: "OWNER",
          isActive: true,
          failedLoginCount: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
        },
        select: { id: true },
      });
      await transaction.adminSession.deleteMany({ where: { userId: user.id } });
      await transaction.adminAuditLog.create({
        data: {
          actorUserId: user.id,
          action: "OWNER_ACCOUNT_BOOTSTRAPPED",
          entityType: "ADMIN_USER",
          entityId: user.id,
        },
        select: { id: true },
      });
    });
  } finally {
    await prisma.$disconnect();
  }

  stdout.write(`Compte propriétaire prêt pour ${email}.\n`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error && error.message === "ADMIN_PASSWORD_POLICY"
      ? "Le mot de passe ne respecte pas la politique demandée."
      : error instanceof Error
        ? error.message
        : "Échec de la création du compte administrateur.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
