import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mascot, MascotMoment, type MascotMood } from './Mascot';
import { MASCOT_LINES } from './mascotLines';

const MOODS: MascotMood[] = ['wave', 'cheer', 'support', 'proud', 'calm'];

describe('mascot «هُدهُد»', () => {
  it('draws every mood, decorative by default and named when it stands alone', () => {
    for (const mood of MOODS) {
      const svg = renderToStaticMarkup(<Mascot mood={mood} />);
      assert.match(svg, new RegExp(`data-mascot="${mood}"`));
      assert.match(svg, /aria-hidden="true"/);
    }
    assert.match(renderToStaticMarkup(<Mascot label="هُدهُد" />), /role="img"[^>]*aria-label="هُدهُد"/);
  });

  it('two mascots on one page do not share clip-path ids', () => {
    const html = renderToStaticMarkup(<div><Mascot /><Mascot /></div>);
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('the speech bubble is announced politely and the entrance does not loop', () => {
    const html = renderToStaticMarkup(<MascotMoment mood="cheer" message="رائع!" />);
    assert.match(html, /role="status"/);
    const css = fs.readFileSync('src/index.css', 'utf8');
    const pop = css.slice(css.indexOf('.mascot-pop {'), css.indexOf('}', css.indexOf('.mascot-pop {')));
    assert.doesNotMatch(pop, /infinite/);
    const bounce = css.slice(css.indexOf('.animate-bounce-gentle {'), css.indexOf('}', css.indexOf('.animate-bounce-gentle {')));
    assert.doesNotMatch(bounce, /infinite/, 'the old looping bounce is gone everywhere');
  });

  it('every line is Arabic, short, and praises effort rather than ability', () => {
    const lines: string[] = [];
    for (const v of Object.values(MASCOT_LINES)) {
      if (typeof v === 'string') lines.push(v);
      else if (Array.isArray(v)) lines.push(...v);
      else lines.push((v as (s: string) => string)('لعبة'));
    }
    for (const line of lines) {
      assert.match(line, /[ء-ي]/, line);
      assert.doesNotMatch(line, /[A-Za-z]/, line);
      assert.ok(line.length <= 80, `too long for a child: ${line}`);
      assert.doesNotMatch(line, /ذكي|عبقري/, `ability praise: ${line}`);
    }
  });
});

describe('calm reading canvas', () => {
  // Screens where the child reads, listens to an item or answers: no looping motion there.
  const TASK_SCREENS = [
    'src/components/profile/TaskPlayers.tsx',
    'src/components/profile/ReadingPlayers.tsx',
    'src/components/profile/TeachingPlayers.tsx',
    'src/components/reader/FocusReader.tsx',
  ];
  const LOOPING = /animate-(bounce|pulse|ping|spin|wave-bar|crowded-jitter|focus-beam)\b/;

  it('task screens have no looping animation', () => {
    for (const file of TASK_SCREENS) {
      const src = fs.readFileSync(file, 'utf8');
      const hit = src.split('\n').find((line) => LOOPING.test(line));
      assert.equal(hit, undefined, `${file}: ${hit?.trim()}`);
    }
  });

  it('in the item players the mascot only reacts in practice, after an answer', () => {
    const src = fs.readFileSync('src/components/profile/TaskPlayers.tsx', 'utf8');
    for (const use of src.matchAll(/<PracticeReaction[^>]*>/g)) assert.match(use[0], /correct=/);
    assert.ok([...src.matchAll(/\{showFeedback && <PracticeReaction/g)].length >= 2, 'reactions are gated on practice feedback');
  });
});

describe('joyful layer: joyful edges, calm centre', async () => {
  const { KidPageHeader, HeroScene, LetterBlock, JoyCorners, WaveDivider } = await import('./Playful');

  it('decoration is marked decorative and hidden while a child plays and in print', () => {
    const css = fs.readFileSync('src/index.css', 'utf8');
    assert.match(css, /\.baseera-reading-focus \.joy-decor \{ display: none !important; \}/);
    assert.match(css, /@media print \{ \.joy-decor \{ display: none !important; \} \}/);
    for (const el of [<LetterBlock letter="ب" />, <JoyCorners />, <WaveDivider />]) {
      assert.match(renderToStaticMarkup(el), /aria-hidden="true"/);
    }
    assert.match(renderToStaticMarkup(<JoyCorners />), /joy-decor/);
  });

  it('page headers keep their text off the decoration and expose a real heading', () => {
    const html = renderToStaticMarkup(<KidPageHeader title="العنوان" subtitle="وصف" />);
    assert.match(html, /<h1[^>]*>العنوان<\/h1>/);
    assert.match(html, /joy-decor/);
  });

  it('the hero scene speaks through a note, with the mascot drawn once', () => {
    const html = renderToStaticMarkup(<HeroScene message="مرحبًا" />);
    assert.match(html, /role="note"/);
    assert.equal((html.match(/data-mascot=/g) ?? []).length, 1);
  });

  it('no looping animation anywhere in the joyful layer', () => {
    const src = fs.readFileSync('src/components/ui/Playful.tsx', 'utf8');
    assert.doesNotMatch(src, /animate-(bounce|pulse|ping|spin)/);
    const css = fs.readFileSync('src/index.css', 'utf8');
    const joy = css.slice(css.indexOf('Joyful layer: joyful edges, calm centre.'));
    assert.doesNotMatch(joy, /infinite/);
  });
});
