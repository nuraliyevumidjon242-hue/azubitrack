import type { ReportStatus } from './types.js';

/**
 * Report status state machine:
 *
 *   ENTWURF ──submit──▶ EINGEREICHT ──approve──▶ FREIGEGEBEN
 *                             │
 *                             └──reject──▶ ABGELEHNT ──edit/submit──▶ EINGEREICHT
 *
 * FREIGEGEBEN is terminal. A rejected report can be edited and resubmitted.
 */

export const EDITABLE_STATUSES: ReportStatus[] = ['ENTWURF', 'ABGELEHNT'];
export const SUBMITTABLE_STATUSES: ReportStatus[] = ['ENTWURF', 'ABGELEHNT'];

export function canEdit(status: ReportStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function canSubmit(status: ReportStatus): boolean {
  return SUBMITTABLE_STATUSES.includes(status);
}

export function canReview(status: ReportStatus): boolean {
  return status === 'EINGEREICHT';
}

export function isFinal(status: ReportStatus): boolean {
  return status === 'FREIGEGEBEN';
}

/** Returns the target status or null when the transition is not allowed. */
export function transition(
  current: ReportStatus,
  action: 'submit' | 'approve' | 'reject',
): ReportStatus | null {
  if (action === 'submit') {
    return canSubmit(current) ? 'EINGEREICHT' : null;
  }
  if (!canReview(current)) return null;
  return action === 'approve' ? 'FREIGEGEBEN' : 'ABGELEHNT';
}
