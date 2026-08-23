'use strict';

const { PromotionValidationService } = require('./PromotionValidationService');

function serviceError(code, message, statusCode, details = []) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  error.source = 'promotion_engine';
  return error;
}

class PromotionService {
  constructor({ repository, validationService } = {}) {
    if (!repository) throw new Error('Promotion repository is required.');
    this.repository = repository;
    this.validationService = validationService || new PromotionValidationService();
  }

  async createDraft(input) {
    this._assertDraftInput(input);
    try {
      return await this.repository.createDraft(input);
    } catch (error) {
      if (error?.code === 'P2002') {
        throw serviceError('PROMOTION_CODE_CONFLICT', 'Promotion campaign code already exists.', 409);
      }
      throw error;
    }
  }

  async getCampaign(campaignId) {
    const campaign = await this.repository.getCampaignById(campaignId);
    if (!campaign) throw serviceError('PROMOTION_NOT_FOUND', 'Promotion campaign not found.', 404);
    return campaign;
  }

  async validateDraft({ campaignId, actorId = 'system' }) {
    const campaign = await this.getCampaign(campaignId);

    if (!['DRAFT', 'VALIDATION_FAILED', 'READY'].includes(campaign.status)) {
      throw serviceError(
        'PROMOTION_STATUS_NOT_VALIDATABLE',
        `Campaign in status ${campaign.status} cannot be validated.`,
        409,
        [{ path: 'status', value: campaign.status }],
      );
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
    if (!input || typeof input !== 'object') throw serviceError('PROMOTION_DRAFT_REQUIRED', 'Draft input is required.', 400);
    if (!input.code || !String(input.code).trim()) throw serviceError('PROMOTION_CODE_REQUIRED', 'Promotion code is required.', 400);
    if (!input.name || !String(input.name).trim()) throw serviceError('PROMOTION_NAME_REQUIRED', 'Promotion name is required.', 400);
    if (!input.createdBy || !String(input.createdBy).trim()) throw serviceError('PROMOTION_ACTOR_REQUIRED', 'createdBy is required.', 400);
    if (!input.version || typeof input.version !== 'object') throw serviceError('PROMOTION_VERSION_REQUIRED', 'Initial promotion version is required.', 400);
  }
}

module.exports = { PromotionService, serviceError };
