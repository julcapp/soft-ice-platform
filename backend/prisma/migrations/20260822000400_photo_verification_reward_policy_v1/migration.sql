-- Configurable photo reward policy v1
-- Null means reward amount is intentionally not configured and Reward Engine must fail closed.

ALTER TABLE "PhotoVerificationSettings"
ADD COLUMN "rewardBonusUnits" INTEGER;

ALTER TABLE "PhotoVerificationSettings"
ADD CONSTRAINT "PhotoVerificationSettings_rewardBonusUnits_check"
CHECK ("rewardBonusUnits" IS NULL OR "rewardBonusUnits" > 0);
