/**
 * Detects and extracts Llama-style inline tool-call syntax
 * (`<function=name>{...json args...}</function>`) that some models write
 * into their plain-text output instead of using the API's structured
 * tool_calls delta.
 *
 * Observed live (2026-07-28) across multiple Groq models — llama-3.3-70b-
 * versatile and openai/gpt-oss-20b both did it under repeated/corrective
 * prompting, so it isn't one model's quirk. Left unhandled, this raw syntax
 * streams straight to the student as if it were part of the reply.
 *
 * A streaming consumer feeds text deltas in one at a time via `push()` and
 * gets back `{ safeText, calls }`:
 *   - `safeText` is text confirmed NOT to be part of an inline call — safe
 *     to yield to the client immediately.
 *   - `calls` (an array — a single chunk can legitimately contain more than
 *     one complete call back-to-back) holds every `<function=name>{...}`
 *     fully scanned (JSON braces balanced) this push — `{ name, arguments }`
 *     each, arguments being the raw JSON string, same shape as a real
 *     provider tool call.
 *
 * Text belonging to an in-progress but not yet complete match is held back
 * (available via `pending()`) rather than yielded, so a match split across
 * two chunk boundaries is still caught. `flush()` at end-of-stream returns
 * any leftover safe text, discarding an incomplete match rather than
 * emitting broken syntax.
 */

const OPEN_RE = /<function=([a-zA-Z0-9_]+)>/;
const OPEN_LITERAL = '<function=';

// Whether `tail` (the buffer from its last '<' onward) could still grow into
// a complete "<function=name>" open tag. Two shapes are held back:
//   - still typing the fixed literal ("<fu", "<func", ...) — must be an exact
//     prefix of OPEN_LITERAL
//   - past the literal, into the variable-length name ("<function=create",
//     "<function=create_task", ...) — a fixed-size holdback window doesn't
//     work here since names vary in length, so this checks the actual
//     regex shape instead of a byte count.
function isPossibleOpenPrefix(tail) {
  if (tail.length <= OPEN_LITERAL.length) return OPEN_LITERAL.startsWith(tail);
  return /^<function=[a-zA-Z0-9_]*$/.test(tail);
}

/**
 * Finds the index of the closing brace that balances the first '{' in str,
 * respecting quoted strings and escapes so braces inside string values
 * don't miscount. Returns -1 if the object isn't complete yet.
 */
function findBalancedJsonEnd(str) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let started = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { depth++; started = true; continue; }
    if (ch === '}') {
      depth--;
      if (started && depth === 0) return i;
    }
  }
  return -1;
}

function createInlineToolCallScanner() {
  let buffer = '';
  let openCall = null; // { name } once "<function=name>" has matched

  function push(deltaText) {
    buffer += deltaText;
    let safeText = '';
    const calls = [];

    // Loops rather than a single if/if pair: a real streaming chunk can be
    // large enough to contain several complete transitions at once (a close
    // tag immediately followed by more prose and a second open+close pair).
    // Handling only one transition per push() left any later ones sitting
    // unscanned in the buffer — silently returned as-is, tags and all, by a
    // later flush() that only knew "no open call -> return the buffer
    // verbatim" without re-scanning it. Draining fully here means flush()
    // only ever needs to handle genuine leftovers, not missed matches.
    for (;;) {
      if (!openCall) {
        const m = OPEN_RE.exec(buffer);
        if (m) {
          safeText += buffer.slice(0, m.index);
          openCall = { name: m[1] };
          buffer = buffer.slice(m.index + m[0].length);
          continue; // buffer changed — re-check from the top
        }

        // No complete open tag yet. Hold back only from the last '<' that
        // could still grow into one — re-checked against the actual tag
        // shape (not a fixed byte count) so an arbitrarily long function
        // name doesn't get flushed as "safe" before its closing '>' arrives.
        const lastLt = buffer.lastIndexOf('<');
        if (lastLt === -1) {
          safeText += buffer;
          buffer = '';
        } else {
          const tail = buffer.slice(lastLt);
          if (isPossibleOpenPrefix(tail)) {
            safeText += buffer.slice(0, lastLt);
            buffer = tail;
          } else {
            safeText += buffer;
            buffer = '';
          }
        }
        break; // nothing more can be resolved without more input
      }

      const end = findBalancedJsonEnd(buffer);
      if (end === -1) break; // args not complete yet — wait for more input

      const argsText = buffer.slice(0, end + 1);
      const rest = buffer.slice(end + 1).replace(/^<\/function>/, '');
      calls.push({ name: openCall.name, arguments: argsText });
      openCall = null;
      buffer = rest;
      // loop again — `rest` may itself start with another open tag
    }

    return { safeText, calls };
  }

  function pending() {
    return openCall !== null;
  }

  function flush() {
    if (openCall) {
      // An inline call that never completed by end-of-stream — a genuine
      // leak/truncation, not recoverable as a real call. Discard rather
      // than show the raw fragment.
      openCall = null;
      buffer = '';
      return '';
    }
    const text = buffer;
    buffer = '';
    return text;
  }

  return { push, pending, flush };
}

module.exports = { createInlineToolCallScanner, findBalancedJsonEnd };
