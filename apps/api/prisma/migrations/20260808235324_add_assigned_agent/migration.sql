-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "assignedAgentId" TEXT,
ADD COLUMN     "assignedAgentName" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3);
