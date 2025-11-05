-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'TRAINER', 'CLIENT') NOT NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainerProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `bio` TEXT NULL,
    `specializations` JSON NULL,
    `certifications` JSON NULL,
    `yearsExperience` INTEGER NULL,
    `hourlyRate` DOUBLE NULL,
    `timezone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TrainerProfile_userId_key`(`userId`),
    INDEX `TrainerProfile_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `gender` VARCHAR(191) NULL,
    `height` DOUBLE NULL,
    `currentWeight` DOUBLE NULL,
    `goals` JSON NULL,
    `medicalNotes` TEXT NULL,
    `timezone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClientProfile_userId_key`(`userId`),
    INDEX `ClientProfile_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientTrainerRelation` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `trainerId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endDate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClientTrainerRelation_clientId_idx`(`clientId`),
    INDEX `ClientTrainerRelation_trainerId_idx`(`trainerId`),
    INDEX `ClientTrainerRelation_isActive_idx`(`isActive`),
    UNIQUE INDEX `ClientTrainerRelation_clientId_trainerId_key`(`clientId`, `trainerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Exercise` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `muscleGroups` JSON NULL,
    `equipmentNeeded` JSON NULL,
    `difficulty` VARCHAR(191) NOT NULL,
    `videoUrl` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `instructions` JSON NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Exercise_name_idx`(`name`),
    INDEX `Exercise_difficulty_idx`(`difficulty`),
    INDEX `Exercise_isPublic_idx`(`isPublic`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `trainerId` VARCHAR(191) NOT NULL,
    `duration` INTEGER NULL,
    `difficulty` VARCHAR(191) NOT NULL,
    `tags` JSON NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkoutTemplate_trainerId_idx`(`trainerId`),
    INDEX `WorkoutTemplate_difficulty_idx`(`difficulty`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutTemplateExercise` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `exerciseId` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL,
    `sets` INTEGER NOT NULL,
    `reps` VARCHAR(191) NOT NULL,
    `duration` INTEGER NULL,
    `rest` INTEGER NULL,
    `weight` DOUBLE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkoutTemplateExercise_templateId_orderIndex_idx`(`templateId`, `orderIndex`),
    INDEX `WorkoutTemplateExercise_exerciseId_idx`(`exerciseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workout` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `scheduledDate` DATETIME(3) NOT NULL,
    `completedDate` DATETIME(3) NULL,
    `status` ENUM('SCHEDULED', 'COMPLETED', 'SKIPPED', 'IN_PROGRESS') NOT NULL DEFAULT 'SCHEDULED',
    `duration` INTEGER NULL,
    `notes` TEXT NULL,
    `clientNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Workout_clientId_idx`(`clientId`),
    INDEX `Workout_scheduledDate_idx`(`scheduledDate`),
    INDEX `Workout_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutExercise` (
    `id` VARCHAR(191) NOT NULL,
    `workoutId` VARCHAR(191) NOT NULL,
    `exerciseId` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL,
    `targetSets` INTEGER NOT NULL,
    `targetReps` VARCHAR(191) NOT NULL,
    `targetWeight` DOUBLE NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkoutExercise_workoutId_orderIndex_idx`(`workoutId`, `orderIndex`),
    INDEX `WorkoutExercise_exerciseId_idx`(`exerciseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutSet` (
    `id` VARCHAR(191) NOT NULL,
    `workoutExerciseId` VARCHAR(191) NOT NULL,
    `setNumber` INTEGER NOT NULL,
    `reps` INTEGER NULL,
    `weight` DOUBLE NULL,
    `duration` INTEGER NULL,
    `rpe` INTEGER NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkoutSet_workoutExerciseId_idx`(`workoutExerciseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MealPlanTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `trainerId` VARCHAR(191) NOT NULL,
    `dailyCalories` INTEGER NULL,
    `dailyProtein` DOUBLE NULL,
    `dailyCarbs` DOUBLE NULL,
    `dailyFat` DOUBLE NULL,
    `tags` JSON NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MealPlanTemplate_trainerId_idx`(`trainerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MealTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mealType` VARCHAR(191) NOT NULL,
    `timeOfDay` VARCHAR(191) NULL,
    `orderIndex` INTEGER NOT NULL,
    `instructions` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MealTemplate_templateId_orderIndex_idx`(`templateId`, `orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FoodItem` (
    `id` VARCHAR(191) NOT NULL,
    `mealId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `calories` DOUBLE NULL,
    `protein` DOUBLE NULL,
    `carbs` DOUBLE NULL,
    `fat` DOUBLE NULL,
    `fiber` DOUBLE NULL,
    `notes` VARCHAR(191) NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,

    INDEX `FoodItem_mealId_idx`(`mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MealPlan` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MealPlan_clientId_idx`(`clientId`),
    INDEX `MealPlan_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgressEntry` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `weight` DOUBLE NULL,
    `bodyFat` DOUBLE NULL,
    `notes` TEXT NULL,
    `mood` INTEGER NULL,
    `energy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProgressEntry_clientId_date_idx`(`clientId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgressPhoto` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProgressPhoto_entryId_idx`(`entryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Measurement` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `neck` DOUBLE NULL,
    `chest` DOUBLE NULL,
    `waist` DOUBLE NULL,
    `hips` DOUBLE NULL,
    `thighs` DOUBLE NULL,
    `arms` DOUBLE NULL,
    `calves` DOUBLE NULL,
    `shoulders` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Measurement_clientId_date_idx`(`clientId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `receiverId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_senderId_receiverId_idx`(`senderId`, `receiverId`),
    INDEX `Message_receiverId_read_idx`(`receiverId`, `read`),
    INDEX `Message_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'CANCELLED', 'EXPIRED', 'TRIAL') NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
    `billingCycle` VARCHAR(191) NOT NULL DEFAULT 'monthly',
    `stripeSubscriptionId` VARCHAR(191) NULL,
    `stripeCustomerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_stripeSubscriptionId_key`(`stripeSubscriptionId`),
    INDEX `Subscription_clientId_idx`(`clientId`),
    INDEX `Subscription_status_idx`(`status`),
    INDEX `Subscription_stripeSubscriptionId_idx`(`stripeSubscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isRevoked` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `RefreshToken_token_key`(`token`),
    INDEX `RefreshToken_userId_idx`(`userId`),
    INDEX `RefreshToken_token_idx`(`token`),
    INDEX `RefreshToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TrainerProfile` ADD CONSTRAINT `TrainerProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientProfile` ADD CONSTRAINT `ClientProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientTrainerRelation` ADD CONSTRAINT `ClientTrainerRelation_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientTrainerRelation` ADD CONSTRAINT `ClientTrainerRelation_trainerId_fkey` FOREIGN KEY (`trainerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutTemplate` ADD CONSTRAINT `WorkoutTemplate_trainerId_fkey` FOREIGN KEY (`trainerId`) REFERENCES `TrainerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutTemplateExercise` ADD CONSTRAINT `WorkoutTemplateExercise_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `WorkoutTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutTemplateExercise` ADD CONSTRAINT `WorkoutTemplateExercise_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workout` ADD CONSTRAINT `Workout_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ClientProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workout` ADD CONSTRAINT `Workout_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `WorkoutTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutExercise` ADD CONSTRAINT `WorkoutExercise_workoutId_fkey` FOREIGN KEY (`workoutId`) REFERENCES `Workout`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutExercise` ADD CONSTRAINT `WorkoutExercise_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutSet` ADD CONSTRAINT `WorkoutSet_workoutExerciseId_fkey` FOREIGN KEY (`workoutExerciseId`) REFERENCES `WorkoutExercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealPlanTemplate` ADD CONSTRAINT `MealPlanTemplate_trainerId_fkey` FOREIGN KEY (`trainerId`) REFERENCES `TrainerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealTemplate` ADD CONSTRAINT `MealTemplate_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `MealPlanTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FoodItem` ADD CONSTRAINT `FoodItem_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `MealTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealPlan` ADD CONSTRAINT `MealPlan_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ClientProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealPlan` ADD CONSTRAINT `MealPlan_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `MealPlanTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressEntry` ADD CONSTRAINT `ProgressEntry_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ClientProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressPhoto` ADD CONSTRAINT `ProgressPhoto_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `ProgressEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Measurement` ADD CONSTRAINT `Measurement_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ClientProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_receiverId_fkey` FOREIGN KEY (`receiverId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ClientProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
