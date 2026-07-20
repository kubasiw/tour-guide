import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { extractErrorMessage } from '../../core/http-error';
import { Poi } from '../../core/poi.model';
import { Loader } from '../../shared/loader/loader';
import { PlanService } from '../plan.service';
import { PoiTile } from '../poi-tile/poi-tile';

@Component({
  selector: 'app-poi-picker',
  imports: [PoiTile, Loader, NgbAlert],
  templateUrl: './poi-picker.html',
})
export class PoiPicker {
  public readonly planId = input.required<string>();

  private readonly planService = inject(PlanService);

  protected readonly candidates = rxResource({
    params: () => this.planId(),
    stream: ({ params: id }) => this.planService.getCandidates(id),
  });

  protected readonly items = rxResource({
    params: () => this.planId(),
    stream: ({ params: id }) => this.planService.getItems(id),
  });

  protected readonly toggleError = signal<string | null>(null);

  protected readonly selectedPoiIds = computed(
    () => new Set((this.items.value() ?? []).map((item) => item.poi.id)),
  );

  protected isSelected(poi: Poi): boolean {
    return this.selectedPoiIds().has(poi.id);
  }

  protected toggle(poi: Poi): void {
    this.toggleError.set(null);

    if (this.isSelected(poi)) {
      const item = this.items.value()?.find((existing) => existing.poi.id === poi.id);
      if (!item) {
        return;
      }
      this.planService.removeItem(this.planId(), item.id).subscribe({
        next: () => this.items.reload(),
        error: (err: unknown) => this.toggleError.set(extractErrorMessage(err)),
      });
    } else {
      this.planService.addItem(this.planId(), poi.id).subscribe({
        next: () => this.items.reload(),
        error: (err: unknown) => this.toggleError.set(extractErrorMessage(err)),
      });
    }
  }
}
