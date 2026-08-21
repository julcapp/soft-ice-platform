const { parseStartPayload } = require('./DeepLinkParser');

class BotRuntime {
  constructor({ adapters = {}, renderers = {}, actionRouter, onboardingService = null, customerResolver, sender } = {}) {
    this.adapters = adapters;
    this.renderers = renderers;
    this.actionRouter = actionRouter;
    this.onboardingService = onboardingService;
    this.customerResolver = customerResolver;
    this.sender = sender;
  }

  async handle(channel, rawUpdate) {
    const adapter = this.adapters[channel];
    const renderer = this.renderers[channel];
    if (!adapter || !renderer) throw new Error(`Unsupported bot channel: ${channel}`);

    const inbound = adapter.normalizeInbound(rawUpdate);
    const callback = extractCallback(channel, rawUpdate);
    const identity = await this.customerResolver.resolve({ channel, inbound, rawUpdate });

    let view;
    if (callback?.kind === 'action') {
      view = await this.actionRouter.route({
        action: callback.value,
        customerId: identity.customerId,
        channel,
        context: { inbound, rawUpdate },
      });
    } else if (callback?.kind === 'copy') {
      view = {
        title: 'Ссылка для приглашения',
        text: callback.value,
        actions: [{ type: 'action', label: '← Назад', action: 'referral' }],
      };
    } else if (isStartUpdate(channel, rawUpdate) && this.onboardingService) {
      const context = parseStartPayload(inbound.payload);
      view = await this.onboardingService.start({
        channel,
        externalUserId: inbound.externalUserId,
        profile: inbound.profile,
        payload: inbound.payload,
        context,
        metadata: inbound.metadata,
      });
    } else {
      view = await this.actionRouter.route({
        action: 'menu',
        customerId: identity.customerId,
        channel,
        context: { inbound, rawUpdate },
      });
    }

    const rendered = renderer.renderView(view);
    const destination = resolveDestination(channel, inbound, rawUpdate);
    const result = await this.sender.send({ channel, destination, rendered, rawUpdate });
    return { inbound, identity, callback, view, rendered, destination, result };
  }
}

function extractCallback(channel, update = {}) {
  const raw = channel === 'telegram'
    ? update.callback_query?.data
    : update.callback?.payload || update.message?.body?.attachments?.find?.((a) => a.type === 'callback')?.payload?.payload || update.payload;
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('action:')) return { kind: 'action', value: raw.slice(7) };
  if (raw.startsWith('copy:')) return { kind: 'copy', value: raw.slice(5) };
  return null;
}

function isStartUpdate(channel, update = {}) {
  if (channel === 'telegram') return /^\/start(?:\s|$)/.test(update.message?.text || '');
  const text = update.message?.body?.text || update.message?.text || update.text || '';
  return /^\/start(?:\s|$)/.test(String(text)) || Boolean(update.start_payload);
}

function resolveDestination(channel, inbound, update = {}) {
  if (channel === 'telegram') {
    return { chatId: inbound.metadata?.chatId, callbackQueryId: update.callback_query?.id || null };
  }
  return { chatId: inbound.metadata?.chatId || update.chat_id || null, userId: inbound.externalUserId };
}

module.exports = { BotRuntime, extractCallback, isStartUpdate, resolveDestination };
