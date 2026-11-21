const USER_PHOTO_STATUSES = Object.freeze({
  MODERATION: 'moderation',
  DUPLICATE: 'duplicate',
  ADDITIONAL_REVIEW: 'additional_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PUBLICATION_PENDING: 'publication_pending',
  PUBLISHED: 'published',
  REWARDED: 'rewarded',
});

const USER_PHOTO_MESSAGES = Object.freeze({
  moderation: 'Фото получено и отправлено на проверку.',
  duplicate: 'Это фото уже было загружено ранее. Повторная заявка не создана.',
  additional_review: 'Похоже, такое фото уже участвовало ранее. Мы дополнительно проверим его.',
  approved: 'Проверка завершена. Фото одобрено и готовится к публикации.',
  rejected: 'Фото не прошло проверку.',
  publication_pending: 'Фото одобрено и готовится к публикации.',
  published: 'Ваше фото опубликовано.',
  rewarded: 'Публикация подтверждена, бонусы начислены.',
});

function publicStatus(status, extra = {}) {
  return {
    status,
    message: USER_PHOTO_MESSAGES[status] || 'Статус фотографии обновлён.',
    ...extra,
  };
}

module.exports = {
  USER_PHOTO_STATUSES,
  USER_PHOTO_MESSAGES,
  publicStatus,
};
