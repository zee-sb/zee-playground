// Type definitions for the flows module — JSDoc so we get IDE hints without
// adding a TypeScript build step.
//
// A Flow is a deterministic multi-step automation: form steps collect input,
// tool steps call MCPs, confirm steps gate a final action. No LLM at runtime
// (one LLM call exists at authoring time, in scaffold.mjs).
//
// v9 expansion (no breaking changes): added approval, branch, file_upload,
// signature, location, barcode, wait, and notify step types. Also added
// flow-level fields: audience, versions, worksCouncil, dismissedFor.

/**
 * @typedef {Object} FormField
 * @property {string}  id
 * @property {string}  label
 * @property {string}  type     "text" | "textarea" | "number" | "email" | "url" | "date" | "select" | "checkbox" | "radio"
 * @property {boolean} [required]
 * @property {string}  [description]
 * @property {object}  [validation]
 * @property {Array<{value: string, label: string}>} [options]   for select/radio
 */

/**
 * @typedef {Object} FormStep
 * @property {string}  id
 * @property {"form"}  type
 * @property {string}  label
 * @property {{
 *   title:       string,
 *   description: string,
 *   submitLabel: string,
 *   fields:      FormField[]
 * }} spec
 */

/**
 * @typedef {Object} ToolStep
 * @property {string} id
 * @property {"tool"} type
 * @property {string} label
 * @property {{ connectorId: string, toolId: string }} tool
 * @property {object} [args]                args, may contain {{stepId.fieldId}} tokens
 * @property {object} [output]              optional output shape hints
 */

/**
 * @typedef {Object} ConfirmStep
 * @property {string} id
 * @property {"confirm"} type
 * @property {string} label
 * @property {{
 *   title:        string,
 *   description:  string,
 *   rows:         Array<{label: string, value: string}>,
 *   confirmLabel: string,
 *   cancelLabel:  string,
 *   cancelTo?:    string
 * }} summary
 */

/**
 * @typedef {Object} ApprovalStep
 * @property {string} id
 * @property {"approval"} type
 * @property {string} label
 * @property {{
 *   route:    "manager" | "hr" | "it" | "finance" | "role" | "named",
 *   approver: string,
 *   title:    string,
 *   message:  string,
 *   slaHours: number,
 *   onReject: "cancel" | "continue" | "rewind",
 *   rewindTo?: string,
 * }} approval
 */

/**
 * @typedef {Object} BranchStep
 * Conditional skip — evaluates `left <op> right` after resolving tokens, then
 * jumps to `thenGoTo` (truthy) or `elseGoTo` (falsy, or next step if unset).
 * @property {string} id
 * @property {"branch"} type
 * @property {string} label
 * @property {{
 *   left:  string,
 *   op:    "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "is_truthy",
 *   right: string,
 *   thenGoTo?: string,
 *   elseGoTo?: string,
 * }} branch
 */

/**
 * @typedef {Object} FileUploadStep
 * @property {string} id
 * @property {"file_upload"} type
 * @property {string} label
 * @property {{
 *   title:       string,
 *   description: string,
 *   kind:        "pdf" | "image" | "document" | "any",
 *   maxMB:       number,
 *   required:    boolean,
 *   submitLabel: string,
 * }} file
 */

/**
 * @typedef {Object} SignatureStep
 * @property {string} id
 * @property {"signature"} type
 * @property {string} label
 * @property {{
 *   title:       string,
 *   description: string,
 *   attestation: string,
 *   kind:        "draw" | "type" | "click",
 *   required:    boolean,
 * }} signature
 */

/**
 * @typedef {Object} LocationStep
 * @property {string} id
 * @property {"location"} type
 * @property {string} label
 * @property {{
 *   title:       string,
 *   description: string,
 *   accuracy:    "precise" | "approximate",
 *   required:    boolean,
 * }} location
 */

/**
 * @typedef {Object} BarcodeStep
 * @property {string} id
 * @property {"barcode"} type
 * @property {string} label
 * @property {{
 *   title:       string,
 *   description: string,
 *   format:      "any" | "qr" | "ean" | "code128" | "datamatrix",
 *   required:    boolean,
 * }} barcode
 */

/**
 * @typedef {Object} WaitStep
 * Async pause — flow goes to sleep; resumed by scheduler or by an inbound
 * trigger. Demonstrated in this prototype with a "Simulate resume" affordance.
 * @property {string} id
 * @property {"wait"} type
 * @property {string} label
 * @property {{
 *   amount:  number,
 *   unit:    "minutes" | "hours" | "days",
 *   message: string,
 * }} wait
 */

/**
 * @typedef {Object} NotifyStep
 * Outbound notification — push, email, or in-app. No user response expected;
 * the step advances immediately on dispatch.
 * @property {string} id
 * @property {"notify"} type
 * @property {string} label
 * @property {{
 *   channel:  "push" | "email" | "in_app",
 *   to:       string,
 *   title:    string,
 *   body:     string,
 *   deepLink?: string,
 * }} notify
 */

/** @typedef {FormStep | ToolStep | ConfirmStep | ApprovalStep | BranchStep | FileUploadStep | SignatureStep | LocationStep | BarcodeStep | WaitStep | NotifyStep} FlowStep */

/**
 * @typedef {Object} Audience
 * @property {boolean}  everyone
 * @property {string[]} roles
 * @property {string[]} locations
 */

/**
 * @typedef {Object} VersionEntry
 * @property {number} version
 * @property {string|null} publishedAt
 * @property {string|null} publishedBy
 * @property {string} note
 * @property {object|null} snapshot
 */

/**
 * @typedef {Object} WorksCouncilApproval
 * @property {boolean} required
 * @property {"not_required" | "pending" | "approved" | "rejected"} status
 * @property {string|null} approvedBy
 * @property {string|null} approvedAt
 * @property {string} note
 */

/**
 * @typedef {Object} Flow
 * @property {string}     id
 * @property {string}     name
 * @property {string}     trigger
 * @property {"draft" | "active" | "archived"} status
 * @property {"suggested" | "required"} mode
 * @property {string}     goal
 * @property {string}     instructions
 * @property {string}     [onComplete]
 * @property {Array<{ connectorId: string, toolId: string }>} tools
 * @property {FlowStep[]} steps
 * @property {Audience}   audience
 * @property {boolean}    hasDraft
 * @property {number}     publishedVersion
 * @property {VersionEntry[]} versions
 * @property {WorksCouncilApproval} worksCouncil
 * @property {string}     ownerTeam
 * @property {Record<string,string>} dismissedFor
 * @property {number}     dismissalSuppressDays
 */

/**
 * @typedef {Object} FlowRun
 * @property {string} flowId
 * @property {string} flowName
 * @property {number} currentStepIndex
 * @property {Record<string, unknown>} stepOutputs
 * @property {"running" | "awaiting_user" | "completed" | "cancelled"} status
 * @property {{ kind: string, stepId: string } | null} awaiting
 * @property {string} [summary]
 */

export const FLOW_SCHEMA_VERSION = 2;
