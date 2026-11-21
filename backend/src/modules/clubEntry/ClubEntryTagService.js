'use strict';

/**
 * Pure business layer for point-specific club entrance tags.
 * It does not write to a database, send messages or create authentication sessions.
 * The caller supplies a transactional repository adapter.
 */
const { randomBytes } = require('node:crypto');

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const TOKEN_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{20}$/;
const ENTRY_KIND = 'CLUB_ENTRY';

class TagError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TagError';
    this.code = code;
  }
}

function generateTagToken() {
  // Uniform selection using rejection sampling; no modulo bias.
  const size = ALPHABET.length;
  const threshold = 256 - (256 % size);
  let token = '';
  while (token.length < 20) {
    for (const value of randomBytes(32)) {
      if (value < threshold) token += ALPHABET[value % size];
      if (token.length === 20) break;
    }
  }
  return token;
}

function assertPointId(pointId) {
  if (typeof pointId !== 'string' || !/^[a-f0-9-]{36}$/i.test(pointId)) {
    throw new TagError('INVALID_POINT', 'A persisted point UUID is required');
  }
}

function canonicalUrl(origin, token) {
  if (!TOKEN_PATTERN.test(token)) throw new TagError('INVALID_TOKEN', 'Invalid tag token');
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !url.hostname || url.port) {
    throw new TagError('INVALID_ORIGIN', 'Expected a validated HTTPS origin');
  }
  return `${url.origin}/go/${token}`;
}

/**
 * Repository contract:
 *  - createOrGetPrimary({pointId, kind, candidateToken, createdBy}) performs
 *    transactionally "find active primary -> else create" with unique constraints.
 *  - findByToken(token) returns {pointId, kind, status, token} or null.
 * Database must enforce unique active tag per (pointId, kind), unique token.
 */
async function getOrCreatePrimaryTag({ pointId, createdBy, repo, origin }) {
  assertPointId(pointId);
  if (!createdBy || typeof createdBy !== 'string') throw new TagError('NO_ACTOR', 'Actor is required');
  if (!repo || typeof repo.createOrGetPrimary !== 'function') throw new TagError('NO_REPOSITORY', 'Repository is required');
  const tag = await repo.createOrGetPrimary({
    pointId, kind: ENTRY_KIND, candidateToken: generateTagToken(), createdBy,
  });
  if (!tag || tag.pointId !== pointId || tag.kind !== ENTRY_KIND || !TOKEN_PATTERN.test(tag.token) || tag.status !== 'ACTIVE') {
    throw new TagError('INVALID_RECORD', 'Repository returned an invalid active tag');
  }
  return { pointId, kind: ENTRY_KIND, token: tag.token, url: canonicalUrl(origin, tag.token) };
}

async function resolveClubTag({ token, repo }) {
  if (!TOKEN_PATTERN.test(token)) throw new TagError('INVALID_TOKEN', 'Invalid tag token');
  if (!repo || typeof repo.findByToken !== 'function') throw new TagError('NO_REPOSITORY', 'Repository is required');
  const tag = await repo.findByToken(token);
  if (!tag || tag.status !== 'ACTIVE' || tag.kind !== ENTRY_KIND) {
    throw new TagError('TAG_UNAVAILABLE', 'This club tag is unavailable');
  }
  assertPointId(tag.pointId);
  // Caller redirects ONLY to an internal fixed route (never arbitrary URL from tag metadata).
  return { pointId: tag.pointId, flow: 'CLUB_ONBOARDING', source: 'PHYSICAL_TAG', tagToken: token };
}

module.exports = { ENTRY_KIND, TagError, TOKEN_PATTERN, generateTagToken, canonicalUrl, getOrCreatePrimaryTag, resolveClubTag };
