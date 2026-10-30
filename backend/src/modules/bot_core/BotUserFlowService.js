const { buildClubSummary } = require('./BotClubView');
const { buildReferralSection } = require('../referral');

class BotUserFlowService {
  constructor({ customerRepository, clubAccountRepository, bonusRepository = null, welcomeBonusRepository = null, referralRepository = null, referralService = null, miniAppUrl = null, inviteLinkBuilder = null } = {}) {
    this.customerRepository = customerRepository;
    this.clubAccountRepository = clubAccountRepository;
    this.bonusRepository = bonusRepository;
    this.welcomeBonusRepository = welcomeBonusRepository;
    this.referralRepository = referralRepository;
    this.referralService = referralService;
    this.miniAppUrl = miniAppUrl;
    this.inviteLinkBuilder = inviteLinkBuilder || ((payload) => payload);
  }

  async getClub(customerId) {
    const [customer, clubAccount, bonusAccount, welcomeBonus, referralStats] = await Promise.all([
      this.customerRepository?.findById ? this.customerRepository.findById(customerId) : null,
      this.clubAccountRepository?.findByCustomerId ? this.clubAccountRepository.findByCustomerId(customerId) : null,
      this.bonusRepository?.findByCustomerId ? this.bonusRepository.findByCustomerId(customerId) : null,
      this.welcomeBonusRepository?.findActiveByCustomerId ? this.welcomeBonusRepository.findActiveByCustomerId(customerId) : null,
      this.referralRepository?.getStatsForReferrer ? this.referralRepository.getStatsForReferrer(customerId) : null,
    ]);

    return buildClubSummary({
      customerName: customer?.name || null,
      moneyBalanceRub: clubAccount?.availableBalanceRub ?? clubAccount?.balanceRub ?? 0,
      bonusBalance: bonusAccount?.balanceBonus ?? 0,
      welcomeBonus,
      referralSummary: referralStats,
      miniAppUrl: this.miniAppUrl,
    });
  }

  async getReferral(customerId, channel = 'telegram') {
    if (!this.referralService) throw new Error('referralService is required.');
    let profile;
    try { profile = await this.referralService.getInviteProfile(customerId); }
    catch (error) {
      if (error.code !== 'REFERRAL_PROFILE_REQUIRED') throw error;
      return {title:'Пригласить друга',text:error.message,inviteUrl:null,actions:[{type:'action',label:'← Главное меню',action:'menu'}]};
    }
    const stats = this.referralRepository?.getStatsForReferrer
      ? await this.referralRepository.getStatsForReferrer(customerId)
      : {};
    const inviteUrl = this.inviteLinkBuilder(profile.startPayload, channel);
    return buildReferralSection({ referralCode: profile.referralCode, inviteUrl, inviteUrls: { telegram: this.inviteLinkBuilder(profile.startPayload, 'telegram'), max: this.inviteLinkBuilder(profile.startPayload, 'max') }, stats });
  }
}

module.exports = { BotUserFlowService };
