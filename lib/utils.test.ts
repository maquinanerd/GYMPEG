import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('keeps a token color next to a design font size', () => {
    expect(cn('bg-primary text-primary-foreground', 'h-btn px-6 text-subtitle')).toBe(
      'bg-primary text-primary-foreground h-btn px-6 text-subtitle',
    );
    expect(cn('text-caption text-muted-foreground')).toBe('text-caption text-muted-foreground');
  });

  it('still lets a later size or color win', () => {
    expect(cn('text-caption', 'text-small')).toBe('text-small');
    expect(cn('text-muted-foreground', 'text-brand')).toBe('text-brand');
    expect(cn('text-sm', 'text-title')).toBe('text-title');
  });
});
