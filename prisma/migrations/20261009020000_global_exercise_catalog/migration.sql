-- CreateEnum
CREATE TYPE "MovementPattern" AS ENUM ('SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'VERTICAL_PUSH', 'HORIZONTAL_PULL', 'VERTICAL_PULL', 'KNEE_FLEXION', 'KNEE_EXTENSION', 'ELBOW_FLEXION', 'ELBOW_EXTENSION', 'SHOULDER_ABDUCTION', 'CALF', 'CORE', 'CARRY', 'ISOLATION', 'CARDIO');

-- CreateEnum
CREATE TYPE "Laterality" AS ENUM ('BILATERAL', 'UNILATERAL', 'ALTERNATING');

-- CreateEnum
CREATE TYPE "ExerciseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "MuscleRole" AS ENUM ('PRIMARY', 'SECONDARY', 'STABILIZER');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "commonMistakesPtBr" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "equipmentTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "instructionsPtBr" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "laterality" "Laterality",
ADD COLUMN     "level" "ExerciseLevel",
ADD COLUMN     "movementPattern" "MovementPattern",
ADD COLUMN     "namePtBr" TEXT,
ADD COLUMN     "reviewStatus" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "sourceLicense" TEXT,
ADD COLUMN     "sourceRef" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Muscle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "namePtBr" TEXT NOT NULL,
    "group" "MuscleGroup" NOT NULL,
    "view" TEXT NOT NULL,

    CONSTRAINT "Muscle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseMuscle" (
    "exerciseId" TEXT NOT NULL,
    "muscleId" TEXT NOT NULL,
    "role" "MuscleRole" NOT NULL,

    CONSTRAINT "ExerciseMuscle_pkey" PRIMARY KEY ("exerciseId","muscleId")
);

-- CreateTable
CREATE TABLE "ExerciseAlias" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExerciseAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSync" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Muscle_slug_key" ON "Muscle"("slug");

-- CreateIndex
CREATE INDEX "ExerciseMuscle_muscleId_idx" ON "ExerciseMuscle"("muscleId");

-- CreateIndex
CREATE INDEX "ExerciseAlias_normalized_idx" ON "ExerciseAlias"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseAlias_exerciseId_normalized_key" ON "ExerciseAlias"("exerciseId", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");

-- CreateIndex
CREATE INDEX "Exercise_userId_active_idx" ON "Exercise"("userId", "active");

-- AddForeignKey
ALTER TABLE "ExerciseMuscle" ADD CONSTRAINT "ExerciseMuscle_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMuscle" ADD CONSTRAINT "ExerciseMuscle_muscleId_fkey" FOREIGN KEY ("muscleId") REFERENCES "Muscle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAlias" ADD CONSTRAINT "ExerciseAlias_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

