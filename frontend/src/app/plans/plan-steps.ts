import { StepperStep } from '../shared/stepper/stepper';
import { Plan } from './plan.model';

export function buildPlanSteps(
  plan: Plan | undefined,
  planId: string,
  current: 'activities' | 'trip-details',
): StepperStep[] {
  return [
    {
      label: 'Aktywności',
      routerLink: ['/plans', planId, 'activities'],
      completed: (plan?.activities.length ?? 0) > 0,
      current: current === 'activities',
    },
    {
      label: 'Termin',
      routerLink: ['/plans', planId, 'trip-details'],
      completed: plan?.durationDays != null,
      current: current === 'trip-details',
    },
  ];
}
