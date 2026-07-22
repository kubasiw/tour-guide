import { StepperStep } from '../shared/stepper/stepper';
import { PLAN_STATUS_FINAL } from './plan-status';
import { Plan } from './plan.model';

export type PlanStage = 'setup' | 'details' | 'summary';

// Three macro stages of the whole plan journey (2026-07-22) — replaces the old
// micro-step breakdown (Obszar/Aktywności/Termin) that no longer exists since
// those three screens were merged into one `plan-setup/` view. This stepper
// now spans all three routed screens a plan passes through: `plan-setup`
// (area+activities+dates), `plan-detail`+`poi-picker` (picking places), and
// `plan-summary` (the finalized read-only view) — shown persistently under
// the header on all three, not just during initial creation.
export function buildPlanSteps(
  plan: Plan | undefined,
  id: string | undefined,
  current: PlanStage,
): StepperStep[] {
  const hasPlan = id !== undefined;
  const finalized = plan?.status === PLAN_STATUS_FINAL;

  return [
    {
      label: 'Planowanie',
      description: 'Zaznacz obszar, aktywności i termin pobytu.',
      routerLink: hasPlan ? ['/plans', id, 'setup'] : ['/'],
      // The setup stage is always freely revisitable (no cascading resets on
      // area/activity/date edits, same precedent as the old editable-Area
      // step) — "completed" just means a plan exists to go back to.
      completed: hasPlan,
      current: current === 'setup',
    },
    {
      label: 'Ustal szczegóły',
      description: 'Wybierz konkretne miejsca do swojego planu.',
      routerLink: hasPlan ? ['/plans', id] : ['/'],
      // Reads as "done" once the plan has actually been finalized — matches
      // the finalize action ("Zakończ planowanie") being what unlocks the
      // summary stage next, per the user's own framing of this stepper.
      completed: finalized,
      current: current === 'details',
    },
    {
      label: 'Twój plan',
      description: 'Zobacz gotowe podsumowanie planu.',
      routerLink: hasPlan ? ['/plans', id, 'summary'] : ['/'],
      // Nothing comes after this stage, so it's never shown as "completed" —
      // only ever a plain locked node or the current one.
      completed: false,
      current: current === 'summary',
    },
  ];
}
