// Type definitions for the flows module — JSDoc so we get IDE hints without
// adding a TypeScript build step.
//
// A Flow is a deterministic multi-step automation: form steps collect input,
// tool steps call MCPs, confirm steps gate a final action. No LLM at runtime
// (one LLM call exists at authoring time, in scaffold.mjs).

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

/** @typedef {FormStep | ToolStep | ConfirmStep} FlowStep */

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
 */

/**
 * @typedef {Object} FlowRun
 * @property {string} flowId
 * @property {string} flowName
 * @property {number} currentStepIndex
 * @property {Record<string, unknown>} stepOutputs
 * @property {"running" | "awaiting_user" | "completed" | "cancelled"} status
 * @property {{ kind: "form" | "confirm", stepId: string } | null} awaiting
 * @property {string} [summary]
 */

export const FLOW_SCHEMA_VERSION = 1;
