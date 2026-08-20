// Dax — DATAD's single AI identity.
//
// Every AI capability in the product is Dax wearing a different hat. There is
// no "the chatbot", no "the summarizer", no "the recommendation engine" — the
// student is always talking to the same intelligence. Naming lives here so it
// cannot drift back into a dozen different labels.
//
// Rule of thumb: if a student can read it, it says Dax. If it's a wire
// protocol, a model provider, or a database collection, it does not — see
// DAX_NAMING.md for why.

export const DAX = 'Dax';

// Capability names. Use these instead of inventing a label at the call site.
export const DAX_CAPABILITY = {
  chat:            'Dax Chat',
  insights:        'Dax Insights',
  resumeReview:    'Dax Resume Review',
  planner:         'Dax Planner',
  research:        'Dax Research',
  memory:          'Dax Memory',
  recommendations: 'Dax Recommendations',
  careerCoach:     'Dax Career Coach',
  notifications:   'Dax Notifications',
  summaries:       'Dax Summaries',
  pageGuide:       'Dax Guide',
};

// Voice: Dax speaks in first person, never refers to itself in the third
// person, and never announces that it is an AI — the badge already does that.
export const DAX_WELCOME =
  `Hi, I'm Dax — your academic companion.\n\nAsk me anything: study strategies, career advice, resume tips, or just "what should I focus on today?"`;

// Loading copy. One voice, one intelligence thinking — not N tools spinning.
export const DAX_THINKING = 'Dax is thinking…';
export const DAX_SEARCHING = 'Dax is searching…';

// Attribution on generated content. Dax is the author; the model underneath is
// provenance, shown but never presented as the identity.
export const daxAttribution = (provider) => (provider ? `${DAX} · ${provider}` : DAX);
