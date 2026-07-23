-- CreateTable
CREATE TABLE "Trail" (
    "id" TEXT NOT NULL,
    "osmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ref" TEXT,
    "colour" TEXT,
    "distanceKm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTrailItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "trailId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanTrailItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trail_osmId_key" ON "Trail"("osmId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanTrailItem_planId_trailId_key" ON "PlanTrailItem"("planId", "trailId");

-- AddForeignKey
ALTER TABLE "PlanTrailItem" ADD CONSTRAINT "PlanTrailItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTrailItem" ADD CONSTRAINT "PlanTrailItem_trailId_fkey" FOREIGN KEY ("trailId") REFERENCES "Trail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
