# Soft ICE transactional mail delivery

Status: implementation branch `feat/mail-delivery-service-20261103`.

## Architecture

- Soft ICE backend creates `CrmNotificationDelivery` records.
- EMAIL records start in `PENDING`.
- `softice-mail-delivery.service` is the only CRM email sender.
- The worker uses an external authenticated SMTP provider. No local Postfix/Exim is required.
- SMTP credentials and the worker database credential live only in `/etc/softice/mail-delivery.env`.
- The worker transitions deliveries through `PENDING -> SENDING -> SENT / FAILED`.
- Failed deliveries use bounded automatic retries: 1 minute, 5 minutes, 15 minutes, 1 hour, 6 hours, with 5 attempts maximum.
- Stale `SENDING` rows are recovered after 5 minutes.
- Verification emails store `recipientAddress` before the customer email is confirmed.
- Other service emails may fall back to the already verified `Customer.email`.

## Production SMTP identity

Sender mailbox:

`no-reply@utimoshi.ru`

Recommended provider:

Hostland authenticated SMTP over implicit TLS:

- Host: `mail.hostland.ru`
- Port: `465`
- Username: full mailbox address
- TLS certificate verification: required

Do not store the mailbox password in Git, shell history, documentation, or application logs.

## DNS ownership

As of 2026-11-03 the authoritative nameservers for `utimoshi.ru` are NIC.ru. Mail DNS records therefore must be published in the NIC.ru DNS zone even when the mailbox is hosted by Hostland.

Hostland documents these base mail records for domains using external DNS:

- MX for `utimoshi.ru`: priority 10, target `mail.utimoshi.ru`
- A for `mail.utimoshi.ru`: `185.26.123.232`

SPF, DKIM and DMARC must be enabled in Hostland and the exact values supplied by Hostland must be copied into the NIC.ru DNS zone. Do not invent DKIM selectors or SPF values.

## Environment file

Create `/etc/softice/mail-delivery.env` owned by root and readable by the `softice` service account only.

Use `deploy/mail-delivery/mail-delivery.env.example` as the template.

Required values:

- `DATABASE_URL`
- `MAIL_SMTP_HOST`
- `MAIL_SMTP_PORT`
- `MAIL_SMTP_USER`
- `MAIL_SMTP_PASSWORD`
- `MAIL_SMTP_FROM`

Optional:

- `MAIL_REPLY_TO`
- worker timing and batch controls

Recommended permissions:

```sh
chown root:softice /etc/softice/mail-delivery.env
chmod 0640 /etc/softice/mail-delivery.env
```

## Database migration

Apply the canonical Prisma migrations before starting the worker.

The mail migration adds delivery-recipient and retry state fields to `CrmNotificationDelivery`.

Always take a PostgreSQL backup before production migration.

## Service deployment

Recommended worktree:

`/home/julcapp/soft-ice-worktrees/mail-delivery`

Install the unit from:

`deploy/systemd/softice-mail-delivery.service`

Then:

```sh
systemctl daemon-reload
systemctl enable --now softice-mail-delivery.service
systemctl status softice-mail-delivery.service
journalctl -u softice-mail-delivery.service -n 100 --no-pager
```

## Delivery verification

1. Confirm `no-reply@utimoshi.ru` can authenticate to Hostland SMTP.
2. Confirm public MX/SPF/DKIM/DMARC records.
3. Request email verification from the Mini App.
4. Confirm the CRM delivery record changes to `PENDING`.
5. Confirm the worker changes it to `SENDING` and then `SENT`.
6. Confirm `providerId`, `providerResponse`, `attemptCount`, `lastAttemptAt`, and `sentAt` are populated.
7. Open the one-time verification URL and confirm the email becomes `VERIFIED`.
8. Test one temporary SMTP failure and confirm a delayed retry is scheduled.
9. Never use this mailbox for bulk advertising. Marketing email requires its own consent and sending policy.

## Rollback

Stopping the mail worker is safe for the customer purchase flow. Pending email records remain in the database.

```sh
systemctl stop softice-mail-delivery.service
```

Do not delete queued rows during rollback. Restore only the application/migration state using the normal controlled rollback procedure.
