const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');
const { CONSENT_SOURCE_CHANNELS, CONSENT_TYPES, ConsentEntity } = require('./ConsentEntity');

class ConsentService {
  constructor({ consentRepository, customerRepository, auditRepository, clock = () => new Date(), idFactory = randomUUID }) {
    this.consentRepository = consentRepository;
    this.customerRepository = customerRepository;
    this.auditRepository = auditRepository;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  async record(customerId, request, context = {}) {
    validateRequest(request);
    if (!await this.customerRepository.findById(customerId)) {
      throw new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message: 'Customer was not found.', source: 'runtime' });
    }
    const command = {
      consentType: request.consent_type,
      isGranted: request.is_granted,
      sourceChannel: request.source_channel,
      documentType: request.document_type || 'consent_notice',
      documentVersion: request.document_version || '1.0',
      documentTitle: request.document_title || request.document_type || 'Consent Notice',
      decisionId: request.decision_id || this.idFactory(),
      correlationId: context.correlationId,
      consentedAt: this.clock(),
    };
    const result = await this.consentRepository.append(customerId, command);
    if (!result.created && !sameDecision(result.consent, command)) {
      throw new ApiError({ statusCode: 409, code: 'CONSENT_DECISION_CONFLICT', message: 'Decision ID was already used for different consent data.', source: 'runtime' });
    }
    const consent = new ConsentEntity(result.consent);
    await this.auditRepository.record({
      eventType: 'Customers.ConsentRecorded', subjectType: 'user', subjectId: customerId,
      targetType: 'CustomerConsent', targetId: consent.id, action: 'record_consent', decision: 'success',
      reasonCode: consent.isGranted ? 'consent_granted' : 'consent_denied_or_revoked',
      authMethod: context.authMethod, sourceChannel: consent.sourceChannel,
      correlationId: context.correlationId,
      metadata: { consent_type: consent.consentType, document_version: command.documentVersion },
    });
    return { ...result, consent };
  }

  async history(customerId) {
    if (!await this.customerRepository.findById(customerId)) {
      throw new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message: 'Customer was not found.', source: 'runtime' });
    }
    return (await this.consentRepository.findHistory(customerId)).map((record) => new ConsentEntity(record));
  }
}

function sameDecision(consent, command) {
  return consent.consentType === command.consentType &&
    consent.isGranted === command.isGranted &&
    consent.sourceChannel === command.sourceChannel &&
    consent.document.documentType === command.documentType &&
    consent.document.version === command.documentVersion;
}

function validateRequest(request) {
  const valid = request && CONSENT_TYPES.includes(request.consent_type) &&
    typeof request.is_granted === 'boolean' && CONSENT_SOURCE_CHANNELS.includes(request.source_channel) &&
    (request.decision_id === undefined || (typeof request.decision_id === 'string' && request.decision_id.trim())) &&
    (request.document_version === undefined || (typeof request.document_version === 'string' && request.document_version.trim()));
  if (!valid) {
    throw new ApiError({
      statusCode: 400, code: 'VALIDATION_FAILED', message: 'Consent decision is invalid.',
      details: [
        { field: 'consent_type', issue: `must be one of: ${CONSENT_TYPES.join(', ')}` },
        { field: 'source_channel', issue: `must be one of: ${CONSENT_SOURCE_CHANNELS.join(', ')}` },
      ],
    });
  }
}

module.exports = { ConsentService, validateRequest };
