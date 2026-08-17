/**
 * Dax stock insights must explain, never recommend.
 *
 * The prompt forbids directive language; these tests cover the code-level
 * check that the model actually complied, because "the model was told not to"
 * is not a control. See services/stockInsightService.js.
 */
const { findViolation, rangePositionOf } = require('../services/stockInsightService');

const clean = {
  whatTheNumberSays: 'The price sits near the bottom of where it has traded over the past year. That is a fact about the last twelve months, not a statement about what happens next.',
  whyItMightBeHere: 'IT services companies have seen slower deal signings, and the recent headlines point to weaker discretionary spending from US clients.',
  sectorContext: 'Several other IT names are in a similar position, so this looks sector-wide rather than company-specific.',
  whatToReadNext: [
    'The last two quarterly results, specifically revenue growth and deal wins',
    'Whether management commentary explains the slowdown',
    'How peers in the same sector have reported',
  ],
  conceptToLearn: { term: '52-week range', explanation: 'The highest and lowest price a stock has traded at over the past year.' },
};

const withText = (field, text) => ({ ...clean, [field]: text });

describe('findViolation', () => {
  it('passes an explanation that stays descriptive', () => {
    expect(findViolation(clean)).toBeNull();
  });

  it.each([
    ['a buy call', 'This looks like a good time to buy.'],
    ['a sell call', 'Students should sell before results.'],
    ['a hold call', 'The sensible move is to hold for now.'],
    ['accumulation advice', 'Investors could accumulate at these levels.'],
    ['profit booking', 'It may be wise to book profits here.'],
    ['a valuation verdict', 'The stock is clearly undervalued at this price.'],
    ['an overvaluation verdict', 'It looks overvalued versus its peers.'],
    ['a price target', 'The price target for the year is ₹4000.'],
    ['fair value', 'Its fair value is closer to ₹3000.'],
    ['bargain framing', 'This is a bargain compared to last year.'],
    ['entry framing', 'This is a good entry for a long-term investor.'],
    ['exit framing', 'Consider an exit if results disappoint.'],
  ])('rejects %s', (_label, text) => {
    expect(findViolation(withText('whatTheNumberSays', text))).not.toBeNull();
  });

  it('checks every field, not just the first', () => {
    expect(findViolation(withText('sectorContext', 'The whole sector looks undervalued.'))).not.toBeNull();
    expect(findViolation({ ...clean, whatToReadNext: ['Whether to buy before results'] })).not.toBeNull();
    expect(
      findViolation({ ...clean, conceptToLearn: { term: 'Entry point', explanation: 'When to buy a stock.' } })
    ).not.toBeNull();
  });

  it('does not trip on legitimate finance vocabulary', () => {
    // These words contain forbidden substrings but are ordinary explanation.
    expect(findViolation(withText('whyItMightBeHere', 'The company announced a share buyback last quarter.'))).toBeNull();
    expect(findViolation(withText('sectorContext', 'It operates through a holding company structure.'))).toBeNull();
  });
});

describe('rangePositionOf', () => {
  it('reports position as a percentage of the yearly range', () => {
    expect(rangePositionOf({ price: 100, low52: 100, high52: 200 })).toBe(0);
    expect(rangePositionOf({ price: 200, low52: 100, high52: 200 })).toBe(100);
    expect(rangePositionOf({ price: 150, low52: 100, high52: 200 })).toBe(50);
    expect(rangePositionOf({ price: 125, low52: 100, high52: 200 })).toBe(25);
  });

  it('falls back to the midpoint when the range is degenerate', () => {
    // A brand-new listing can have low52 === high52; dividing by zero here
    // would put NaN into the prompt.
    expect(rangePositionOf({ price: 100, low52: 100, high52: 100 })).toBe(50);
  });
});
