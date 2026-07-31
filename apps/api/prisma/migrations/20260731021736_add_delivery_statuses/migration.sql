/*
  Warnings:

  - The values [EXPEDIE] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('NOUVEAU', 'CONFIRMATION_EN_COURS', 'CONFIRME', 'EN_PREPARATION', 'A_EXPEDIER', 'AU_DEPOT_LIVREUR', 'EN_COURS_DE_LIVRAISON', 'LIVRE', 'PAYE', 'RETOUR', 'RETOUR_DEPOT', 'RETOUR_RECU', 'ANNULE', 'A_VERIFIER');
ALTER TABLE "Order" ALTER COLUMN "orderStatus" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "orderStatus" TYPE "OrderStatus_new" USING ("orderStatus"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "orderStatus" SET DEFAULT 'NOUVEAU';
COMMIT;
