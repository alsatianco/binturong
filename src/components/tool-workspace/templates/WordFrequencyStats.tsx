export type WordFrequencyStatsView = {
  words: number;
  characters: number;
  sentences: number;
  paragraphs: number;
  spaces: number;
  readingLevel: { method: "ARI"; grade: number | null };
  readingTime: { wordsPerMinute: number; seconds: number };
  speakingTime: { wordsPerMinute: number; seconds: number };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isDuration(value: unknown): value is WordFrequencyStatsView["readingTime"] {
  return isRecord(value) && isCount(value.seconds)
    && isCount(value.wordsPerMinute) && value.wordsPerMinute > 0;
}

export function parseWordFrequencyStats(value: unknown): WordFrequencyStatsView | null {
  if (!isRecord(value)
    || !isCount(value.words) || !isCount(value.characters)
    || !isCount(value.sentences) || !isCount(value.paragraphs) || !isCount(value.spaces)
    || !isRecord(value.readingLevel) || value.readingLevel.method !== "ARI"
    || !(value.readingLevel.grade === null
      || (typeof value.readingLevel.grade === "number"
        && Number.isFinite(value.readingLevel.grade) && value.readingLevel.grade >= 0))
    || !isDuration(value.readingTime) || !isDuration(value.speakingTime)) {
    return null;
  }
  return {
    words: value.words,
    characters: value.characters,
    sentences: value.sentences,
    paragraphs: value.paragraphs,
    spaces: value.spaces,
    readingLevel: { method: "ARI", grade: value.readingLevel.grade as number | null },
    readingTime: value.readingTime,
    speakingTime: value.speakingTime,
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toLocaleString()} min${remainder > 0 ? ` ${remainder} sec` : ""}`;
}

export function WordFrequencyStats({ stats }: { stats: WordFrequencyStatsView }) {
  const counts = [
    ["Words", stats.words],
    ["Characters", stats.characters],
    ["Sentences", stats.sentences],
    ["Paragraphs", stats.paragraphs],
    ["Spaces", stats.spaces],
  ] as const;
  const grade = stats.readingLevel.grade;
  const estimates = [
    {
      label: "Reading level",
      value: grade === null ? "Unavailable" : grade < 1 ? "Below grade 1" : `Grade ${grade.toFixed(1)}`,
      note: grade === null ? "English text with letters required" : "Estimated U.S. grade · ARI",
    },
    {
      label: "Reading time",
      value: formatDuration(stats.readingTime.seconds),
      note: `Estimated at ${stats.readingTime.wordsPerMinute} words/min`,
    },
    {
      label: "Speaking time",
      value: formatDuration(stats.speakingTime.seconds),
      note: `Estimated at ${stats.speakingTime.wordsPerMinute} words/min`,
    },
  ];

  return (
    <section aria-label="Text overview" className="rounded-lg border theme-border theme-surface p-4 text-[var(--text-primary)]">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
        <h2 className="text-sm font-semibold">Text overview</h2>
        <span className="text-xs theme-text-muted">Based on the full text</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {counts.map(([label, value], index) => (
          <div key={label} className={`min-w-0 rounded-md px-3 py-2 ${index === 0 ? "theme-accent-soft" : "theme-surface-elevated"}`}>
            <dt className="text-xs theme-text-muted">{label}</dt>
            <dd className={`mt-1 text-2xl font-semibold tabular-nums break-all ${index === 0 ? "theme-accent-text" : ""}`}>
              {value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="mt-4 grid gap-3 border-t theme-border pt-3 sm:grid-cols-3">
        {estimates.map(({ label, value, note }) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs theme-text-muted">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
            <dd className="mt-0.5 text-xs theme-text-muted">{note}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-3 text-xs theme-text-muted">
        <summary className="w-fit cursor-pointer rounded py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
          How these stats are calculated
        </summary>
        <div className="mt-2 max-w-prose space-y-2 leading-relaxed">
          <p>Words are sequences of letters or numbers, including apostrophes within words. Characters include spaces, punctuation, and line breaks, counted as Unicode code points. Spaces count the space character only, excluding tabs and line breaks.</p>
          <p>Sentences are estimated from periods, question marks, exclamation marks, and paragraph breaks; abbreviations and decimals may affect the count. Paragraphs are separated by blank lines. A single line break stays within the same paragraph.</p>
          <p>Reading level uses the Automated Readability Index (ARI), based on letters and digits per word and words per sentence. It estimates the U.S. school grade for English text; short samples may be less reliable. Text containing non-ASCII letters is not scored, and language is not automatically detected.</p>
          <p>Reading and speaking times use the full word count, rounded up to the nearest second. Actual pace varies.</p>
        </div>
      </details>
    </section>
  );
}
