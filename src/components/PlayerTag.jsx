import { TAG_META } from '../utils';

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
  const tags = Object.keys(TAG_META);
  return (
    <div className="pill-group" style={{ flexWrap: 'wrap' }}>
      {tags.map(tag => {
        const meta = TAG_META[tag];
        const isSelected = selected.includes(tag);
        return (
          <button
            key={tag}
            className={'pill' + (isSelected ? ' selected' : '')}
            style={isSelected ? { background: meta.color, borderColor: meta.color } : {}}
            onClick={() => {
              if (isSelected) {
                onChange(selected.filter(t => t !== tag));
              } else {
                onChange([...selected, tag]);
              }
            }}
          >
            {meta.emoji} {meta.label}
          </button>
        );
      })}
    </div>
  );
}
