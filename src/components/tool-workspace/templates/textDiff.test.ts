import { describe, expect, it } from "vitest";
import { computeInlineSpans } from "./textDiff";

describe("inline text diff", () => {
  it("highlights the separate edits in the supplied long paragraph", () => {
    const prefix = `Avery Pennarun follows up his skeptical take on trendy tech with a bigger diagnosis. He lists a familiar malaise: the rich keep getting richer, artists go underpaid, cloud giants collect tolls like IBM and Microsoft once did, a laptop SSD runs rings around a default EC2 disk, software and governments bloat while delivering less, app stores take 30%, patching can install malware, and seven chat apps refuse to talk to each other. Capitalism, he says, has become a "success disaster." Seen through his networking-and-systems lens, societies, governments, economies, social networks and clouds are all distributed systems. Almost everyone misunderstands how those work, crypto fans most of all, though he never says the word. Markets are the best tool we've found for connecting companies, and centrally planning whole societies has failed bloodily, but working markets aren't "free." Left alone, they slide into monopolies. Regulation keeps any player from getting too powerful, provides safety nets like bankruptcy and insurance, and enforces contracts fairly rather than literally. That's a centralized job, meant to stop distributed systems from going awry, which they always do. Citing Jo Freeman's "The Tyranny of Structurelessness," he argues that any system without an explicit hierarchy grows an implicit one: prove your database has no single point of failure, then skip a few months of AWS bills. `;
    const oldText = prefix + `Instead of new math like a "Paxos for Capitalism," his fix is better-designed regulation: "decentralized bulk activity, hierarchical regulation."`;
    const newText = prefix + `His fix isn't new math, a "Paxos for Capitalism," or deregulation, but better-designed regulation: "decentralized bulk activity, hierarchical regulation."`;
    const { oldSpans, newSpans } = computeInlineSpans(oldText, newText);

    expect(oldSpans.filter(span => span.highlight).map(span => span.text))
      .toEqual(["Instead of", " like", "his fix is"]);
    expect(newSpans.filter(span => span.highlight).map(span => span.text))
      .toEqual(["His fix isn't", ",", "or deregulation, but"]);
    expect(oldSpans.map(span => span.text).join("")).toBe(oldText);
    expect(newSpans.map(span => span.text).join("")).toBe(newText);
  });

  it.each([
    ["unchanged", "unchanged", [], []],
    ["", "added", [], ["added"]],
    ["removed", "", ["removed"], []],
    ["one two three", "one three", [" two"], []],
    ["one three", "one two three", [], [" two"]],
    ["a  b", "a b", [" "], []],
    ["a\tb ", "a b  ", ["\t"], [" ", " "]],
    ["Hello, world!", "Hello world?", [",", "!"], ["?"]],
    ["café déjà vu 🙂", "café bientôt vu 🙃", ["déjà", "🙂"], ["bientôt", "🙃"]],
  ])("preserves text and isolates edits from %j to %j", (oldText, newText, oldChanges, newChanges) => {
    const { oldSpans, newSpans } = computeInlineSpans(oldText, newText);
    expect(oldSpans.map(span => span.text).join("")).toBe(oldText);
    expect(newSpans.map(span => span.text).join("")).toBe(newText);
    expect(oldSpans.filter(span => span.highlight).map(span => span.text)).toEqual(oldChanges);
    expect(newSpans.filter(span => span.highlight).map(span => span.text)).toEqual(newChanges);
  });

  it("bounds work on huge unrelated lines while preserving their shared ends", () => {
    const oldText = "start " + "old ".repeat(1100) + "end";
    const newText = "start " + "new ".repeat(1100) + "end";
    const { oldSpans, newSpans } = computeInlineSpans(oldText, newText);
    expect(oldSpans.map(span => span.text).join("")).toBe(oldText);
    expect(newSpans.map(span => span.text).join("")).toBe(newText);
    expect(oldSpans[0]).toEqual({ text: "start ", highlight: false });
    expect(newSpans[newSpans.length - 1]).toEqual({ text: " end", highlight: false });
  });
});
