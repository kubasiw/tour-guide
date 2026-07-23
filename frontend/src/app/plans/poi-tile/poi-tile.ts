import { Component, computed, input, output, signal } from '@angular/core';
import { POI_TYPE_COLORS, POI_TYPE_ICONS, Poi } from '../../core/poi.model';
import { Loader } from '../../shared/loader/loader';

// Approximate character count that fits on 3 lines at this tile's font size —
// a length-based heuristic instead of measuring rendered DOM overflow (which
// would need a ResizeObserver per tile); deliberate, tunable, not rigorously
// derived, same precedent as this app's other small numeric thresholds
// (e.g. estimateReverseZoom's zoom-level bands).
const DESCRIPTION_EXPAND_THRESHOLD = 130;

@Component({
  selector: 'app-poi-tile',
  imports: [Loader],
  templateUrl: './poi-tile.html',
  styleUrl: './poi-tile.scss',
})
export class PoiTile {
  public readonly poi = input.required<Poi>();
  public readonly selected = input(false);
  public readonly hovered = input(false);
  // Separate from `poi().aiDescription` — the parent resolves this from
  // either the POI's own cached field or a freshly-generated override it
  // holds locally (the `candidates` resource itself isn't mutated in place
  // when a description is generated after the initial fetch).
  public readonly aiDescription = input<string | null>(null);
  // Whether to offer the "generate a description" action at all when no
  // description exists yet — bound by the parent to its own auth-cost-gating
  // check, so this dumb component never needs to inject AuthService itself.
  public readonly showDescriptionAction = input(false);
  public readonly descriptionLoading = input(false);
  public readonly toggled = output<void>();
  public readonly hoverChange = output<boolean>();
  public readonly descriptionRequested = output<void>();

  protected readonly icon = computed(() => POI_TYPE_ICONS[this.poi().type]);
  protected readonly colorClass = computed(() => POI_TYPE_COLORS[this.poi().type]);

  // Address and opening hours share one line under the name (not two) so
  // showing the address doesn't grow the tile's fixed height — joined with
  // " · " when both are present, whichever one exists otherwise.
  protected readonly metaLine = computed(() =>
    [this.poi().address, this.poi().openingHours].filter((part) => part).join(' · '),
  );

  protected readonly descriptionExpanded = signal(false);

  protected readonly descriptionIsLong = computed(
    () => (this.aiDescription()?.length ?? 0) > DESCRIPTION_EXPAND_THRESHOLD,
  );

  protected toggleDescriptionExpanded(): void {
    this.descriptionExpanded.update((expanded) => !expanded);
  }
}
