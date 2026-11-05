# ADR-055: Transactional email delivery service

Status: Accepted  
Date: 2026-11-05

## Decision

Soft ICE does not run a public mail transfer agent (Postfix/Exim) for customer email.

The application backend only creates transactional messages in `CrmNotificationDelivery`.
A dedicated `softice-mail-delivery.service` worker delivers rows where `channel=EMAIL`
through an authenticated external SMTP provider.

For `utimoshi.ru`, the selected provider is RU-CENTER mail. DNS for the domain is
already hosted at RU-CENTER. The service remains provider-neutral and supports
implicit TLS (normally 465) and STARTTLS (normally 587).

## Sender identity

- From: `no-reply@utimoshi.ru`
- Reply-To: configured independently with `MAIL_REPLY_TO`
- SMTP username/password are never stored in Git.
- Service secrets live only in `/etc/softice/mail-delivery.env` with restrictive permissions.

## Queue states

Email deliveries use:

`PENDING -> SENDING -> SENT`

or

`PENDING/FAILED -> SENDING -> FAILED`

A failed row receives `nextAttemptAt` and is retried with configured backoff until
`MAIL_MAX_ATTEMPTS` is reached. A stale `SENDING` row older than 10 minutes may
be reclaimed to recover after a worker crash.

The queue stores:

- recipient address
- provider response / provider message id
- attempt count
- last attempt timestamp
- next attempt timestamp
- failure code
- correlation/idempotency identifiers

## Email verification

Customer email verification creates the token first, queues the delivery with the
unverified destination address, and keeps the token valid for 24 hours.

The verification link targets:

`https://miniapp.utimoshi.ru/?mode=verify-email&token=...`

The email address is copied to `Customer.email` only after the token is confirmed.

## Service boundary

The worker needs only its dedicated environment file and database access.
It must not require MAX, Telegram, payment or machine-control credentials.

Inbound mail is not hosted by Soft ICE. Incoming mail remains the responsibility
of the external mail provider.

## Operational requirements

Before enabling the worker in production:

1. create `no-reply@utimoshi.ru` with the SMTP provider;
2. publish the provider-required MX/SPF/DKIM records and a DMARC policy in RU-CENTER DNS;
3. create `/etc/softice/mail-delivery.env` with mode 0600;
4. apply the CRM email-delivery migration;
5. verify SMTP authentication with a test recipient;
6. enable and start `softice-mail-delivery.service`;
7. verify `PENDING -> SENT` and the email-verification link end-to-end.
