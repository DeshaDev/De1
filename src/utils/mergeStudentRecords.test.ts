import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStudentRecords } from './mergeStudentRecords';
import type { StudentRecord } from '../data/seedData';

const battery = (updatedAt: string, tasks: number) => ({
  ageMonths: 80, examinerName: '', startedAt: updatedAt, updatedAt, summary: null,
  results: Object.fromEntries(Array.from({ length: tasks }, (_, i) => [`t${i}`, {}])),
});

test('a cloud copy without the screening never erases the one kept on this device', () => {
  const local = [{ id: 'c1', name: 'سارة', cognitiveBattery: battery('2026-11-19T10:00:00Z', 3) }] as unknown as StudentRecord[];
  const cloud = [{ id: 'c1', name: 'سارة أحمد', cognitiveBattery: null }] as unknown as StudentRecord[];
  const [merged] = mergeStudentRecords(local, cloud);
  assert.equal(merged.name, 'سارة أحمد', 'profile fields come from the incoming copy');
  assert.equal(Object.keys(merged.cognitiveBattery!.results).length, 3);
});

test('the newer screening wins, and children only on one side are kept', () => {
  const local = [
    { id: 'c1', name: 'a', cognitiveBattery: battery('2026-11-18T10:00:00Z', 5) },
    { id: 'c2', name: 'b' },
  ] as unknown as StudentRecord[];
  const cloud = [{ id: 'c1', name: 'a', cognitiveBattery: battery('2026-11-19T10:00:00Z', 2) }] as unknown as StudentRecord[];
  const merged = mergeStudentRecords(local, cloud);
  assert.equal(merged[0].cognitiveBattery!.updatedAt, '2026-11-19T10:00:00Z');
  assert.deepEqual(merged.map((s) => s.id), ['c1', 'c2']);
});
