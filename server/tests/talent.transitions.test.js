/**
 * Pure-logic guarantees for the Talent Exchange status machines. No database —
 * these pin the transition rules every service depends on, and run everywhere.
 */

const transitions = require('../services/talent/transitions');
const { ApiError } = require('../services/talent/errors');

describe('talent transition guards', () => {
  test('allows a legal engagement path', () => {
    expect(() => transitions.assertEngagement('accepted', 'in_progress')).not.toThrow();
    expect(() => transitions.assertEngagement('in_progress', 'delivered')).not.toThrow();
    expect(() => transitions.assertEngagement('delivered', 'completed')).not.toThrow();
  });

  test('rejects skipping delivery', () => {
    expect(() => transitions.assertEngagement('in_progress', 'completed')).toThrow(ApiError);
  });

  test('rejects reviving a terminal state', () => {
    expect(() => transitions.assertEngagement('completed', 'in_progress')).toThrow(/Cannot move/);
    expect(() => transitions.assertApplication('accepted', 'pending')).toThrow(/Cannot move/);
    expect(() => transitions.assertOpportunity('cancelled', 'open')).toThrow(/Cannot move/);
  });

  test('unknown source status is a 422', () => {
    try {
      transitions.assertEngagement('nonsense', 'completed');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(422);
    }
  });

  test('opportunity can be published then closed but not double-closed', () => {
    expect(() => transitions.assertOpportunity('draft', 'open')).not.toThrow();
    expect(() => transitions.assertOpportunity('open', 'cancelled')).not.toThrow();
    expect(() => transitions.assertOpportunity('cancelled', 'cancelled')).toThrow();
  });
});
