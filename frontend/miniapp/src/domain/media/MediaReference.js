const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

export const createMediaReference = (mediaId) => ({
  id: isNonEmptyString(mediaId) ? mediaId : '',
});

export const isValidMediaReference = (mediaReference) =>
  mediaReference !== null &&
  typeof mediaReference === 'object' &&
  !Array.isArray(mediaReference) &&
  isNonEmptyString(mediaReference.id);
