import { TAG_META, toggleTag, selectableTags, LOOK_GROUPS, LOOK_META, toggleLook, lookKeysIn } from '../utils';

// Appearance chips, one row per group (nationality, age, …). Single choice
// within a group, except 穿戴 and 特徵 where items combine.
export function LookSelector({ selected = [], onChange }) {
  return (
    <div className="look-groups">
      {LOOK_GROUPS.map(g => (
        <div key={g.id} className="look-row">
          <span className="look-row-label">{g.label}</span>
          <div className="look-chips">
            {lookKeysIn(g.id).map(k => (
              <button
                key={k}
                type="button"
                className={'look-chip' + (selected.includes(k) ? ' selected' : '')}
                onClick={() => onChange(toggleLook(selected, k))}
              >
                {LOOK_META[k].label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PlayerTag({ tag }) {
  const meta = TAG_META[tag];
  if (!meta) return null;
  return (
    <span className="tag-chip" style={{ background: meta.color }}>
      {meta.emoji} {meta.label}
    </span>
  );
}

export function TagSelector({ selected = [], onChange }) {
  return (
    <div className="pill-group" style={{ flexWrap: 'wrap' }}>
      {selectableTags(selected).map(tag => {
        const meta = TAG_META[tag];
        const isSelected = selected.includes(tag);
        return (
          <button
            key={tag}
            className={'pill' + (isSelected ? ' selected' : '')}
            style={isSelected ? { background: meta.color, borderColor: meta.color } : {}}
            onClick={() => onChange(toggleTag(selected, tag))}
          >
            {meta.emoji} {meta.label}
          </button>
        );
      })}
    </div>
  );
}
