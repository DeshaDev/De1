import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UsageEventSchema, emptyUsageStore, recordUsageEvent, summarizeUsage, RETENTION_DAYS } from './usageMetrics';

describe('anonymous usage metrics', () => {
  const now = new Date('2026-10-28T12:00:00Z');

  it('counts events, distinct devices and per-game discontinue rates', () => {
    let store = emptyUsageStore();
    store = recordUsageEvent(store, { event: 'battery_started', device: 'a'.repeat(32) }, 'h1', now);
    store = recordUsageEvent(store, { event: 'battery_started', device: 'b'.repeat(32) }, 'h2', now);
    store = recordUsageEvent(store, { event: 'battery_completed', device: 'a'.repeat(32) }, 'h1', now);
    store = recordUsageEvent(store, { event: 'subtest_completed', device: 'a'.repeat(32), subtestId: 'rhyme', discontinued: true }, 'h1', now);
    store = recordUsageEvent(store, { event: 'subtest_completed', device: 'b'.repeat(32), subtestId: 'rhyme' }, 'h2', now);
    const s = summarizeUsage(store, 7, now);
    assert.equal(s.uniqueDevices, 2);
    assert.equal(s.totals.battery_started, 2);
    assert.equal(s.completionRate, 50);
    assert.deepEqual(s.subtests.find((x) => x.subtestId === 'rhyme'), { subtestId: 'rhyme', completed: 2, discontinuedRate: 50 });
    assert.equal(s.daily.length, 7);
    assert.equal(s.daily[6].date, '2026-10-28');
  });

  it('drops days older than the retention window', () => {
    let store = emptyUsageStore();
    const old = new Date(now.getTime() - (RETENTION_DAYS + 5) * 86_400_000);
    store = recordUsageEvent(store, { event: 'visit', device: 'c'.repeat(32) }, 'h3', old);
    store = recordUsageEvent(store, { event: 'visit', device: 'c'.repeat(32) }, 'h3', now);
    assert.equal(Object.keys(store.days).length, 1);
  });

  it('rejects events carrying anything beyond the allowed anonymous fields', () => {
    assert.equal(UsageEventSchema.safeParse({ event: 'visit', device: 'd'.repeat(32) }).success, true);
    assert.equal(UsageEventSchema.safeParse({ event: 'visit', device: 'd'.repeat(32), studentName: 'سارة' }).success, false);
    assert.equal(UsageEventSchema.safeParse({ event: 'unknown', device: 'd'.repeat(32) }).success, false);
    assert.equal(UsageEventSchema.safeParse({ event: 'visit', device: 'not a uuid!' }).success, false);
  });
});
