/**
 * Dax's map of DATAD must match DATAD.
 *
 * The map exists in two copies — ai/appKnowledge.js (CommonJS, for the live
 * chat prompt) and client/src/dax/appKnowledge.js (ESM, for the maintenance
 * replies) — because the server cannot require an ES module. That is the same
 * boundary client/src/utils/pricing.js sits on, and it is tested the same way:
 * the client file is parsed as text and compared against the server's copy.
 *
 * What makes drift here expensive: a stale route is not a wrong answer that
 * looks wrong. Dax says "your expenses are under /finance/tracker" in a
 * confident, specific voice, the student clicks, and lands on a 404. Every
 * other answer in the conversation is now suspect.
 *
 * No database, no network, no model.
 */

const fs = require('fs');
const path = require('path');

const { APP_SECTIONS, APP_PAGES, formatAppKnowledge } = require('../ai/appKnowledge');
const serverPricing = require('../subscription/pricing');
const { CHAT_QUOTAS } = require('../subscription/subscriptionService');

const clientDir = path.join(__dirname, '..', '..', 'client', 'src');
const read = (...p) => fs.readFileSync(path.join(clientDir, ...p), 'utf8');

const clientKnowledgeSrc = read('dax', 'appKnowledge.js');
const workspacesSrc = read('utils', 'workspaces.js');
const appSrc = read('App.jsx');

/**
 * The client's SECTIONS, as {label, route, subs:[{label, route}]}.
 *
 * Parsed rather than imported: this suite is CommonJS and that file is ESM.
 * Sections are split on the `key:` property, which only section objects carry.
 */
function parseClientSections() {
  const block = /export const SECTIONS = \[([\s\S]*?)\n\];/.exec(clientKnowledgeSrc)[1];
  return block
    .split(/\n\s*\{\s*\n\s*key:/)
    .slice(1)
    .map((chunk) => {
      const label = /label:\s*'([^']+)'/.exec(chunk)[1];
      const route = /route:\s*'([^']+)'/.exec(chunk)[1];
      // Everything after the `subs:` marker — the sub objects are the only
      // label/route pairs left in the chunk by that point.
      const subsBlock = chunk.slice(chunk.indexOf('subs:'));
      const subs = [...subsBlock.matchAll(
        /\{\s*label:\s*'([^']+)',\s*route:\s*'([^']+)'/g
      )].map((m) => ({ label: m[1], route: m[2] }));
      return { label, route, subs };
    });
}

const clientSections = parseClientSections();

