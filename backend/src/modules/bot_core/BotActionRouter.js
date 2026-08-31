const { parseGiftAction } = require('./BotGiftActionService');

class BotActionRouter {
  constructor({ customerExperienceService, giftActionService = null, onboardingPolicy = null } = {}) {
    this.customerExperienceService = customerExperienceService;
    this.giftActionService = giftActionService;
    this.onboardingPolicy = onboardingPolicy;
  }

  async route({ action, customerId, channel, context = {} }) {
    const giftAction = parseGiftAction(action);
    if (giftAction) {
      if (!this.giftActionService) return featureUnavailableView();
      return this.giftActionService.acceptGift({
        customerId,
        giftId: giftAction.giftId,
        channel,
        context,
      });
    }

    switch (action) {
      case 'club':
        return this.customerExperienceService.buildClubView({ customerId, channel, context });
      case 'referral':
        return this.customerExperienceService.buildReferralView({ customerId, channel, context });
      case 'gifts':
        if (!this.giftActionService) return featureUnavailableView();
        return this.giftActionService.listGifts({ customerId, channel, context });
      case 'back':
      case 'menu':
        return this.customerExperienceService.buildMainMenuView({ customerId, channel, context });
      case 'open_mini_app':
        return this.customerExperienceService.buildMiniAppView({ customerId, channel, context });
      default:
        return {
          title: 'У Тимоши',
          text: 'Не удалось распознать действие. Откройте главное меню.',
          actions: [{ type: 'action', label: '← Главное меню', action: 'menu' }],
        };
    }
  }
}

function featureUnavailableView() {
  return {
    title: 'Подарки временно недоступны',
    text: 'Откройте Mini App или повторите попытку позже.',
    actions: [{ type: 'action', label: '← Главное меню', action: 'menu' }],
  };
}

module.exports = { BotActionRouter };
