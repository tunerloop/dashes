// imports.js: the TunerLoop app's own (web app 1.4.194), written by its scripts/dash_tools.mjs. Don't edit.
// The import specifiers in a module's text, for the dash loader (loader.js): static imports,
// re-exports (`export ... from`) and import() of a string literal, with where each specifier's text
// sits so the loader can rewrite exactly it. A small lexer, one pass, so no input can make it slow
// (a regular expression here once took 42 s on 360 KB of crafted text): it skips comments, strings,
// template literals (their ${} parts are code) and regular expressions, so an import written inside
// any of those is not one. Pure: also run by the unit tests.

const REGEX_AFTER = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const isWord = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_' || c === '$' || c > '\x7f';
const isSpace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v' || c === ' ' || c === '﻿';

// [{ spec, at, end }]: code.slice(at, end) === spec, the text between the quotes.
export function scanImports(code) {
  const out = [], braces = [], n = code.length;
  let i = 0, prev = null;   // prev: the last token ('word:<w>', 'str', 'num' or the punctuation itself)
  let st = null;            // an import or export being read: { k: 'import'|'export'|'dyn', n: tokens since, from }

  // Past a quoted string starting at i; stops at a line end if it isn't closed.
  const skipString = (q) => { let j = i + 1; while (j < n && code[j] !== q && code[j] !== '\n') j += code[j] === '\\' ? 2 : 1; return Math.min(j, n); };
  // A template from i (just past a ` or a ${...}'s closing brace) to its end or its next ${.
  function template() {
    while (i < n) {
      const c = code[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; return; }
      if (c === '$' && code[i + 1] === '{') { i += 2; braces.push('${'); return; }
      i++;
    }
  }
  const regexAllowed = () => prev === null || (prev.startsWith('word:') ? REGEX_AFTER.has(prev.slice(5)) : !['str', 'num', ')', ']', '}'].includes(prev));

  while (i < n) {
    const c = code[i];
    if (isSpace(c)) { i++; continue; }
    if (c === '/' && code[i + 1] === '/') { while (i < n && code[i] !== '\n') i++; continue; }
    if (c === '/' && code[i + 1] === '*') { const e = code.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") {
      const e = skipString(c);
      if (st && (st.k === 'dyn' || (st.k === 'import' && st.n === 0) || st.from)) out.push({ spec: code.slice(i + 1, e), at: i + 1, end: e });
      st = null; prev = 'str'; i = e + 1; continue;
    }
    if (c === '`') { i++; template(); st = null; prev = 'str'; continue; }
    if (c === '/' && regexAllowed()) {
      let j = i + 1, cls = false;
      while (j < n && code[j] !== '\n' && (cls || code[j] !== '/')) { if (code[j] === '\\') j++; else if (code[j] === '[') cls = true; else if (code[j] === ']') cls = false; j++; }
      i = j + 1; while (i < n && isWord(code[i])) i++;   // its flags
      st = null; prev = 'str'; continue;
    }
    if (isWord(c)) {
      let j = i + 1;
      while (j < n && isWord(code[j])) j++;
      const w = code.slice(i, j), afterDot = prev === '.';
      if (c >= '0' && c <= '9') { st = null; prev = 'num'; i = j; continue; }
      if ((w === 'import' || w === 'export') && !afterDot) st = { k: w, n: 0, from: false };
      else if (st && st.k !== 'dyn') { st.from = w === 'from' && st.n > 0; st.n++; }
      else st = null;
      prev = `word:${w}`; i = j; continue;
    }
    // Punctuation: an import clause takes { } * , and import( starts a dynamic import.
    if (c === '{') braces.push('{');
    if (c === '}') { if (braces.pop() === '${') { i++; template(); st = null; prev = 'str'; continue; } }
    if (st && c === '(' && st.k === 'import' && st.n === 0) st = { k: 'dyn' };
    else if (st && st.k !== 'dyn' && (c === '{' || c === '}' || c === '*' || c === ',')) { st.from = false; st.n++; }
    else st = null;
    prev = c; i++;
  }
  return out;
}
