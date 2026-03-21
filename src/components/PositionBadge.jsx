import { POSITION_COLORS } from '../utils';

export default function PositionBadge({ position }) {
  if (!position) return null;
  const color = POSITION_COLORS[position] || '#adb5bd';
  return (
    <span className="position-badge" style={{ background: color }}>
      {position}
    </span>
  );
}
