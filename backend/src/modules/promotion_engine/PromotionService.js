'use strict';

const { PromotionValidationService } = require('./PromotionValidationService');

class PromotionService {
  constructor({ repository, validationService } = {}) {
    if (!repository) throw new Error('Promotion repository is required.');
    this.repository = repository;
    this.validationService = validationService || new PromotionValidationService();
  }

  async createDraft(input) {
    this._assertDraftInput(input);
    return this.repository.createDraft(input);
  }

  async validateDraft({ campaignId, actorId = 'system' }) {
    const campaign = await this.repository.getCampaignById(campaignId);
    if (!campaign) {
      const error = new Error('Promotion campaign not found.');
      error.code = 'PROMOTION_NOT_FOUND';
      throw error;
    }

    if (!['DRAFT', 'VALIDATION_FAILED', 'READY'].includes(campaign.status)) {
      const error = new Error(`Campaign in status ${campaign.status} cannot be validated.`);
      error.code = 'PROMOTION_STATUS_NOT_VALIDATABLE';
      throw error;
    }

    const validationPayload = {
      ...campaign,
      version: campaign.currentVersion,
    };

    const result = this.validationService.validateCampaign(validationPayload);

    await this.repository.updateCampaignStatus({
      campaignId,
      status: result.nextStatus,
      actorId,
      validationResult: result,
    });

    return {
      campaignId,
      status: result.nextStatus,
      validation: result,
    };
  }

  _assertDraftInput(input) {
    if (!input || typeof input !== 'object') throw new Error('Draft input is required.');
    if (!input.code || !String(input.code).trim()) throw new Error('Promotion code is required.');
    if (!input.name || !String(input.name).trim()) throw new Error('Promotion name is required.');
    if (!input.createdBy || !String(input.createdBy).trim()) throw new Error('createdBy is required.');
    if (!input.version || typeof input.version !== 'object') throw new Error('Initial promotion version is required.');
  }
}

module.exports = { PromotionService };
