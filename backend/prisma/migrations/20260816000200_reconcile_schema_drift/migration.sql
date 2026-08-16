-- Reconcile historical migration output with schema.prisma without dropping data.

ALTER TABLE "CustomerChannelSubscription" DROP CONSTRAINT "CustomerChannelSubscription_customerId_fkey";
ALTER TABLE "CustomerExternalProfile" DROP CONSTRAINT "CustomerExternalProfile_customerId_fkey";
ALTER TABLE "GiftInvitation" DROP CONSTRAINT "GiftInvitation_giftTransferId_fkey";
ALTER TABLE "GiftRecipientClaim" DROP CONSTRAINT "GiftRecipientClaim_giftTransferId_fkey";
ALTER TABLE "GiftRedemption" DROP CONSTRAINT "GiftRedemption_giftTransferId_fkey";
ALTER TABLE "GiftReferralLink" DROP CONSTRAINT "GiftReferralLink_giftTransferId_fkey";
ALTER TABLE "MachineConnectivityEvent" DROP CONSTRAINT "MachineConnectivityEvent_machineId_fkey";
ALTER TABLE "MachineConnectivitySnapshot" DROP CONSTRAINT "MachineConnectivitySnapshot_machineId_fkey";
ALTER TABLE "MachineMobilePlan" DROP CONSTRAINT "MachineMobilePlan_machineId_fkey";
ALTER TABLE "MachineSimCard" DROP CONSTRAINT "MachineSimCard_machineId_fkey";

ALTER TABLE "DispenseRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE INDEX "EventAcknowledgement_eventRecordId_acknowledgedAt_idx" ON "EventAcknowledgement"("eventRecordId", "acknowledgedAt");
CREATE INDEX "EventComment_eventRecordId_createdAt_idx" ON "EventComment"("eventRecordId", "createdAt");
CREATE INDEX "EventDeletionAudit_eventId_deletedAt_idx" ON "EventDeletionAudit"("eventId", "deletedAt");
CREATE INDEX "EventEvidenceReference_eventRecordId_createdAt_idx" ON "EventEvidenceReference"("eventRecordId", "createdAt");
CREATE INDEX "EventRelation_eventRecordId_relationType_idx" ON "EventRelation"("eventRecordId", "relationType");
CREATE INDEX "EventRelation_targetType_targetId_idx" ON "EventRelation"("targetType", "targetId");
CREATE INDEX "VideoAccessAuditV1_actorId_occurredAt_idx" ON "VideoAccessAuditV1"("actorId", "occurredAt");
CREATE INDEX "VideoFragmentV1_machineId_createdAt_idx" ON "VideoFragmentV1"("machineId", "createdAt");

ALTER TABLE "OrganizationMachineAssignment" RENAME CONSTRAINT "OrganizationMachineAssignment_responsibleMemberId_organizationI" TO "OrganizationMachineAssignment_responsibleMemberId_organiza_fkey";
ALTER TABLE "OrganizationMachineAssignment" RENAME CONSTRAINT "OrganizationMachineAssignment_serviceSpecialistId_organizationI" TO "OrganizationMachineAssignment_serviceSpecialistId_organiza_fkey";

ALTER TABLE "CustomerExternalProfile" ADD CONSTRAINT "CustomerExternalProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerChannelSubscription" ADD CONSTRAINT "CustomerChannelSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineSimCard" ADD CONSTRAINT "MachineSimCard_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineMobilePlan" ADD CONSTRAINT "MachineMobilePlan_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineConnectivitySnapshot" ADD CONSTRAINT "MachineConnectivitySnapshot_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineConnectivityEvent" ADD CONSTRAINT "MachineConnectivityEvent_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GiftInvitation" ADD CONSTRAINT "GiftInvitation_giftTransferId_fkey" FOREIGN KEY ("giftTransferId") REFERENCES "GiftTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GiftRecipientClaim" ADD CONSTRAINT "GiftRecipientClaim_giftTransferId_fkey" FOREIGN KEY ("giftTransferId") REFERENCES "GiftTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GiftRedemption" ADD CONSTRAINT "GiftRedemption_giftTransferId_fkey" FOREIGN KEY ("giftTransferId") REFERENCES "GiftTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GiftReferralLink" ADD CONSTRAINT "GiftReferralLink_giftTransferId_fkey" FOREIGN KEY ("giftTransferId") REFERENCES "GiftTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER INDEX "CustomerTimelineEvent_customerId_sourceDomain_sourceEntityType_" RENAME TO "CustomerTimelineEvent_customerId_sourceDomain_sourceEntityT_key";
ALTER INDEX "EventRecord_category_severity_occurred_idx" RENAME TO "EventRecord_category_severity_occurredAt_idx";
ALTER INDEX "EventRecord_code_occurred_idx" RENAME TO "EventRecord_eventCode_occurredAt_idx";
ALTER INDEX "EventRecord_correlation_idx" RENAME TO "EventRecord_correlationId_idx";
ALTER INDEX "EventRecord_customer_occurred_idx" RENAME TO "EventRecord_customerId_occurredAt_idx";
ALTER INDEX "EventRecord_hold_idx" RENAME TO "EventRecord_legalHold_idx";
ALTER INDEX "EventRecord_machine_occurred_idx" RENAME TO "EventRecord_machineId_occurredAt_idx";
ALTER INDEX "EventRecord_org_occurred_idx" RENAME TO "EventRecord_organizationId_occurredAt_idx";
ALTER INDEX "EventRecord_retention_idx" RENAME TO "EventRecord_retentionUntil_idx";
ALTER INDEX "EventRecord_source_unique" RENAME TO "EventRecord_sourceDomain_sourceEventId_eventCode_eventVersi_key";
ALTER INDEX "EventRecord_subject_occurred_idx" RENAME TO "EventRecord_subjectType_subjectId_occurredAt_idx";
ALTER INDEX "EventRecord_tenant_occurred_idx" RENAME TO "EventRecord_tenantId_occurredAt_idx";
ALTER INDEX "EventTag_event_value_key" RENAME TO "EventTag_eventRecordId_value_key";
ALTER INDEX "EventTypeDefinition_code_version_key" RENAME TO "EventTypeDefinition_eventCode_version_key";
ALTER INDEX "OrganizationRoleAssignment_organizationId_memberId_role_revoked" RENAME TO "OrganizationRoleAssignment_organizationId_memberId_role_rev_key";
