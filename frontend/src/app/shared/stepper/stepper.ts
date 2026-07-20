import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface StepperStep {
  label: string;
  description: string;
  routerLink: string[];
  completed: boolean;
  current: boolean;
}

@Component({
  selector: 'app-stepper',
  imports: [RouterLink],
  templateUrl: './stepper.html',
  styleUrl: './stepper.scss',
})
export class Stepper {
  public readonly steps = input.required<StepperStep[]>();

  protected readonly currentDescription = computed(
    () => this.steps().find((step) => step.current)?.description,
  );
}
