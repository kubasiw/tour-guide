-- AlterTable
ALTER TABLE "PlanItem" ALTER COLUMN "dayNumber" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PlanItem_planId_poiId_key" ON "PlanItem"("planId", "poiId");
