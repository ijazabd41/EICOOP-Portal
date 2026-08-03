# EIC Shareholder Bridge API Contract v19.0.2.0.8

Base URL variable: `{{base_url}}`

Authentication uses the Odoo session cookie. First call `send_otp`, then `login`; preserve cookies for subsequent requests.

## Authentication

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/shareholder/send_otp` | Generate login OTP |
| POST | `/api/shareholder/login` | Verify login OTP and establish session |
| POST | `/api/shareholder/refresh` | Validate/refresh current session |
| POST | `/api/shareholder/logout` | Clear session |

## Dashboard and profile

| Method | Route |
|---|---|
| GET/POST | `/api/shareholder/dashboard` |
| GET/POST | `/api/shareholder/profile` |
| POST | `/api/shareholder/update_profile` |

## Transfers

| Method | Route | Authentication |
|---|---|---|
| POST | `/api/shareholder/transfer/lookup_recipient` | Sender session recommended |
| POST | `/api/shareholder/transfer/request` | Sender |
| POST | `/api/shareholder/transfer/verify_sender_otp` | Sender |
| POST | `/api/shareholder/transfer/accept` | Receiver |
| POST | `/api/shareholder/transfer/reject` | Receiver |
| POST | `/api/shareholder/transfer/respond` | Receiver |
| POST | `/api/shareholder/transfer/verify_receiver_otp` | Receiver/legacy compatible |
| GET | `/api/shareholder/transfer/status/<encoded-reference>` | Sender or receiver |
| GET/POST | `/api/shareholder/transfer/status?reference=<reference>` | Sender or receiver; encoded-slash fallback |
| POST | `/api/shareholder/transfer/cancel` | Sender |
| GET/POST | `/api/shareholder/transfer/history` | Sender or receiver |
| GET/POST | `/api/shareholder/history` | Legacy alias |

### Compatibility note

Existing nested `transfer.status.next_action` values remain lowercase for backward compatibility. New clients should use `transfer.status.next_action_code` or the uppercase top-level `next_action` returned by the new workflow endpoints.

### Request transfer response keys

- `transfer_reference`
- `status`
- `next_action`
- `transfer`
- optional `test_otp` on staging

### Transfer status progression

| State | Progress | Next action |
|---|---:|---|
| `sender_otp` | 20 | `VERIFY_SENDER_OTP` |
| `receiver_approval` | 50 | `WAIT_RECEIVER_APPROVAL` |
| `receiver_otp` | 75 | `VERIFY_RECEIVER_OTP` |
| `operator` | 85 | `WAIT_BACKEND_REVIEW` |
| `approved` | 90 | `COMPLETE_TRANSFER` |
| `done` | 100 | `COMPLETED` |
| `rejected`/`cancelled`/`expired` | 100 | `CLOSED` |

## Invitations

| Method | Route |
|---|---|
| POST | `/api/shareholder/registration/invite` |
| GET/POST | `/api/shareholder/registration/status` |
| GET/POST | `/api/shareholder/invitation/status` |
| GET | `/api/shareholder/invitations` |
| POST | `/api/shareholder/registration/submit` |

## Notifications

| Method | Route |
|---|---|
| GET | `/api/shareholder/preferences` |
| POST | `/api/shareholder/preferences/update` |
| GET | `/api/shareholder/notifications` |
| POST | `/api/shareholder/notifications/read` |
| POST | `/api/shareholder/push/register` |
| POST | `/api/shareholder/push/unregister` |

## Certificates

| Method | Route |
|---|---|
| GET/POST | `/api/shareholder/certificates` |
| GET/POST | `/api/shareholder/certificate` |
| POST | `/api/shareholder/certificate/download` |
| POST | `/api/shareholder/certificate/preview` |

## Shares and history

| Method | Route | Note |
|---|---|---|
| GET/POST | `/api/shareholder/shares/available` | Personal available/reserved balance and market listings |
| POST | `/api/shareholder/shares/sell` | Approved marketplace listing workflow |
| POST | `/api/shareholder/shares/buy` | HTTP 501 future-ready placeholder |
| GET/POST | `/api/shareholder/activity` | Unified share/transfer/certificate activity |
| GET/POST | `/api/shareholder/dividends` | Stable dividend-history response; populated when a ledger integration exists |

## Error codes to handle

- `AUTH_REQUIRED`
- `SESSION_EXPIRED`
- `RECIPIENT_NOT_FOUND`
- `SELF_TRANSFER`
- `INVALID_SHARE_QUANTITY`
- `INSUFFICIENT_SHARES`
- `TRANSFER_REFERENCE_REQUIRED`
- `TRANSFER_NOT_FOUND`
- `INVALID_TRANSFER_STATE`
- `TRANSFER_ACCESS_DENIED`
- `TRANSFER_NOT_CANCELLABLE`
- `OTP_NOT_FOUND`
- `OTP_EXPIRED`
- `OTP_INVALID`
- `OTP_TOO_MANY_ATTEMPTS`
- `AUTO_COMPLETION_FAILED`
- `MOBILE_INVITE_LIMIT_REACHED`
- `SHAREHOLDER_INVITE_LIMIT_REACHED`
- `ACTIVE_INVITATION_EXISTS`
- `INVITATION_EXPIRED`
- `INVALID_PREFERRED_CHANNEL`
- `FEATURE_NOT_ENABLED`

Never display `technical_message` to end users. It is returned only when test mode is enabled.


## Postman execution variables

- `sender_session_id` and `receiver_session_id` are saved automatically from login responses.
- `transfer_decision`: `accept` or `reject`.
- `run_cancel_request`: keep `false` for the happy path; enable only at the pre-verification cancellation stage.
- `run_logout`: keep `false` during collection runs and enable only for intentional logout testing.
