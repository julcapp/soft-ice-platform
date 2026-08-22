const ADMIN_ROLES = new Set(['ADMIN', 'PLATFORM_OWNER', 'PROJECT_ADMIN']);

class PhotoVerificationReadinessService {
  constructor({ repository, prisma, env = process.env, clock = () => new Date() }) {
    this.repository = repository;
    this.prisma = prisma;
    this.env = env;
    this.clock = clock;
  }

  async getStatus(securityContext = {}, { scopeKey = 'default' } = {}) {
    requireAdmin(securityContext);
    const settings = await this.repository.getSettings(scopeKey);
    const checks = [];

    let databaseReady = true;
    try { await this.prisma?.$queryRaw`SELECT 1`; } catch (_) { databaseReady = false; }
    checks.push(check('database', 'База данных', databaseReady, true, databaseReady ? 'PostgreSQL доступен.' : 'PostgreSQL недоступен.'));

    const captureSecret = Boolean(this.env.PHOTO_CAPTURE_CHALLENGE_SECRET);
    checks.push(check('capture_secret', 'Секрет кода Тимоши', captureSecret, Boolean(settings?.enabled), captureSecret ? 'Секрет настроен.' : 'PHOTO_CAPTURE_CHALLENGE_SECRET не задан.'));

    const aiRequired = Boolean(settings?.enabled) && settings?.mode === 'ai_assisted';
    const aiReady = Boolean(this.env.OPENAI_API_KEY && this.env.PHOTO_VISION_MODEL);
    checks.push(check('ai_provider', 'AI-проверка', aiReady, aiRequired, aiReady ? 'Provider и модель настроены.' : 'Нужны OPENAI_API_KEY и PHOTO_VISION_MODEL.'));

    const publicationRequired = Boolean(settings?.enabled && settings?.publishingEnabled);
    const requiredChannels = normalizeChannels(settings?.requiredChannels);
    const channelConfig = {
      VK: Boolean(this.env.VK_ACCESS_TOKEN),
      TELEGRAM: Boolean(this.env.TELEGRAM_BOT_TOKEN),
      MAX: Boolean(this.env.MAX_BOT_TOKEN && this.env.MAX_CHANNEL_CHAT_ID),
    };
    for (const channel of ['VK', 'TELEGRAM', 'MAX']) {
      const required = publicationRequired && requiredChannels.includes(channel);
      const ready = channelConfig[channel];
      checks.push(check(`publisher_${channel.toLowerCase()}`, `Публикация ${channel}`, ready, required, ready ? 'Канал сконфигурирован.' : channel === 'MAX' ? 'Нужны MAX_BOT_TOKEN и MAX_CHANNEL_CHAT_ID.' : `Не настроен ${channel === 'VK' ? 'VK_ACCESS_TOKEN' : 'TELEGRAM_BOT_TOKEN'}.`));
    }

    const rewardConfigured = Number.isInteger(Number(settings?.rewardBonusUnits)) && Number(settings.rewardBonusUnits) > 0;
    checks.push(check('reward_policy', 'Награда за фото', rewardConfigured, false, rewardConfigured ? 'Количество bonus units настроено.' : 'Награда не настроена; это не блокирует модерацию, но блокирует полный reward-flow.'));

    const blocking = checks.filter((item) => item.required && !item.ready);
    const degradedReasons = [];
    if (!settings?.enabled) degradedReasons.push('Модуль выключен администратором.');
    if (settings?.enabled && !settings?.publishingEnabled) degradedReasons.push('Публикация отключена.');
    if (settings?.enabled && settings?.publishingEnabled && !rewardConfigured) degradedReasons.push('Reward-flow не завершится до настройки bonus units.');

    const status = blocking.length ? 'BLOCKED' : degradedReasons.length ? 'DEGRADED' : 'READY';
    return {
      status,
      generatedAt: this.clock().toISOString(),
      scopeKey,
      mode: settings?.mode || 'manual_only',
      enabled: Boolean(settings?.enabled),
      publishingEnabled: Boolean(settings?.publishingEnabled),
      requiredChannels,
      reasons: blocking.map((item) => item.message).concat(degradedReasons),
      checks,
    };
  }
}

function normalizeChannels(value) {
  const source = Array.isArray(value) ? value : ['VK', 'TELEGRAM', 'MAX'];
  return [...new Set(source.map((x) => String(x).toUpperCase()).filter((x) => ['VK', 'TELEGRAM', 'MAX'].includes(x)))];
}
function check(code, label, ready, required, message) { return { code, label, ready: Boolean(ready), required: Boolean(required), status: ready ? 'READY' : required ? 'BLOCKED' : 'DEGRADED', message }; }
function requireAdmin(context) { if (!ADMIN_ROLES.has(String(context.role || context.admin_role || '').toUpperCase())) { const error = new Error('Photo Verification readiness requires administrator role.'); error.statusCode = 403; error.code = 'PHOTO_READINESS_FORBIDDEN'; throw error; } }
module.exports = { PhotoVerificationReadinessService, normalizeChannels };
