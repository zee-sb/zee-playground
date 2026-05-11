// Suggestion chips for the empty-conversation state. Mapped to the kinds of
// MCP tools the Atlassian Remote MCP server exposes.

export const READ_SUGGESTIONS = [
  'List the Confluence spaces I have access to',
  "What pages mention the Q2 roadmap?",
  'Summarize the most recently updated page in the Product space',
  'Show me open issues assigned to me with priority High',
];

export const WRITE_SUGGESTIONS = [
  'Add a comment to AIW-243 with my status update',
  "Create a Confluence page in the Product space titled 'Companion test'",
  "Update the page about Q2 roadmap with a status badge",
];

export const ALL_SUGGESTIONS = [...READ_SUGGESTIONS, ...WRITE_SUGGESTIONS];
