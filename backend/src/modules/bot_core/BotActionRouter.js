class BotActionRouter {
  constructor({ customerExperienceService, onboardingPolicy = null } = {}) {
    this.customerExperienceService = customerExperienceService;
    this.onboardingPolicy = onboardingPolicy;
  }

  async route({ action, customerId, channel, context = {} }) {
    switch (action) {
      case 'club':
        return this.customerExperienceService.buildClubView({ customerId, channel, context });
      case 'referral':
        return this.customerExperienceService.buildReferralView({ customerId, channel, context });
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

module.exports = { BotActionRouter };
