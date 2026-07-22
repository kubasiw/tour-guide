import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgbAlert, NgbCalendar, NgbDate, NgbInputDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { API_BASE_URL } from '../core/api-base-url';
import { extractErrorMessage } from '../core/http-error';
import { Plan } from '../plans/plan.model';
import { buildPlanSteps } from '../plans/plan-steps';
import { PlanService } from '../plans/plan.service';
import { AreaPreview } from '../shared/area-preview/area-preview';
import { Loader } from '../shared/loader/loader';
import { Stepper } from '../shared/stepper/stepper';

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatNgbDate(date: NgbDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function daysBetween(start: NgbDate, end: NgbDate): number {
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endUtc - startUtc) / 86_400_000);
}

@Component({
  selector: 'app-trip-details',
  imports: [NgbAlert, Loader, Stepper, AreaPreview, NgbInputDatepicker],
  templateUrl: './trip-details.html',
  styleUrl: './trip-details.scss',
})
export class TripDetails {
  public readonly id = input.required<string>();

  private readonly planService = inject(PlanService);
  private readonly router = inject(Router);
  private readonly calendar = inject(NgbCalendar);

  protected readonly plan = httpResource<Plan>(() => `${API_BASE_URL}/plans/${this.id()}`);

  protected readonly steps = computed(() =>
    buildPlanSteps(this.plan.value(), this.id(), 'trip-details'),
  );

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly rangeError = signal(false);
  protected readonly minDate = this.calendar.getToday();

  // Not a Reactive Form — this is a single transient date-range field, same
  // "no form needed for one field" precedent as area-picker's search box.
  // fromDate/toDate/hoveredDate drive a custom day template for range
  // highlighting (ng-bootstrap's own documented range-picker recipe).
  protected readonly fromDate = signal<NgbDate | null>(null);
  protected readonly toDate = signal<NgbDate | null>(null);
  protected readonly hoveredDate = signal<NgbDate | null>(null);

  protected readonly rangeDisplay = computed(() => {
    const from = this.fromDate();
    const to = this.toDate();
    if (!from) {
      return '';
    }
    return to ? `${formatNgbDate(from)}  →  ${formatNgbDate(to)}` : formatNgbDate(from);
  });

  public constructor() {
    effect(() => {
      const plan = this.plan.value();
      if (!plan?.startDate) {
        return;
      }

      const [year, month, day] = plan.startDate.slice(0, 10).split('-').map(Number);
      const startDate = new NgbDate(year, month, day);
      const endDate = this.calendar.getNext(startDate, 'd', plan.durationDays ?? 3);
      this.fromDate.set(startDate);
      this.toDate.set(endDate);
    });
  }

  protected onDateSelect(date: NgbDate, datepicker: NgbInputDatepicker): void {
    const from = this.fromDate();
    const to = this.toDate();

    if (!from || to) {
      this.fromDate.set(date);
      this.toDate.set(null);
    } else if (date.after(from)) {
      this.toDate.set(date);
      datepicker.close();
    } else {
      this.fromDate.set(date);
      this.toDate.set(null);
    }
  }

  protected isFrom(date: NgbDate): boolean {
    const from = this.fromDate();
    return from !== null && date.equals(from);
  }

  protected isTo(date: NgbDate): boolean {
    const to = this.toDate();
    return to !== null && date.equals(to);
  }

  protected isInRange(date: NgbDate): boolean {
    const from = this.fromDate();
    const to = this.toDate() ?? this.hoveredDate();
    return from !== null && to !== null && date.after(from) && date.before(to);
  }

  protected submit(): void {
    const from = this.fromDate();
    const to = this.toDate();

    if (!from || !to?.after(from)) {
      this.rangeError.set(true);
      return;
    }

    this.rangeError.set(false);
    this.submitting.set(true);
    this.errorMessage.set(null);

    const startDate = formatNgbDate(from);
    const durationDays = daysBetween(from, to);

    this.planService.update(this.id(), { startDate, durationDays }).subscribe({
      next: (plan) => {
        void this.router.navigate(['/plans', plan.id]);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      },
    });
  }
}
