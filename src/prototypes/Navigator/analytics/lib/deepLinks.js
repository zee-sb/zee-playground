// CTA target builders. Pure functions — the analytics views call these to
// produce the URL or modal-open intent for each recommended_action.
//
// The shape `{ kind, href, ...payload }` lets the renderer either navigate
// or open a modal based on `kind`.

export function buildAction(basePath, recommendedAction, payload = {}) {
  switch (recommendedAction) {
    case 'connect_source': {
      const params = new URLSearchParams();
      params.set('suggested', payload.suggested_source_kind || 'generic');
      if (payload.topic) params.set('topic', payload.topic);
      return {
        kind: 'navigate',
        label: 'Connect a source',
        href: `${basePath}/connections?${params.toString()}`,
      };
    }
    case 'draft_faq': {
      return {
        kind: 'modal',
        modal: 'draft_faq',
        label: 'Draft an FAQ',
        topic: payload.topic || null,
        question_seed: payload.question_seed || '',
      };
    }
    case 'edit_instructions': {
      const params = new URLSearchParams();
      if (payload.topic) params.set('topic', payload.topic);
      return {
        kind: 'navigate',
        label: 'Edit assistant instructions',
        // Land on the experts list; the user picks the relevant expert from
        // there (we don't have a topic→expert mapping in v1).
        href: payload.expert_id
          ? `${basePath}/experts/${payload.expert_id}`
          : `${basePath}/experts?${params.toString()}`,
      };
    }
    default:
      return null;
  }
}

// Pick a small set of "recommended actions" for the detail view from a single
// conversation's eval + summary. The server already does this for cluster-level
// insights; on a single conversation we keep it client-side because it's a
// cheap rule-based read off the loaded eval array.
export function recommendActionsForConversation({ summary, evals }) {
  const out = [];
  if (!summary || !evals) return out;
  const byDim = Object.fromEntries(evals.map((e) => [e.dimension, e]));
  const score = (d) => byDim[d]?.score;
  const topic = summary.primary_topic || 'Other';

  if ((score('resolution') ?? 1) < 0.55) {
    out.push({
      action: 'connect_source',
      title: `Connect a ${topic} source`,
      reason: 'The assistant couldn\'t reach a confident answer — adding an authoritative source would help.',
      payload: { topic, suggested_source_kind: kindForTopic(topic) },
    });
  }
  if ((score('friction') ?? 0) > 0.55 || (score('sentiment') ?? 1) < 0.4) {
    out.push({
      action: 'edit_instructions',
      title: 'Edit assistant instructions',
      reason: 'Friction or sentiment suggests the assistant\'s tone or guidance needs tightening for this topic.',
      payload: { topic },
    });
  }
  if (summary.resolution_state === 'resolved' && summary.tool_call_count <= 1) {
    out.push({
      action: 'draft_faq',
      title: 'Draft an FAQ from this',
      reason: 'Answer landed quickly with little tooling — promoting it to an FAQ skips the LLM next time.',
      payload: { topic, question_seed: summary.summary?.split('"')[1] || '' },
    });
  }
  return out;
}

function kindForTopic(topic) {
  switch (topic) {
    case 'HR':            return 'hris';
    case 'Travel':        return 'policy_doc';
    case 'IT':            return 'itsm';
    case 'Compensation':  return 'hris';
    case 'Events':        return 'intranet_page';
    case 'Policy':        return 'policy_doc';
    case 'Operations':    return 'intranet_page';
    default:              return 'generic';
  }
}
