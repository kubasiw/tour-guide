-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "poiId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "note" TEXT,
    "userModified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
