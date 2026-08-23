const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPatch } = require('../src/modules/photo_verification/PhotoAiRecommendationApplicationService');

const approvedThresholdRecommendation = {
  id: 'review_auto_approve_threshold',
  evidence: { suggestedApprovalThreshold: 0.93 },
};

test('buildPatch only creates allowlisted deterministic changes', () => {
  assert.deepEqual(buildPatch(approvedThresholdRecommendation, { approvalThreshold: 0.9 }), { approvalThreshold: 0.93 });
  assert.deepEqual(buildPatch({ id: 'high_disagreement_review_mode' }, { mode: 'ai_assisted' }), { mode: 'manual_only' });
  assert.deepEqual(buildPatch({ id: 'review_visual_freshness' }, { challengeCodeEnabled: false }), {});
  assert.deepEqual(buildPatch({ id: 'review_auto_reject_policy' }, { rejectionThreshold: 0.65 }), {});
});

test('buildPatch does not lower an existing approval threshold', () => {
  assert.deepEqual(buildPatch(approvedThresholdRecommendation, { approvalThreshold: 0.95 }), {});
});

test('buildPatch does not create redundant manual_only change', () => {
  assert.deepEqual(buildPatch({ id: 'high_disagreement_review_mode' }, { mode: 'manual_only' }), {});
});
