import { describe, expect, it } from 'vitest';
import { isVersionTag, toReleaseNotes, type Commit } from './releaseNotes';

const REPOSITORY_URL = 'https://github.com/example/druckwunsch';

let nextSha = 1;

function commit(subject: string, body = ''): Commit {
  const sha = String(nextSha++).padStart(40, 'a');
  return { sha, subject, body };
}

describe('isVersionTag', () => {
  it.each([['v0.4.1'], ['v10.0.12']])('shouldAccept %j', (tag) => {
    expect(isVersionTag(tag)).toBe(true);
  });

  it.each([['0.4.1'], ['v1.2'], ['v1.2.3-beta'], ['latest'], ['']])('shouldReject %j', (tag) => {
    expect(isVersionTag(tag)).toBe(false);
  });
});

describe('toReleaseNotes', () => {
  it('shouldGroupCommitsBySectionWithLinks', () => {
    const feature = commit('feat(board): Sammeldruck vorschlagen');
    const fix = commit('fix: Statistik-Farben');
    const chore = commit('chore: Abhängigkeiten');
    const breaking = commit('feat!: neue Konfiguration');

    const notes = toReleaseNotes([feature, fix, chore, breaking], REPOSITORY_URL, 'v0.4.1', 'v1.0.0');

    expect(notes).toBe([
      '### ⚠️ Breaking Changes',
      '',
      `- neue Konfiguration ([${breaking.sha.slice(0, 7)}](${REPOSITORY_URL}/commit/${breaking.sha}))`,
      '',
      '### ✨ Features',
      '',
      `- **board:** Sammeldruck vorschlagen ([${feature.sha.slice(0, 7)}](${REPOSITORY_URL}/commit/${feature.sha}))`,
      '',
      '### 🐛 Bug Fixes',
      '',
      `- Statistik-Farben ([${fix.sha.slice(0, 7)}](${REPOSITORY_URL}/commit/${fix.sha}))`,
      '',
      '### 🔧 Other Changes',
      '',
      `- Abhängigkeiten ([${chore.sha.slice(0, 7)}](${REPOSITORY_URL}/commit/${chore.sha}))`,
      '',
      `**Full changelog:** ${REPOSITORY_URL}/compare/v0.4.1...v1.0.0`,
    ].join('\n'));
  });

  it('shouldKeepNonConventionalCommitsUnderOtherChanges', () => {
    const notes = toReleaseNotes([commit('Update README.md')], REPOSITORY_URL, null, 'v0.1.0');

    expect(notes).toContain('### 🔧 Other Changes');
    expect(notes).toContain('- Update README.md');
    expect(notes).toContain(`${REPOSITORY_URL}/commits/v0.1.0`);
  });

  it('shouldLeaveOutVersionBumpCommits', () => {
    const notes = toReleaseNotes([commit('chore(release): 0.4.2')], REPOSITORY_URL, 'v0.4.1', 'v0.4.2');

    expect(notes).not.toContain('0.4.2 (');
    expect(notes).toContain('No changes besides the version bump.');
  });

  it('shouldTreatBreakingChangeFooterAsBreaking', () => {
    const notes = toReleaseNotes([commit('feat: x', 'BREAKING CHANGE: Config umbenannt')], REPOSITORY_URL, null, 'v1.0.0');

    expect(notes.startsWith('### ⚠️ Breaking Changes')).toBe(true);
  });
});
