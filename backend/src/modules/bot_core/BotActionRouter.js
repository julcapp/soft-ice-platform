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
      case 'referral_link': {
        const referral = await this.customerExperienceService.buildReferralView({ customerId, channel, context });
        return {title:'Ваша ссылка приглашения',text:referral.inviteUrl || 'Ссылка пока не настроена.',actions:[{type:'action',label:'← Назад',action:'referral'}]};
      }
      case 'gifts':
        if (!this.giftActionService) return featureUnavailableView();
        return this.giftActionService.listGifts({ customerId, channel, context });
      case 'main_menu':
      case 'back':
      case 'menu':
        return this.customerExperienceService.buildMainMenuView({ customerId, channel, context });
      case 'order':
      case 'open_mini_app':
        return this.customerExperienceService.buildMiniAppView({ customerId, channel, context });
      case 'help': {
        const app = await this.customerExperienceService.buildMiniAppView({ customerId, channel, context });
        return { title: 'Помощь', text: 'Заказы, оплату и код получения смотрите в приложении. Если заказ уже оплачен, повторно платить не нужно: откройте кабинет и проверьте его статус. Подарки и приглашения доступны отдельными кнопками бота.',
          actions: [...(app.actions || []), { type: 'action', label: '← Главное меню', action: 'menu' }] };
      }
      case 'locations':
        return { title: 'Где купить', text: 'Список адресов аппаратов в боте пока не подключён. Не оформляйте заказ, если не уверены, где находится выбранный аппарат.',
          actions: [{ type: 'action', label: '← Главное меню', action: 'menu' }] };
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
