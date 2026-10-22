// Erzeugt die Release Notes aus den Commits seit dem letzten Release. Commits im Format der
// Conventional Commits (z.B. "feat(board): Sammeldruck", "fix: …") werden nach Art gruppiert.

export interface Commit {
  readonly sha: string;
  readonly subject: string;
  readonly body: string;
}

interface ParsedCommit {
  readonly commit: Commit;
  readonly type: string;
  readonly scope: string | null;
  readonly description: string;
  readonly isBreaking: boolean;
}

type SectionKey = 'breaking' | 'features' | 'fixes' | 'performance' | 'other';

const CONVENTIONAL_SUBJECT = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<description>.+)$/i;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE:/m;
const VERSION_TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;

/** Reine Versions-Commits ("chore(release): 1.2.3") gehören nicht in die Notes */
const RELEASE_COMMIT = /^chore\(release\)/i;

/** Abschnitte der Release Notes, in dieser Reihenfolge */
const SECTIONS: readonly { readonly key: SectionKey; readonly title: string }[] = [
  { key: 'breaking', title: '⚠️ Breaking Changes' },
  { key: 'features', title: '✨ Features' },
  { key: 'fixes', title: '🐛 Bug Fixes' },
  { key: 'performance', title: '⚡ Performance' },
  { key: 'other', title: '🔧 Other Changes' },
];

const SECTION_BY_TYPE: Readonly<Record<string, SectionKey>> = {
  feat: 'features',
  fix: 'fixes',
  perf: 'performance',
};

/** true für Tags wie "v1.2.3" */
export function isVersionTag(tag: string): boolean {
  return VERSION_TAG_PATTERN.test(tag.trim());
}

export function toReleaseNotes(
commits: readonly Commit[],
repositoryUrl: string,
previousTag: string | null,
tag: string,
): string {
  const parsed = commits.filter((commit) => !RELEASE_COMMIT.test(commit.subject)).map(parseCommit);
  const lines: string[] = [];

  for (const section of SECTIONS) {
    const entries = parsed.filter((commit) => toSectionKey(commit) === section.key);
    if (entries.length === 0) continue;
    lines.push(`### ${section.title}`, '');
    for (const entry of entries) lines.push(toNoteLine(entry, repositoryUrl));
    lines.push('');
  }

  if (lines.length === 0) lines.push('No changes besides the version bump.', '');

  const changelogUrl = previousTag === null
    ? `${repositoryUrl}/commits/${tag}`
    : `${repositoryUrl}/compare/${previousTag}...${tag}`;
  lines.push(`**Full changelog:** ${changelogUrl}`);
  return lines.join('\n');
}

function toSectionKey(commit: ParsedCommit): SectionKey {
  if (commit.isBreaking) return 'breaking';
  return SECTION_BY_TYPE[commit.type] ?? 'other';
}

function toNoteLine(commit: ParsedCommit, repositoryUrl: string): string {
  const scope = commit.scope === null ? '' : `**${commit.scope}:** `;
  const shortSha = commit.commit.sha.slice(0, 7);
  return `- ${scope}${commit.description} ([${shortSha}](${repositoryUrl}/commit/${commit.commit.sha}))`;
}

// Nicht konforme Commit-Nachrichten landen unter "Other Changes" statt verloren zu gehen
function parseCommit(commit: Commit): ParsedCommit {
  const match = CONVENTIONAL_SUBJECT.exec(commit.subject.trim());
  const isBreakingFooter = BREAKING_FOOTER.test(commit.body);
  if (match?.groups === undefined) {
    return { commit, type: 'other', scope: null, description: commit.subject.trim(), isBreaking: isBreakingFooter };
  }
  return {
    commit,
    type: (match.groups.type ?? 'other').toLowerCase(),
    scope: match.groups.scope ?? null,
    description: match.groups.description ?? commit.subject,
    isBreaking: match.groups.breaking === '!' || isBreakingFooter,
  };
}
