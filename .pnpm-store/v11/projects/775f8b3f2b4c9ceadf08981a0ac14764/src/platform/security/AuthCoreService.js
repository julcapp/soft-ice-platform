const { ApiError } = require('../errors/ApiError');
const { createOpaqueToken, sha256 } = require('./hash');
const { verifyTelegramInitData } = require('./telegramMiniAppVerifier');

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

class AuthCoreService {
  constructor({
    authSessionRepository,
    customerRuntime,
    clubAccountRuntime,
    auditRepository,
    idempotencyService,
    telegramVerifier = verifyTelegramInitData,
    tokenFactory = createOpaqueToken,
    clock = () => new Date(),
    accessTokenTtlSeconds = Number(
      process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS || DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    ),
    metrics,
  }) {
    this.authSessionRepository = authSessionRepository;
    this.customerRuntime = customerRuntime;
    this.clubAccountRuntime = clubAccountRuntime;
    this.auditRepository = auditRepository;
    this.idempotencyService = idempotencyService;
    this.telegramVerifier = telegramVerifier;
    this.tokenFactory = tokenFactory;
    this.clock = clock;
    this.accessTokenTtlSeconds = accessTokenTtlSeconds;
    this.metrics = metrics;
  }

  async createTelegramMiniAppSession(request, context) {
    validateTelegramSessionRequest(request);

    const telegramIdentity = this.telegramVerifier(request.telegram_init_data);
    const idempotencyRecord = await this.reserveIdempotency(
      request,
      telegramIdentity,
      context,
    );

    const customerResult = await this.customerRuntime.resolveOrCreateTelegramCustomer(
      telegramIdentity,
      {
        correlationId: context.correlationId,
        sourceChannel: request.source_channel,
      },
    );

    const clubAccountResult = await this.clubAccountRuntime.ensureAccountForCustomer(
      customerResult.customer,
      {
        correlationId: context.correlationId,
        sourceChannel: request.source_channel,
        authMethod: 'telegram_init_data',
      },
    );

    const accessToken = this.tokenFactory();
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + this.accessTokenTtlSeconds * 1000);

    const session = await this.authSessionRepository.createCustomerSession({
      customerId: customerResult.customer.id,
      accessTokenHash: sha256(accessToken),
      authMethod: 'telegram_init_data',
      consumerType: 'telegram_mini_app',
      expiresAt,
      correlationId: context.correlationId,
    });

    await this.auditRepository.record({
      eventType: 'Auth.SessionCreated',
      subjectType: 'user',
      subjectId: customerResult.customer.id,
      targetType: 'AuthSession',
      targetId: session.id,
      action: 'authenticate',
      decision: 'success',
      reasonCode: 'telegram_mini_app_session_created',
      authMethod: 'telegram_init_data',
      sourceChannel: request.source_channel,
      correlationId: context.correlationId,
      metadata: {
        consumer_type: 'telegram_mini_app',
      },
    });

    if (this.idempotencyService) {
      await this.idempotencyService.complete(idempotencyRecord, session.id);
    }

    if (this.metrics) this.metrics.increment('soft_ice_telegram_sessions_total', 1, { status: 'created' });

    return {
      session,
      accessToken,
      expiresAt,
      customer: customerResult.customer,
      clubAccount: clubAccountResult.clubAccount,
    };
  }

  async authenticateAccessToken(accessToken, context) {
    if (!accessToken) {
      throw new ApiError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
        source: 'api',
      });
    }

    const session = await this.authSessionRepository.findValidByAccessTokenHash(
      sha256(accessToken),
      this.clock(),
    );

    if (!session) {
      throw new ApiError({
        statusCode: 401,
        code: 'AUTHENTICATION_INVALID',
        message: 'Authentication token is invalid or expired.',
        source: 'platform_service',
      });
    }

    await this.authSessionRepository.touch(session.id);

    return {
      subject_type: session.subjectType,
      subject_id: session.customerId,
      session_id: session.id,
      auth_method: session.authMethod,
      consumer_type: session.consumerType,
      authenticated_at: session.createdAt,
      expires_at: session.expiresAt,
      correlation_id: context.correlationId,
    };
  }

  async reserveIdempotency(request, telegramIdentity, context) {
    if (!this.idempotencyService) {
      return null;
    }

    return this.idempotencyService.reserveOrValidate({
      scope: 'telegram_mini_app_session',
      key: context.idempotencyKey,
      semanticPayload: {
        source_channel: request.source_channel,
        client_request_id: request.client_request_id || null,
        telegram_subject_hash: telegramIdentity.subjectHash,
        telegram_auth_date: telegramIdentity.authDate,
      },
      actorContext: {
        subject_type: 'user_alias',
        external_subject_hash: telegramIdentity.subjectHash,
      },
      correlationId: context.correlationId,
    });
  }
}

function validateTelegramSessionRequest(request) {
  const details = [];

  if (!request || typeof request !== 'object') {
    details.push({ field: 'body', issue: 'must be a JSON object' });
  } else {
    if (!request.telegram_init_data || typeof request.telegram_init_data !== 'string') {
      details.push({
        field: 'telegram_init_data',
        issue: 'must be a non-empty string',
      });
    }

    if (request.source_channel !== 'telegram_mini_app') {
      details.push({
        field: 'source_channel',
        issue: 'must be telegram_mini_app',
      });
    }
  }

  if (details.length > 0) {
    throw new ApiError({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      details,
    });
  }
}

module.exports = {
  AuthCoreService,
  DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
};
