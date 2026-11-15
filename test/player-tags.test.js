import { describe, it, expect } from 'vitest';
import { TAG_META, toggleTag, selectableTags } from '../src/utils';

describe('toggleTag', () => {
  it('adds and removes a tag', () => {
    expect(toggleTag([], 'sticky')).toEqual(['sticky']);
    expect(toggleTag(['sticky'], 'sticky')).toEqual([]);
  });

  it('picking one side of a pair drops the opposite', () => {
    expect(toggleTag(['defWeak', 'sticky'], 'defStrong')).toEqual(['sticky', 'defStrong']);
    expect(toggleTag(['rangeWide'], 'rangeNarrow')).toEqual(['rangeNarrow']);
  });

  it('different groups combine', () => {
    expect(toggleTag(['defStrong', 'atkWeak'], 'rangeWide')).toEqual(['defStrong', 'atkWeak', 'rangeWide']);
  });

  it('leaves legacy tags alone', () => {
    expect(toggleTag(['fish'], 'atkStrong')).toEqual(['fish', 'atkStrong']);
  });
});

describe('selectableTags', () => {
  it('offers only current tags by default', () => {
    const tags = selectableTags([]);
    expect(tags).toEqual(['defStrong', 'defWeak', 'atkStrong', 'atkWeak', 'rangeWide', 'rangeNarrow', 'sticky',
      'likes3b', 'raiseOnly', 'ep3b', 'trapper', 'reverse', 'rarelyPlays']);
    expect(tags.every(t => !TAG_META[t].legacy)).toBe(true);
  });

  it('keeps a selected legacy tag so it can be removed', () => {
    expect(selectableTags(['rock'])).toContain('rock');
    expect(selectableTags(['rock'])).not.toContain('fish');
  });
});
