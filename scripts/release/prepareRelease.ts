// Prüft im CI, ob die Version aus package.json schon veröffentlicht ist, und erzeugt sonst die Release Notes.
// Ausgaben für GitHub Actions: should_release, version, tag, notes
// Usage: tsx scripts/release/prepareRelease.ts
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { isVersionTag, toReleaseNotes, type Commit } from './releaseNotes';

// Trennzeichen, die in Commit-Nachrichten praktisch nicht vorkommen
const FIELD_SEPARATOR = '\u001f';
const RECORD_SEPARATOR = '\u001e';

const repositoryUrl = `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY ?? 'luka-lta/druckwunsch'}`;

const version = loadPackageVersion();
const tag = `v${version}`;
const existingTags = loadVersionTags();

if (existingTags.includes(tag)) {
  console.log(`${tag} is already released. Bump the version in package.json to publish a new release.`);
  writeOutput('should_release', 'false');
  process.exit(0);
}

const previousTag = existingTags[0] ?? null;
const notes = toReleaseNotes(loadCommitsSince(previousTag), repositoryUrl, previousTag, tag);

console.log(`Releasing ${tag} (previous: ${previousTag ?? 'none'})\n\n${notes}`);
writeOutput('should_release', 'true');
writeOutput('version', version);
writeOutput('tag', tag);
writeOutput('notes', notes);

function loadPackageVersion(): string {
  const packageJson: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
  const value = (packageJson as { version?: unknown }).version;
  if (typeof value !== 'string' || !isVersionTag(`v${value}`)) {
    throw new Error(`Invalid version in package.json: ${String(value)}`);
  }
  return value;
}

/** Vorhandene Versions-Tags, neueste zuerst */
function loadVersionTags(): string[] {
  return git('tag', '--list', 'v*', '--sort=-v:refname')
    .split('\n')
    .map((line) => line.trim())
    .filter(isVersionTag);
}

function loadCommitsSince(previous: string | null): Commit[] {
  const range = previous === null ? 'HEAD' : `${previous}..HEAD`;
  const output = git('log', range, '--no-merges', `--format=%H${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%b${RECORD_SEPARATOR}`);
  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [sha = '', subject = '', body = ''] = record.split(FIELD_SEPARATOR);
      return { sha, subject, body };
    })
    .reverse();
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' });
}

// Mehrzeilige Werte brauchen in GITHUB_OUTPUT einen eindeutigen Begrenzer
function writeOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile === undefined) return;
  const delimiter = `EOF_${randomUUID()}`;
  appendFileSync(outputFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}
