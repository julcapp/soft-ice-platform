function buildReferralSection({ referralCode, inviteUrl = null, stats = {} } = {}) {
  return {
    title: 'Пригласить друга',
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
      inviteUrl ? { type: 'share', channel: 'telegram', label: 'Отправить в Telegram', url: inviteUrl } : null,
      inviteUrl ? { type: 'share', channel: 'max', label: 'Поделиться в MAX', url: inviteUrl } : null,
      inviteUrl ? { type: 'copy', label: 'Скопировать ссылку', value: inviteUrl } : null,
      inviteUrl ? { type: 'qr', label: 'Показать QR-код', value: inviteUrl } : null,
    ].filter(Boolean),
  };
}

module.exports = { buildReferralSection };