describe('the server map mirrors the client map', () => {
  it('has the same nine sections, in the same order', () => {
    expect(APP_SECTIONS.map((s) => s.label)).toEqual(clientSections.map((s) => s.label));
    expect(APP_SECTIONS).toHaveLength(9);
  });

  it('points every section at the same route', () => {
    for (const [i, section] of APP_SECTIONS.entries()) {
      expect(section.route).toBe(clientSections[i].route);
    }
  });

  it('lists the same sub-pages, with the same routes', () => {
    for (const [i, section] of APP_SECTIONS.entries()) {
      expect(section.subs).toEqual(clientSections[i].subs);
    }
  });

  it('lists the same standalone pages', () => {
    // Scoped to the EXTRA_PAGES block: sub-pages carry `aliases` too now, so
    // matching on the shape alone swept the whole file up.
    const block = /export const EXTRA_PAGES = \[([\s\S]*?)\n\];/.exec(clientKnowledgeSrc)[1];
    const clientPages = [...block.matchAll(
      /\{\s*label:\s*'([^']+)',\s*route:\s*'([^']+)'/g
    )].map((m) => ({ label: m[1], route: m[2] }));
    expect(APP_PAGES.map((p) => ({ label: p.label, route: p.route }))).toEqual(clientPages);
  });
});

describe('the map matches the app it describes', () => {
  it('names the same nine sections the primary nav does', () => {
    // WORKSPACES is what actually renders as the rail and the tab bar, so it is
    // the definition of "a section". Dax claiming a tenth, or missing one, is
    // the drift this catches. Dax's own entry carries a query string (?home)
    // that is a destination detail, not part of the route.
    const nav = [...workspacesSrc.matchAll(/key:\s*'[\w-]+',\s*label:\s*'([^']+)',\s*to:\s*'([^']+)'/g)]
      .map((m) => ({ label: m[1], route: m[2].split('?')[0] }));

    expect(nav).toHaveLength(9);
    expect(APP_SECTIONS.map((s) => ({ label: s.label, route: s.route }))).toEqual(nav);
  });

  it('points at no route the router cannot serve', () => {
    // An approximation, and deliberately so: App.jsx nests child routes as
    // relative segments (`path="notes"` inside `path="/study"`), so a full-path
    // string match is impossible without reimplementing the router. Asserting
    // the parent and the final segment both exist as declared paths catches the
    // realistic failure — a page renamed, moved, or deleted out from under the
    // map — without pretending to be a real route resolution.
    const declared = new Set([...appSrc.matchAll(/path="([^"]+)"/g)].map((m) => m[1]));
    const routes = [
      ...APP_SECTIONS.map((s) => s.route),
      ...APP_SECTIONS.flatMap((s) => s.subs.map((sub) => sub.route)),
      ...APP_PAGES.map((p) => p.route),
    ];

    for (const route of routes) {
      const segments = route.split('/').filter(Boolean);
      const parent = `/${segments[0]}`;
      // "/" is served by HomeGate; every section route has at least one segment.
      expect(declared.has(parent) || declared.has(`${parent}/*`)).toBe(true);
      if (segments.length > 1) {
        expect(declared.has(segments.slice(1).join('/'))).toBe(true);
      }
    }
  });
});

describe('the prompt block Dax is handed', () => {
  const block = formatAppKnowledge();

  it('contains every route a student could be sent to', () => {
    for (const section of APP_SECTIONS) {
      expect(block).toContain(section.route);
      for (const sub of section.subs) expect(block).toContain(sub.route);
    }
  });

  it('quotes the prices the payment route will actually charge', () => {
    // Derived, not typed — but a refactor could still sever the derivation, and
    // a confidently wrong price is the single most damaging thing Dax can say.
    expect(block).toContain(`₹${serverPricing.priceFor('pro', 'monthly')}/month`);
    expect(block).toContain(`₹${serverPricing.priceFor('pro', 'yearly')}/year`);
    expect(block).toContain(`₹${serverPricing.priceFor('placement', 'onetime')} one-time`);
    expect(block).toContain(`${serverPricing.durationMonthsFor('placement', 'onetime')} months`);
  });

  it('quotes the chat quotas the server enforces', () => {
    for (const tier of ['free', 'trial', 'pro', 'placement']) {
      expect(block).toContain(`${CHAT_QUOTAS[tier]} messages/day`);
    }
  });

  it('forbids inventing routes, and keeps billing out of Dax\'s hands', () => {
    // Both rules are load-bearing: a hallucinated path 404s the student, and
    // Dax has no access to anyone's billing, so it must not appear to.
    expect(block).toMatch(/NEVER invent a page, route, feature or plan/);
    expect(block).toContain('/support');
    expect(block).toContain('/subscribe');
  });

  it('stays small enough to ride on every turn', () => {
    // Appended to each chat turn's system prompt, on top of memory, profile and
    // RAG context — so this is real per-turn cost, currently ~1060 tokens at ~4
    // chars/token. The ceiling is a budget, not a hard limit: it is here so that
    // growing it is a deliberate decision with a failing test behind it, rather
    // than something that silently doubles every prompt.
    //
    // Raised from 3600 when full page coverage landed. The cheap savings were
    // taken first — the seven read-once pages (About, Creator, Brand, PSW,
    // Developer, Privacy, Terms) collapse to one line of label+route instead of
    // a blurb each. What is left is the section map itself, which is the entire
    // point: dropping sub-page routes to save tokens would bring back the
    // hallucinated paths this exists to prevent.
    expect(block.length).toBeLessThan(4400);
  });
});
