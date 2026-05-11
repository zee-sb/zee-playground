import React from 'react';

// Chat-bubble-flavoured markdown renderer config for react-markdown.
// Overrides default block elements so the assistant's `**bold**`, lists,
// headings, and code render tightly inside a bubble without giant margins.
export const markdownComponents = {
  p:      ({ node, ...props }) => <p {...props} style={{ margin: 0, marginBottom: 6 }} />,
  ul:     ({ node, ...props }) => <ul {...props} style={{ margin: '4px 0', paddingLeft: 18 }} />,
  ol:     ({ node, ...props }) => <ol {...props} style={{ margin: '4px 0', paddingLeft: 18 }} />,
  li:     ({ node, ...props }) => <li {...props} style={{ marginBottom: 2 }} />,
  h1:     ({ node, ...props }) => <div {...props} style={{ fontWeight: 700, fontSize: 15, margin: '6px 0 4px' }} />,
  h2:     ({ node, ...props }) => <div {...props} style={{ fontWeight: 700, fontSize: 14, margin: '6px 0 4px' }} />,
  h3:     ({ node, ...props }) => <div {...props} style={{ fontWeight: 700, fontSize: 13, margin: '6px 0 4px' }} />,
  strong: ({ node, ...props }) => <strong {...props} style={{ fontWeight: 700, color: '#111827' }} />,
  em:     ({ node, ...props }) => <em {...props} style={{ fontStyle: 'italic' }} />,
  a:      ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: '#7C3AED', textDecoration: 'underline' }} />,
  code:   ({ node, inline, ...props }) => inline
    ? <code {...props} style={{ background: '#F3F4F6', color: '#7C3AED', padding: '1px 5px', borderRadius: 4, fontSize: '0.92em', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }} />
    : <code {...props} style={{ display: 'block', background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '8px 10px', borderRadius: 8, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, monospace', whiteSpace: 'pre-wrap', margin: '6px 0' }} />,
  blockquote: ({ node, ...props }) => <blockquote {...props} style={{ margin: '4px 0', paddingLeft: 10, borderLeft: '3px solid #DDD6FE', color: '#4B5563' }} />,
};
