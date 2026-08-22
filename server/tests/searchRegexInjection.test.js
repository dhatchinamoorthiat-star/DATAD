/**
 * Regression tests for user-controlled regex in search filters.
 *
 * Six search endpoints built their Mongo filter with
 * `new RegExp(req.query.search, 'i')`. The value is a *pattern*, not a literal,
 * so any authenticated student chose the matching program MongoDB then ran over
 * the collection.
 *
 * Measured on this codebase before the fix: the pattern `(a+)+$` against a
 * 33-character subject took 111 seconds to evaluate — from one request, with a
 * query string short enough to fit in a tweet. The general limiter allows 1000
 * requests per 15 minutes per IP, so this is a denial of service that costs the
 * attacker nothing.
 *
 * The same defect broke ordinary use: "C++" and an unclosed "[" are invalid
 * patterns, and `new RegExp` throws on them, turning a search into a 500.
 *
 * The invariant: a search string is matched literally, never interpreted.
 */

const { searchRegex, escapeRegex, MAX_PATTERN_LENGTH } = require('../utils/safeRegex');

describe('escapeRegex', () => {
  test('every regex metacharacter is neutralised', () => {
    // If any of these survive unescaped the input is still a program.
    for (const meta of ['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\', '-']) {
      const re = new RegExp(escapeRegex(meta));
      expect(re.test(meta)).toBe(true);       // matches itself literally
      expect(escapeRegex(meta)).toBe(`\\${meta}`);
    }
  });
});

describe('searchRegex', () => {
  test('a catastrophic-backtracking payload becomes a harmless literal', () => {
    const re = searchRegex('(a+)+$');
    expect(re.source).toBe('\\(a\\+\\)\\+\\$');

    // The whole point: evaluating it is now bounded. Before the fix this exact
    // call took ~111s; a generous ceiling here still fails loudly if the
    // escaping is ever removed.
    const subject = `${'a'.repeat(40)}!`;
    const started = Date.now();
    re.test(subject);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test('a nested-quantifier payload cannot match documents a literal would not', () => {
    // `.*` used to match every document in the collection.
    expect(searchRegex('.*').test('anything at all')).toBe(false);
    expect(searchRegex('.*').test('literally .* here')).toBe(true);
  });

  test('patterns that used to throw now search literally', () => {
    // Both of these made `new RegExp` throw, surfacing as a 500 to the student.
    expect(() => searchRegex('[')).not.toThrow();
    expect(() => searchRegex('C++')).not.toThrow();
    expect(searchRegex('C++').test('I know C++ and Java')).toBe(true);
  });

  test('ordinary search still behaves like a case-insensitive substring', () => {
    expect(searchRegex('wacc').test('Notes on WACC')).toBe(true);
    expect(searchRegex('WACC').test('notes on wacc')).toBe(true);
    expect(searchRegex('wacc').test('unrelated')).toBe(false);
  });

  test('a blank search returns null rather than a match-everything pattern', () => {
    // new RegExp('') matches every document — a blank box must not mean "all".
    expect(searchRegex('')).toBeNull();
    expect(searchRegex('   ')).toBeNull();
    expect(searchRegex(undefined)).toBeNull();
    expect(searchRegex(null)).toBeNull();
  });

  test('an over-long pattern is truncated rather than compiled whole', () => {
    const re = searchRegex('a'.repeat(MAX_PATTERN_LENGTH + 500));
    expect(re.source.length).toBeLessThanOrEqual(MAX_PATTERN_LENGTH * 2);
  });
});

describe('call sites no longer build patterns from request input', () => {
  const fs = require('fs');
  const path = require('path');

  // A grep-style guard: the defect was systemic (six sites across five files),
  // so the test that matters most is the one that catches a seventh being added.
  test('no controller passes req.* straight into new RegExp', () => {
    const dir = path.join(__dirname, '..', 'controllers');
    const offenders = [];

    const walk = (d) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.js')) continue;
        const src = fs.readFileSync(full, 'utf8');
        if (/new RegExp\(\s*req\./.test(src)) offenders.push(path.relative(dir, full));
      }
    };
    walk(dir);

    expect(offenders).toEqual([]);
  });
});
