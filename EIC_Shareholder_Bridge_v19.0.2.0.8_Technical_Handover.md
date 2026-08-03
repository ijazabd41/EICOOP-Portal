# EIC Shareholder Bridge v19.0.2.0.8 — Technical Handover

Release date: 2026-08-01  
Technical module: `eic_shareholder_bridge_v19`  
Upgrade type: backward-compatible enhancement of v19.0.2.0.7

## 1. Deployment objective

Upgrade the existing module without replacing its architecture, technical name, models, XML identifiers, or existing API routes. Existing Web and Flutter payload aliases remain accepted. New fields and routes are additive.

Do not uninstall the current module. Copy the upgraded folder over the existing custom-addons folder and run an Odoo module upgrade so Odoo creates the additive columns and cron record.

## 2. Preserved contracts

The following existing routes remain available:

- `POST /api/shareholder/login`
- `POST /api/shareholder/profile`
- `POST /api/shareholder/dashboard`
- `POST /api/shareholder/transfer/lookup_recipient`
- `POST /api/shareholder/transfer/request`
- `POST /api/shareholder/transfer/verify_sender_otp`
- `POST /api/shareholder/transfer/verify_receiver_otp`
- `POST /api/shareholder/history`
- `POST /api/shareholder/certificate`

Legacy aliases such as `verify_sender`, `verify_receiver`, `transfers`, `transfer/history`, and `certificates` also remain.

The module's established API serializer returns scalar values as strings. This behavior is intentionally retained because existing Flutter/Web integrations may depend on it. Existing nested transfer `status.label` and `status.next_action` values are also retained; additive `next_action_code` values provide the new uppercase machine actions.

## 3. Transfer state machine

### New standard journey

`sender_otp` → `receiver_approval` → `receiver_otp` → `done`

Optional exception path:

`receiver_otp` → `operator` when automatic completion is disabled or balance posting needs manual review.

Terminal states:

- `done`
- `rejected`
- `cancelled`
- `expired`

### Important requirement resolution

The handover contained two conflicting statements: one asked sender verification to return `receiver_otp`, while the receiver workflow stated that OTP must not be generated until the receiver accepts. The implementation follows the safer and logically consistent requirement:

- Sender verification returns `status = receiver_approval`.
- Receiver sees Accept/Reject.
- Only Accept changes the state to `receiver_otp` and generates the receiver OTP.

### Backward compatibility for in-flight records

A v19.0.2.0.7 transfer already in `receiver_otp` may have an OTP but no receiver-approval fields. During verification, the controller detects the legacy OTP and marks the approval as accepted. Pending users are therefore not stranded by the upgrade.

## 4. New transfer routes

### Receiver response

- `POST /api/shareholder/transfer/respond`
- `POST /api/shareholder/transfer/accept`
- `POST /api/shareholder/transfer/reject`

Payload:

```json
{
  "transfer_reference": "SHT/2026/00001",
  "decision": "accept",
  "reason": "Optional rejection reason"
}
```

The receiver must be authenticated. `accept` generates and dispatches the OTP. `reject` closes the request and notifies the sender.

### Transfer status

`GET /api/shareholder/transfer/status/<reference>`

The transfer reference contains `/` under the existing sequence, so Web/Flutter should URL-encode the path variable. The response includes status, progress, sender verification, receiver approval, receiver verification, next action, and the full timeline. An additive fallback is available as `GET/POST /api/shareholder/transfer/status?reference=<reference>` for Apache or proxy configurations that reject encoded slashes.

### Cancel transfer

`POST /api/shareholder/transfer/cancel`

```json
{
  "transfer_reference": "SHT/2026/00001",
  "reason": "Optional cancellation note"
}
```

Cancellation is allowed only for the sender while the state is `sender_otp`, `receiver_approval`, or `receiver_otp`, and only before receiver OTP verification.

## 5. Balance and certificate posting

After receiver OTP verification:

