import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface StepperStep {
  label: string;
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
}
