import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Area } from '../../core/area.model';

@Component({
  selector: 'app-area-summary',
  imports: [DecimalPipe],
  templateUrl: './area-summary.html',
})
export class AreaSummary {
  public readonly area = input.required<Area>();
}
