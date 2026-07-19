import { Component, computed, input } from '@angular/core';

export type LoaderVariant = 'spinner' | 'skeleton' | 'bar';

@Component({
  selector: 'app-loader',
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
})
export class Loader {
  public readonly variant = input<LoaderVariant>('spinner');
  public readonly lines = input(3);

  protected readonly skeletonRows = computed<number[]>(() =>
    Array.from({ length: this.lines() }, (_, index) => index),
  );
}
