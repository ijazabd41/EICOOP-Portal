# EIC Shareholder OPS Web UI v2.2

Preintegrated with `eic_shareholder_operations_portal_api v19.0.2.0.2`.

## Transfer policy control
The dashboard displays and can change the management setting:

- Automatic ON: Operations approval → Receiver → Receiver OTP → Automatic Completion
- Automatic OFF: Operations approval → Receiver → Receiver OTP → Chairman Final Approval → Completion

Operations approval before notifying the receiver is never disabled.
Policy changes affect only new transfers because the bridge snapshots the policy at transfer creation.

All requests reuse the authenticated Odoo session with `credentials: 'include'`.
