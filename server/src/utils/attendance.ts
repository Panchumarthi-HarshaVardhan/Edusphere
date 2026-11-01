import type { AttendanceStatus } from '@prisma/client';

/** Attendance policy: present earns full credit, late earns half, absent earns none. */
export function attendanceCredit(status: AttendanceStatus): number {
  if (status === 'PRESENT') return 1;
  if (status === 'LATE') return 0.5;
  return 0;
}

export function attendancePercentage(total: number, credits: number): number {
  return total > 0 ? Math.round((credits / total) * 1000) / 10 : 100;
}
