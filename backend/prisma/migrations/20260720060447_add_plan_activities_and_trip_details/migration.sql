-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "activities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "startDate" TIMESTAMP(3);
