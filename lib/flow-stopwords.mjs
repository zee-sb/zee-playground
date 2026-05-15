// Shared stopword list for flow-trigger matching. Pure — no imports — so it
// can be loaded from both server-only modules (studio-config.mjs) and modules
// that get bundled into the client (flows/runtime.mjs).

export const FLOW_STOPWORDS = new Set([
  'employee','employees','asks','wants','says','their','they','the','and','for',
  'that','this','about','have','with','what','when','where','how','why','who',
  'which','to','on','of','in','a','an','or','is','are','be','do','need','needs',
  'help','want','start','starts','mentions','mention','from','just','some',
  'get','one','day',
]);
