-- CreateIndex
CREATE INDEX "Program_userId_idx" ON "Program"("userId");

-- CreateIndex
CREATE INDEX "Workout_programId_order_idx" ON "Workout"("programId", "order");

-- CreateIndex
CREATE INDEX "ProgramExercise_workoutId_order_idx" ON "ProgramExercise"("workoutId", "order");

-- CreateIndex
CREATE INDEX "ProgramExercise_exerciseId_idx" ON "ProgramExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "Session_workoutId_idx" ON "Session"("workoutId");

-- CreateIndex
CREATE INDEX "Session_programId_idx" ON "Session"("programId");

-- CreateIndex
CREATE INDEX "Session_gymId_idx" ON "Session"("gymId");

-- CreateIndex
CREATE INDEX "Set_sessionId_exerciseId_idx" ON "Set"("sessionId", "exerciseId");

-- CreateIndex
CREATE INDEX "CoachSession_userId_weekStart_idx" ON "CoachSession"("userId", "weekStart");

