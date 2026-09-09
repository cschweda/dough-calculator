#!/usr/bin/env node
/**
 * Regenerates CHANGELOG.md from git history.
 *
 * Every tag becomes a section; every commit is listed under the tag that
 * contains it, with commits made since the newest tag collected under
 * "Unreleased". The file is derived data — to change what it says, change the
 * commit message, not this file.
 *
 * Usage:
 *   node scripts/changelog.mjs           write CHANGELOG.md
 *   node scripts/changelog.mjs --check   exit 1 if it is out of date
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const US = '\x1f'; // field separator
const RS = '\x1e'; // record separator

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

/** owner/repo for commit links, or null when the remote is not GitHub. */
function githubSlug() {
  let url;
  try {
    url = git('remote', 'get-url', 'origin');
  } catch {
    return null;
  }
  const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return m ? m[1] : null;
}

/** Commits in `range`, newest first. */
function commits(range) {
  const fmt = ['%H', '%h', '%ad', '%s'].join(US) + RS;
  // Merges included: the changelog is meant to list every commit, and this
  // repo's one merge commit carries a real subject line.
  const args = ['log', `--format=${fmt}`, '--date=short'];
  if (range) args.push(range);
  const out = git(...args);
  if (!out) return [];
  return out
    .split(RS)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [sha, short, date, subject] = r.split(US);
      return { sha, short, date, subject };
    });
}

/** Tags oldest-first, with the date of the commit each points at. */
function tags() {
  const out = git(
    'for-each-ref',
    '--sort=creatordate',
    `--format=%(refname:short)${US}%(creatordate:short)`,
    'refs/tags',
  );
  if (!out) return [];
  return out.split('\n').filter(Boolean).map((l) => {
    const [name, date] = l.split(US);
    return { name, date };
  });
}

function render() {
  const slug = githubSlug();
  const link = (c) =>
    slug ? `[\`${c.short}\`](https://github.com/${slug}/commit/${c.sha})` : `\`${c.short}\``;
  const line = (c) => `- ${link(c)} ${c.date} — ${c.subject}`;

  const all = tags();
  const sections = [];

  // Commits after the newest tag.
  const newest = all.length ? all[all.length - 1] : null;
  const unreleased = commits(newest ? `${newest.name}..HEAD` : null);
  if (unreleased.length) {
    sections.push(`## Unreleased\n\n${unreleased.map(line).join('\n')}`);
  }

  // Tag sections, newest first.
  for (let i = all.length - 1; i >= 0; i--) {
    const tag = all[i];
    const prev = i > 0 ? all[i - 1] : null;
    const range = prev ? `${prev.name}..${tag.name}` : tag.name;
    const list = commits(range);
    const heading = slug
      ? `## [${tag.name}](https://github.com/${slug}/releases/tag/${tag.name}) — ${tag.date}`
      : `## ${tag.name} — ${tag.date}`;
    sections.push(
      list.length ? `${heading}\n\n${list.map(line).join('\n')}` : `${heading}\n\n_No commits._`,
    );
  }

  if (!sections.length) sections.push('## Unreleased\n\n_No commits yet._');

  return [
    '# Changelog',
    '',
    'Every tag and every commit in this repository, newest first.',
    '',
    '**This file is generated** by `npm run changelog` from git history. Do not',
    'edit it by hand — your changes will be overwritten on the next run. To alter',
    'an entry, amend the commit message it came from.',
    '',
    sections.join('\n\n'),
    '',
  ].join('\n');
}

const text = render();
const checking = process.argv.includes('--check');

if (checking) {
  let current = '';
  try {
    current = readFileSync('CHANGELOG.md', 'utf8');
  } catch {}
  if (current !== text) {
    console.error('CHANGELOG.md is out of date. Run: npm run changelog');
    process.exit(1);
  }
  console.log('CHANGELOG.md is up to date.');
} else {
  writeFileSync('CHANGELOG.md', text);
  const n = (text.match(/^- /gm) || []).length;
  console.log(`CHANGELOG.md written — ${n} commits across ${tags().length} tag(s).`);
}
