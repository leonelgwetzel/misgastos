-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('admin', 'cliente');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "perfil" "PerfilUsuario" NOT NULL DEFAULT 'cliente';
ALTER TABLE "Usuario" ADD COLUMN "habilitado" BOOLEAN NOT NULL DEFAULT true;

-- Existing accounts stay usable; the first / known owner becomes admin
UPDATE "Usuario" SET "habilitado" = true;
UPDATE "Usuario" SET "perfil" = 'admin' WHERE "email" = 'leonelgwetzel@outlook.com';
UPDATE "Usuario" SET "perfil" = 'admin'
WHERE "id" = (SELECT "id" FROM "Usuario" ORDER BY "createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "Usuario" WHERE "perfil" = 'admin');

-- New public requests start pending
ALTER TABLE "Usuario" ALTER COLUMN "habilitado" SET DEFAULT false;
