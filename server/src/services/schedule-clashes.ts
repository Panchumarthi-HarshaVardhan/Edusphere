export interface ScheduleSlotForClash {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sectionId: string;
  facultyId: string;
  roomNumber?: string | null;
}

export type ScheduleClashType = 'section' | 'faculty' | 'room';
export interface ScheduleClash { type: ScheduleClashType; slotId?: string }

function minutes(value: string): number {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

function overlaps(a: ScheduleSlotForClash, b: ScheduleSlotForClash): boolean {
  return a.dayOfWeek === b.dayOfWeek && minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime);
}

export function findScheduleClashes(candidate: ScheduleSlotForClash, existing: ScheduleSlotForClash[]): ScheduleClash[] {
  const clashes: ScheduleClash[] = [];
  for (const slot of existing) {
    if (candidate.id && candidate.id === slot.id) continue;
    if (!overlaps(candidate, slot)) continue;
    if (candidate.sectionId === slot.sectionId) clashes.push({ type: 'section', slotId: slot.id });
    if (candidate.facultyId === slot.facultyId) clashes.push({ type: 'faculty', slotId: slot.id });
    if (candidate.roomNumber?.trim() && slot.roomNumber?.trim() && candidate.roomNumber.trim().toLowerCase() === slot.roomNumber.trim().toLowerCase()) {
      clashes.push({ type: 'room', slotId: slot.id });
    }
  }
  return clashes;
}
