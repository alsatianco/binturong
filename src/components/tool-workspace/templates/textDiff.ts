export type InlineSpan = { text: string; highlight: boolean };
type Token = { whitespace: string; text: string };

// Keep words (including contractions) intact, and compare punctuation separately.
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /(\s*)([\p{L}\p{N}\p{M}_]+(?:['’][\p{L}\p{N}\p{M}_]+)*|[^\s])/gu;
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    tokens.push({ whitespace: match[1], text: match[2] });
    end = match.index + match[0].length;
  }
  if (end < text.length) tokens.push({ whitespace: text.slice(end), text: "" });
  return tokens;
}

/** Find separate word/punctuation changes while preserving every input character. */
export function computeInlineSpans(oldText: string, newText: string) {
  const oldSpans: InlineSpan[] = [];
  const newSpans: InlineSpan[] = [];
  const append = (spans: InlineSpan[], text: string, highlight: boolean) => {
    if (!text) return;
    const previous = spans[spans.length - 1];
    if (previous?.highlight === highlight) previous.text += text;
    else spans.push({ text, highlight });
  };

  // Shared boundary spaces stay light; spaces inside a changed phrase stay dark.
  const appendChange = (oldPart: string, newPart: string) => {
    let prefix = 0;
    while (prefix < oldPart.length && prefix < newPart.length &&
      oldPart[prefix] === newPart[prefix] && /\s/.test(oldPart[prefix])) prefix++;
    let suffix = 0;
    while (suffix < oldPart.length - prefix && suffix < newPart.length - prefix &&
      oldPart[oldPart.length - suffix - 1] === newPart[newPart.length - suffix - 1] &&
      /\s/.test(oldPart[oldPart.length - suffix - 1])) suffix++;

    append(oldSpans, oldPart.slice(0, prefix), false);
    append(newSpans, newPart.slice(0, prefix), false);
    append(oldSpans, oldPart.slice(prefix, oldPart.length - suffix), true);
    append(newSpans, newPart.slice(prefix, newPart.length - suffix), true);
    append(oldSpans, oldPart.slice(oldPart.length - suffix), false);
    append(newSpans, newPart.slice(newPart.length - suffix), false);
  };
  const appendMatch = (oldToken: Token, newToken: Token) => {
    appendChange(oldToken.whitespace, newToken.whitespace);
    append(oldSpans, oldToken.text, false);
    append(newSpans, newToken.text, false);
  };
  const join = (tokens: Token[]) => tokens.map(token => token.whitespace + token.text).join("");
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);
  const identical = (a: Token, b: Token) => a.text === b.text && a.whitespace === b.whitespace;

  // Trim shared content before allocating the LCS table, including long paragraphs.
  let prefix = 0;
  while (prefix < oldTokens.length && prefix < newTokens.length &&
    identical(oldTokens[prefix], newTokens[prefix])) {
    appendMatch(oldTokens[prefix], newTokens[prefix]);
    prefix++;
  }
  let oldEnd = oldTokens.length;
  let newEnd = newTokens.length;
  while (oldEnd > prefix && newEnd > prefix &&
    identical(oldTokens[oldEnd - 1], newTokens[newEnd - 1])) {
    oldEnd--;
    newEnd--;
  }

  const oldLength = oldEnd - prefix;
  const newLength = newEnd - prefix;
  const width = newLength + 1;
  // Bound memory/work for exceptionally large, unrelated lines.
  if (oldLength === 0 || newLength === 0 || (oldLength + 1) * width > 1_000_000) {
    appendChange(join(oldTokens.slice(prefix, oldEnd)), join(newTokens.slice(prefix, newEnd)));
  } else {
    const lcs = new Uint32Array((oldLength + 1) * width);
    for (let i = oldLength - 1; i >= 0; i--) {
      for (let j = newLength - 1; j >= 0; j--) {
        lcs[i * width + j] = oldTokens[prefix + i].text === newTokens[prefix + j].text
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    let removed = "";
    let added = "";
    while (i < oldLength || j < newLength) {
      const oldToken = oldTokens[prefix + i];
      const newToken = newTokens[prefix + j];
      if (i < oldLength && j < newLength && oldToken.text === newToken.text) {
        appendChange(removed, added);
        removed = "";
        added = "";
        appendMatch(oldToken, newToken);
        i++;
        j++;
      } else if (i < oldLength && (j === newLength ||
        lcs[(i + 1) * width + j] >= lcs[i * width + j + 1])) {
        removed += oldToken.whitespace + oldToken.text;
        i++;
      } else {
        added += newToken.whitespace + newToken.text;
        j++;
      }
    }
    appendChange(removed, added);
  }

  while (oldEnd < oldTokens.length && newEnd < newTokens.length) {
    appendMatch(oldTokens[oldEnd++], newTokens[newEnd++]);
  }
  return { oldSpans, newSpans };
}
