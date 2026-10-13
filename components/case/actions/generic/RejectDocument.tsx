/**
 * Send back is now part of the Verify panel (workstream 4D): a failing checklist item makes
 * Send back the primary action there, with its reason prefilled. This file stays, registered
 * under reject_document in ../generic/index.ts, so a stale `reject_document:<task id>` open
 * key (or a deep link written before the merge) still opens the same panel instead of nothing.
 */
export { VerifyDocumentPanel as RejectDocumentPanel } from "./VerifyDocument"
