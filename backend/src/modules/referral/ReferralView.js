function buildReferralSection({ referralCode, inviteUrl = null, inviteUrls = null, stats = {} } = {}) {
  return {
    title: 'Пригласить друга',
    text: inviteUrl ? 'Отправьте приглашение другу. Пригласивший закрепляется после подтверждения профиля друга; бонусы зависят от действующих правил.' : 'Ссылки приглашения для этого канала пока не настроены.',
    referralCode,
    inviteUrl,
    stats: {
      invited: stats.invited || 0,
      registered: stats.registered || 0,
      firstPurchase: stats.firstPurchase || 0,
      qualifiedTopup: stats.qualifiedTopup || 0,
      awaitingQualification: stats.awaitingQualification || 0,
      rewarded: stats.rewarded || 0,
    },
    actions: [
      (inviteUrls?.telegram || (!inviteUrls && inviteUrl)) ? { type: 'open_url', label: 'Отправить в Telegram', url: 'https://t.me/share/url?'+new URLSearchParams({url:inviteUrls?.telegram || inviteUrl,text:'Приглашаю в Клуб «У Тимоши» 🍦'}) } : null,
      (inviteUrls?.max || (!inviteUrls && inviteUrl)) ? { type: 'open_url', label: 'Поделиться в MAX', url: 'https://max.ru/:share?'+new URLSearchParams({text:'Приглашаю в Клуб «У Тимоши» 🍦 '+(inviteUrls?.max || inviteUrl)}) } : null,
      inviteUrl ? { type: 'referral_copy', label: 'Скопировать ссылку', value: inviteUrl } : null,
      {type:'action',label:'← Главное меню',action:'menu'},
    ].filter(Boolean),
  };
}

module.exports = { buildReferralSection };
