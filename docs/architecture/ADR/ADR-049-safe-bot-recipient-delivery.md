# ADR-049: Safe Bot Recipient Delivery

## Status

Accepted — 2026-09-02.

## Context

Gift Transfer already persists gifts and delivery attempts, but a provider can send a personal invitation only when the backend has a verified Telegram `chat_id` or MAX `user_id`. Customer Identity intentionally stores external subject hashes and cannot be reversed for outbound delivery. Storing plaintext provider identifiers in gifts or callback payloads would widen access to personal identifiers and secrets.

## Decision

1. A destination is observed only while processing a trusted inbound Telegram/MAX webhook and only after the provider subject resolves to the same canonical customer.
2. Telegram accepts only a private chat where `chat_id` equals the sender subject. Group, supergroup and channel destinations are rejected.
3. MAX stores the verified inbound sender as a `user_id`; outbound delivery follows the official `POST /messages?user_id=...` contract.
4. PostgreSQL stores a SHA-256 external-subject hash and an AES-256-GCM ciphertext. Associated data is `customerId:channel`, so ciphertext cannot be moved between customers or channels.
5. Telegram and MAX delivery have independent feature flags. Both default to false and configuration validation fails closed when an enabled channel lacks its token or the encryption key.
6. Provider messages contain only a human-readable gift notice and a Mini App link. Invitation tokens, phones, redemption codes, receipts and payment data remain server-side.
7. `GiftInvitation.status = SENT` is recorded only after at least one real provider result is `SENT` or `DELIVERED`. Disabled, unbound and unavailable channels are persisted as attempts without claiming successful delivery.

## Consequences

- Existing users acquire or refresh a binding when they interact with the bot; a newly onboarded user is resolved again before binding.
- Key rotation is represented by `keyVersion`; operational rotation tooling is required before changing the active key.
- Provider delivery is transactional service communication, not marketing broadcast, but consent and notification-preference policy may still suppress future optional messages.
- Production enablement and deployment remain separate operational decisions.

## Official provider contracts

- Telegram Bot API: `sendMessage` requires a destination `chat_id`.
- MAX Bot API: `POST https://platform-api2.max.ru/messages` accepts `user_id` or `chat_id` in the query and the bot token in the `Authorization` header.