1. Sender and receiver partner rows are locked in the database.
2. Current active holdings are recalculated.
3. Sender balance is reduced and receiver balance is increased.
4. Negative sender balances are blocked.
5. Transfer moves to `done`.
6. Professional balance certificate snapshots are generated for both shareholders.
7. Transfer history and chatter are updated.
8. Preference-controlled completion and certificate notifications are committed to the notification queue atomically with the transfer, then delivered by the existing bounded notification cron. This prevents external channel delivery from preceding a failed database posting.

Share-sale completion uses certificate origins `sell` and `buy`. Direct transfer uses `transfer`.

Other approved modules can regenerate a balance certificate after bonus shares or capital increase by calling:

```python
partner.action_regenerate_share_certificate(
    origin='bonus',  # manual, transfer, buy, sell, bonus, capital
    reference_model='your.model',
    reference_id=record.id,
    note='Approved bonus-share allocation',
)
```

This hook creates a certificate snapshot only. The calling business module must update the real balance first.

## 6. Invitation changes

Invitation APIs and portal now accept:

- name
- mobile
- email
- preferred notification channel
- requested shares
- remarks
- category/channel preferences

Rules remain configurable with defaults:

- 3 invitations per mobile per day
- 10 invitations per inviting shareholder per day
- one active invitation per mobile
- expiry after 7 days

Status alias added:

`GET/POST /api/shareholder/invitation/status`

## 7. Notification and dashboard changes

The API dashboard now includes:

- total, reserved, and available shares
- pending outgoing transfers
- completed/cancelled outgoing transfers
- incoming requests
- completed/rejected receipts
- pending invitations
- unread notification count
- transfer progress/timeline

The Odoo portal now provides actionable cards:

- Receiver Accept/Reject
- Receiver OTP verification
- Sender cancellation before receiver verification
- Available/reserved shares
- Pending outgoing/incoming transfers
- Completed receipts/transfers
- Notification centre, invitations, and certificate origin

## 8. New/future-ready routes

- `GET/POST /api/shareholder/activity`
- `GET/POST /api/shareholder/dividends`
- `GET/POST /api/shareholder/shares/available`
- `POST /api/shareholder/shares/sell`
- `POST /api/shareholder/shares/buy`

The direct buy route intentionally returns HTTP 501 `FEATURE_NOT_ENABLED`; it is a stable placeholder. The approved marketplace workflow remains the live buy/sell mechanism.

## 9. New settings

Go to Shareholder/API settings and verify:

- Automatically Complete After Receiver OTP: enabled by default
- Transfer Expiry Hours: 48 by default
- Invitation limits and expiry
- OTP test mode disabled on production
- SMS provider/API URL and headers
- valid email sender
- push and WhatsApp webhook URLs if used

An hourly cron expires unfinished transfers in `sender_otp`, `receiver_approval`, or `receiver_otp` after the configured duration.


## 10. Postman collection execution

The included `EIC Shareholder Bridge API v19.0.2.0.8` collection contains 32 requests and is prepared for a full two-party test:

- Sender login stores `sender_session_id`.
- Receiver login stores `receiver_session_id`.
- Every authenticated request sends the correct explicit `session_id` cookie, so one Postman cookie jar does not mix the two shareholders.
- `transfer_decision=accept` runs the receiver OTP/completion journey.
- `transfer_decision=reject` runs the rejection journey and skips receiver OTP verification.
- `run_cancel_request=false` by default because cancellation is mutually exclusive with the completed happy path. Run Cancel manually before receiver verification when testing that branch.
- `run_logout=false` by default so collection runs do not invalidate the stored sender session midway.
- The buy-shares placeholder correctly expects HTTP 501 `FEATURE_NOT_ENABLED`.

## 11. Flutter implementation instructions

Use a repository/service layer that keeps the Odoo session cookie. Never ask the shareholder to type `transfer_reference`.

After transfer request:

1. Read `transfer_reference` from the response.
2. Store it in the local transfer object/state.
3. Reuse it for sender OTP, status, cancel, receiver response, and receiver OTP calls.
4. URL-encode it for the status path.
5. Poll status only while the transfer is non-terminal; 10–20 seconds while a status screen is open is sufficient.
6. Stop polling on `done`, `rejected`, `cancelled`, or `expired`.

