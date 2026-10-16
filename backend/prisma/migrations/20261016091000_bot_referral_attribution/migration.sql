CREATE TABLE "BotReferralInvite" (
 "code" TEXT PRIMARY KEY,
 "customerId" TEXT UNIQUE NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "BotReferralIntent" (
 "scope" TEXT NOT NULL,
 "subjectHash" TEXT NOT NULL,
 "code" TEXT NOT NULL REFERENCES "BotReferralInvite"("code") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "appliedAt" TIMESTAMP(3),
 PRIMARY KEY ("scope", "subjectHash")
);
