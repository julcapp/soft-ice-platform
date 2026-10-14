# Prepaid pickup and QR scanner contract

## Lifecycle

1. Mini App/Web order is paid and backend verifies `Payment.status = SUCCEEDED`.
2. The order becomes `PAID` and is eligible for pickup for 48 hours.
3. No machine command and no long-lived ingredient reservation is created at payment time.
4. At the machine, the buyer requests a pickup credential. The server issues:
   - a six-digit code;
   - a QR representation of the same one-time credential;
   - expiry: 5 minutes.
5. On redeem, backend verifies payment, order, machine, expiry and one-time credential.
6. Backend reconstructs the paid composition from `PricingSnapshotItem`, checks current inventory and creates a short reservation.
7. Only then is `MachineDispenseService.createAuthorizedFromPaidFlow()` called and `MACHINE_COMMAND_QUEUED` is written to the transactional outbox.
8. After successful dispense the order/flow become `COMPLETED` and inventory reservation is `CONSUMED`.

## QR payload

Format:

`UTP1:<order UUID>:<six-digit pickup code>`

Example shape only:

`UTP1:00000000-0000-0000-0000-000000000000:123456`

Do **not** place `customerId`, phone number, Telegram ID, or other customer identifiers in the QR. The backend resolves ownership from the order. The QR is a short-lived bearer credential and must be treated like the six-digit code.

## Scanner API

POST `/api/v1/orders/pickup/redeem`

Manual code:
```json
{"machineId":"<machine>","code":"123456"}
```

QR scan:
```json
{"machineId":"<machine>","qrPayload":"UTP1:<order UUID>:123456"}
```

Both paths execute the same authoritative redeem logic.

## Display/native bridge

The React display exposes:

`window.softIcePickupQrScan(payload)`

A native Android/WebView scanner adapter may call this function with the raw QR payload.

The display also listens for:

`window.dispatchEvent(new CustomEvent('softice:pickup-qr', { detail: { payload } }))`

The physical camera/scanner driver is a hardware-specific adapter and must not contain payment or dispense business logic.

## Security

- code/QR lifetime: 5 minutes;
- single-use: `activePickupCodeHash` is cleared atomically on successful redeem;
- stored credential: salted scrypt hash only;
- machine-scoped;
- rate-limited;
- authoritative payment must be `SUCCEEDED`;
- repeated use after successful redemption is rejected.
