import { useState } from 'react';
import { formatCard, isRedCard } from '../utils';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = [
  { key: 's', symbol: '♠', red: false },
  { key: 'h', symbol: '♥', red: true },
  { key: 'd', symbol: '♦', red: true },
  { key: 'c', symbol: '♣', red: false },
];

// usedCards: array of card strings already picked (to gray out)
// onSelect: (cardStr) => void
// onCancel: () => void
export default function CardPicker({ usedCards = [], onSelect, onCancel }) {
  const [rank, setRank] = useState(null);

  function handleRank(r) {
    setRank(r);
  }

  function handleSuit(s) {
    const card = rank + s;
    onSelect(card);
    setRank(null);
  }

  return (
    <div className="card-picker-overlay" onClick={onCancel}>
      <div className="card-picker-sheet" onClick={e => e.stopPropagation()}>
        <div className="card-picker-title">
          {rank ? `${rank} — pick suit` : 'Pick rank'}
        </div>

        {!rank ? (
          <div className="rank-grid">
            {RANKS.map(r => {
              // gray out if all 4 suits of this rank are used
              const usedCount = SUITS.filter(s => usedCards.includes(r + s.key)).length;
              const disabled = usedCount === 4;
              return (
                <button
                  key={r}
                  className={'pick-btn' + (disabled ? ' disabled' : '')}
                  onClick={() => !disabled && handleRank(r)}
                >
                  {r}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="suit-grid">
            {SUITS.map(s => {
              const card = rank + s.key;
              const disabled = usedCards.includes(card);
              return (
                <button
                  key={s.key}
                  className={'pick-btn' + (s.red ? ' red-suit' : '') + (disabled ? ' disabled' : '')}
                  onClick={() => !disabled && handleSuit(s.key)}
                >
                  {s.symbol}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button
            className="btn btn-secondary btn-full"
            onClick={rank ? () => setRank(null) : onCancel}
          >
            {rank ? '← Back to ranks' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

// A tappable card slot that opens CardPicker when tapped
// value: card string or null; onChange: (card) => void; usedCards: []
export function CardSlot({ value, onChange, usedCards = [], label }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={'card-display' + (value ? (isRedCard(value) ? ' red' : '') : ' placeholder')}
        onClick={() => setOpen(true)}
        title={label}
      >
        {value ? (
          <>
            <span>{value.slice(0, -1)}</span>
            <span style={{ fontSize: '0.75em' }}>
              {value.slice(-1) === 'h' ? '♥' : value.slice(-1) === 'd' ? '♦' : value.slice(-1) === 's' ? '♠' : '♣'}
            </span>
          </>
        ) : '+'}
      </button>
      {open && (
        <CardPicker
          usedCards={usedCards}
          onSelect={card => { onChange(card); setOpen(false); }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
