-- CreateTable
CREATE TABLE "AiUsageDay" (
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiUsageDay_pkey" PRIMARY KEY ("date")
);
