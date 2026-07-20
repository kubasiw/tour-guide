import { StepperStep } from '../shared/stepper/stepper';
import { Plan } from './plan.model';

export function buildPlanSteps(
  plan: Plan | undefined,
  planId: string,
  current: 'area' | 'activities' | 'trip-details',
): StepperStep[] {
  return [
    {
      label: 'Obszar',
      description: 'Zaznacz obszar na mapie.',
      routerLink: ['/plans', planId, 'area'],
      completed: plan !== undefined,
      current: current === 'area',
    },
    {
      label: 'Aktywności',
      description: 'Zaznacz, co Cię interesuje w tej okolicy.',
      routerLink: ['/plans', planId, 'activities'],
      completed: (plan?.activities.length ?? 0) > 0,
      current: current === 'activities',
    },
    {
      label: 'Termin',
      description: 'Podaj kiedy przyjeżdżasz i na jak długo.',
      routerLink: ['/plans', planId, 'trip-details'],
      completed: plan?.durationDays != null,
      current: current === 'trip-details',
    },
  ];
}
