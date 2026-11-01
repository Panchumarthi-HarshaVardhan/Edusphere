import test from 'node:test';
import assert from 'node:assert/strict';
import { findScheduleClashes, type ScheduleSlotForClash } from './schedule-clashes.js';

const base: ScheduleSlotForClash = {
  id: 'candidate', dayOfWeek: 1, startTime: '09:00', endTime: '10:00',
  sectionId: 'section-a', facultyId: 'faculty-a', roomNumber: 'R-1',
};

test('detects section, faculty and room clashes at the same time', () => {
  const existing = [{ ...base, id: 'existing' }];
  assert.deepEqual(findScheduleClashes(base, existing).map((clash) => clash.type), ['section', 'faculty', 'room']);
});

test('detects overlapping faculty, room and section schedules independently', () => {
  const existing: ScheduleSlotForClash[] = [
    { ...base, id: 'faculty', sectionId: 'section-b', roomNumber: 'R-2' },
    { ...base, id: 'room', facultyId: 'faculty-b', sectionId: 'section-b' },
    { ...base, id: 'section', facultyId: 'faculty-b', roomNumber: 'R-2' },
  ];
  assert.deepEqual(findScheduleClashes(base, existing).map((clash) => clash.type), ['faculty', 'room', 'section']);
});

test('allows adjacent, non-overlapping, and different-day classes', () => {
  const existing: ScheduleSlotForClash[] = [
    { ...base, id: 'adjacent', startTime: '10:00', endTime: '11:00' },
    { ...base, id: 'other-day', dayOfWeek: 2 },
  ];
  assert.deepEqual(findScheduleClashes(base, existing), []);
});

test('does not report the slot being updated as a clash', () => {
  assert.deepEqual(findScheduleClashes(base, [{ ...base }]), []);
});
