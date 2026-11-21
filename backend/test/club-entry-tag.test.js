'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ENTRY_KIND, TagError, TOKEN_PATTERN, generateTagToken,
  canonicalUrl, getOrCreatePrimaryTag, resolveClubTag,
} = require('../src/modules/clubEntry/ClubEntryTagService');

const point1 = '01234567-89ab-4cde-8123-abcdef123456';
const point2 = '11234567-89ab-4cde-8123-abcdef123456';
const origin = 'https://utimoshi.ru/';

class FakeRepo {
  constructor() { this.tags = new Map(); this.byToken = new Map(); }
  async createOrGetPrimary({ pointId, kind, candidateToken }) {
    const key = `${pointId}:${kind}`;
    if (this.tags.has(key)) return this.tags.get(key);
    const tag = { pointId, kind, token: candidateToken, status: 'ACTIVE' };
    this.tags.set(key, tag); this.byToken.set(tag.token, tag);
    return tag;
  }
  async findByToken(token) { return this.byToken.get(token) || null; }
}

test('new tag uses unpredictable 20-char URL-safe token', () => {
  const tokens = new Set(Array.from({ length: 100 }, generateTagToken));
  assert.equal(tokens.size, 100);
  for (const token of tokens) assert.match(token, TOKEN_PATTERN);
});

test('QR and NFC share a stable HTTPS URL', () => {
  const token = generateTagToken();
  assert.equal(canonicalUrl(origin, token), `https://utimoshi.ru/go/${token}`);
  assert.throws(() => canonicalUrl('http://utimoshi.ru/', token), /HTTPS/);
  assert.throws(() => canonicalUrl('https://user:pass@utimoshi.ru/', token), /HTTPS/);
  assert.throws(() => canonicalUrl('https://utimoshi.ru/?q=1', token), /HTTPS/);
});

test('repeated calls for same point resolve the same single active tag', async () => {
  const repo = new FakeRepo();
  const a = await getOrCreatePrimaryTag({ pointId: point1, createdBy: 'admin1', repo, origin });
  const b = await getOrCreatePrimaryTag({ pointId: point1, createdBy: 'admin1', repo, origin });
  assert.deepEqual(a, b);
  assert.equal(repo.tags.size, 1);
});

test('different points receive independent tags', async () => {
  const repo = new FakeRepo();
  const a = await getOrCreatePrimaryTag({ pointId: point1, createdBy: 'admin1', repo, origin });
  const b = await getOrCreatePrimaryTag({ pointId: point2, createdBy: 'admin1', repo, origin });
  assert.notEqual(a.token, b.token);
});

test('resolve does not expose customer data or arbitrary redirect target', async () => {
  const repo = new FakeRepo();
  const tag = await getOrCreatePrimaryTag({ pointId: point1, createdBy: 'admin1', repo, origin });
  assert.deepEqual(await resolveClubTag({ token: tag.token, repo }), {
    pointId: point1, flow: 'CLUB_ONBOARDING', source: 'PHYSICAL_TAG', tagToken: tag.token,
  });
});

test('revoked tags cannot resolve', async () => {
  const repo = new FakeRepo();
  const tag = await getOrCreatePrimaryTag({ pointId: point1, createdBy: 'admin1', repo, origin });
  repo.byToken.get(tag.token).status = 'REVOKED';
  await assert.rejects(resolveClubTag({ token: tag.token, repo }), e => e instanceof TagError && e.code === 'TAG_UNAVAILABLE');
});

test('malformed token and unknown point rejected', async () => {
  const repo = new FakeRepo();
  await assert.rejects(resolveClubTag({ token: '../invalid', repo }), /Invalid tag token/);
  await assert.rejects(getOrCreatePrimaryTag({ pointId: '001', createdBy: 'admin1', repo, origin }), /point UUID/);
  await assert.rejects(getOrCreatePrimaryTag({ pointId: point1, createdBy: '', repo, origin }), /Actor/);
});
