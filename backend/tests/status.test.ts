import { describe, expect, it } from 'vitest';
import { canEdit, canReview, canSubmit, isFinal, transition } from '../src/lib/status.js';

describe('report status state machine', () => {
  it('allows editing drafts and rejected reports only', () => {
    expect(canEdit('ENTWURF')).toBe(true);
    expect(canEdit('ABGELEHNT')).toBe(true);
    expect(canEdit('EINGEREICHT')).toBe(false);
    expect(canEdit('FREIGEGEBEN')).toBe(false);
  });

  it('allows submitting drafts and rejected reports', () => {
    expect(canSubmit('ENTWURF')).toBe(true);
    expect(canSubmit('ABGELEHNT')).toBe(true);
    expect(canSubmit('EINGEREICHT')).toBe(false);
    expect(canSubmit('FREIGEGEBEN')).toBe(false);
  });

  it('allows reviews for submitted reports only', () => {
    expect(canReview('EINGEREICHT')).toBe(true);
    expect(canReview('ENTWURF')).toBe(false);
    expect(canReview('ABGELEHNT')).toBe(false);
    expect(canReview('FREIGEGEBEN')).toBe(false);
  });

  it('performs the submit transition', () => {
    expect(transition('ENTWURF', 'submit')).toBe('EINGEREICHT');
    expect(transition('ABGELEHNT', 'submit')).toBe('EINGEREICHT');
    expect(transition('EINGEREICHT', 'submit')).toBeNull();
    expect(transition('FREIGEGEBEN', 'submit')).toBeNull();
  });

  it('performs the review transitions', () => {
    expect(transition('EINGEREICHT', 'approve')).toBe('FREIGEGEBEN');
    expect(transition('EINGEREICHT', 'reject')).toBe('ABGELEHNT');
    expect(transition('ENTWURF', 'approve')).toBeNull();
    expect(transition('ABGELEHNT', 'reject')).toBeNull();
  });

  it('marks approved reports as final', () => {
    expect(isFinal('FREIGEGEBEN')).toBe(true);
    expect(isFinal('EINGEREICHT')).toBe(false);
  });
});
