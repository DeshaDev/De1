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