Required screens:

- Dashboard
- Buy Shares
- Sell Shares
- Transfer Shares
- Transfer Status
- Pending Transfers
- Incoming Transfers
- Notification Centre
- Notification Preferences
- Certificates
- Share Activity Timeline
- Invite Shareholder
- Invitation Status

Each action screen must explain the action, next stage, notification channels, reversibility, and current progress. Receiver acceptance must clearly state that accepting generates an OTP and that the transfer completes after OTP verification.

Because the receiver action is tied to the receiver's authenticated session, test sender and receiver journeys with separate user sessions/devices or independent cookie stores.

## 12. Web implementation instructions

The Web app must preserve cookies and use the same reference-storage rule as Flutter. Do not expose editable reference fields. Incoming transfer cards must show sender name, membership number, shares, reference, Accept, and Reject. After Accept, replace the action card with receiver OTP entry. Sender cards must show Cancel only while `cancellable` is true.

The Odoo portal implementation in this module can be used as a functional reference for the custom website UI.

## 13. Upgrade procedure

Recommended staging commands, adjusted to the actual service/database names:

```bash
sudo systemctl stop odoo19
sudo -u postgres pg_dump -Fc YOUR_DATABASE > /backup/eic_before_19.0.2.0.8.dump
rsync -a --delete eic_shareholder_bridge_v19/ /opt/odoo19/custom_addons/eic_shareholder_bridge_v19/
sudo chown -R odoo:odoo /opt/odoo19/custom_addons/eic_shareholder_bridge_v19
sudo -u odoo /opt/odoo19/venv/bin/python /opt/odoo19/odoo-bin \
  -c /etc/odoo19.conf -d YOUR_DATABASE \
  -u eic_shareholder_bridge_v19 --stop-after-init
sudo systemctl start odoo19
```

Do not uninstall/reinstall. Do not run SQL to rename states or fields.

## 14. Mandatory testing parties

- Odoo backend developer: install/upgrade, schema, cron, balance locking, certificates, logs.
- Flutter developer: two-session sender/receiver flow, reference storage, polling, screens, error handling.
- Web developer: cookies, Accept/Reject, OTP, cancellation, dashboard/timeline.
- Membership management: recipient validation, invitation approval, rejected/expired cases.
- Finance/Treasury: opening balances, transfer debit/credit, marketplace paid transfer, certificate totals.
- IT/QA: SMS/email/push/WhatsApp settings, production test mode off, API security and regression.

## 15. Acceptance checklist

1. Existing login/profile/dashboard/certificate/history calls still work without payload changes.
2. Lookup returns both `shareholder` and legacy `recipient` objects.
3. A second pending transfer cannot reserve more shares than available.
4. Sender OTP does not generate receiver OTP.
5. Receiver Reject closes and notifies sender.
6. Receiver Accept generates one current OTP.
7. Receiver OTP automatically updates balances and completes.
8. Sender and receiver certificates reflect final balances.
9. Cancel works before receiver verification and fails afterward.
10. Expired transfer becomes terminal and releases the reservation.
11. In-flight v19.0.2.0.7 receiver OTP can still be completed.
12. Portal Accept/Reject/OTP/Cancel actions work.
13. Invitation limits, one-active rule, expiry, remarks and preferences work.
14. Notification preference/channel results are recorded.
15. Direct buy returns the documented future-ready response without creating accounting entries.

## 16. Rollback

If registry upgrade fails, stop Odoo, restore the pre-upgrade database backup, restore the previous module directory, clear Python cache directories, and start Odoo. Do not try to downgrade the database by manually dropping the new columns.

## 17. Source availability note

Only the Odoo module was supplied for this work. No Flutter or custom website source project was included. Therefore, this package contains the backend implementation, Odoo portal implementation, API contract, Postman collection, and exact frontend integration instructions—not compiled Flutter/Web application files.
