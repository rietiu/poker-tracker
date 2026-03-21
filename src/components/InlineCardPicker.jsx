import { useState, useRef, useEffect } from 'react';
import { isRedCard } from '../utils';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = [
  { key: 's', symbol: '♠', red: false },
  { key: 'h', symbol: '♥', red: true },
  { key: 'd', symbol: '♦', red: true },
  { key: 'c', symbol: '♣', red: false },
];

// Layout constants that match .suit-float-btn CSS (52px wide, 4px gap)
const SUIT_BTN_W = 52;
const SUIT_GAP = 4;
const SUIT_STRIDE = SUIT_BTN_W + SUIT_GAP; // 56px per slot
const OVERLAY_PAD = 10;
const OVERLAY_TOTAL_W = 4 * SUIT_BTN_W + 3 * SUIT_GAP + OVERLAY_PAD * 2; // 240px

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function CardSlotDisplay({ card, active, onClick }) {
  const red = card && isRedCard(card);
  return (
    <button
      className={`inline-card-slot${active ? ' active' : ''}${card ? (red ? ' filled red' : ' filled') : ' empty'}`}
      onClick={onClick}
    >
      {card ? (
        <>
          <span>{card.slice(0, -1)}</span>
          <span className="suit-sym">
            {card.slice(-1) === 'h' ? '♥' : card.slice(-1) === 'd' ? '♦' : card.slice(-1) === 's' ? '♠' : '♣'}
          </span>
        </>
      ) : (
        <span style={{ fontSize: '1.8rem', color: 'var(--text2)' }}>?</span>
      )}
    </button>
  );
}

// Props: cards=[c1,c2,...], onChange(newCards), usedCards=[]
export default function InlineCardPicker({ cards = [null, null], onChange, usedCards = [] }) {
  const [activeSlot, setActiveSlot] = useState(() => {
    const i = cards.findIndex(c => !c);
    return i === -1 ? 0 : i;
  });
  // Tap fallback: pendingRank shows the suit row
  const [pendingRank, setPendingRank] = useState(null);

  // Hold+drag gesture state (for re-render only)
  const [pressState, setPressState] = useState(null); // { rank, overlayLeft, overlayTop }
  const [hoveredSuit, setHoveredSuit] = useState(null);

  // Refs so event handlers don't go stale
  const pressRef      = useRef(null);
  const hoveredRef    = useRef(null);
  const cardsRef      = useRef(cards);
  const onChangeRef   = useRef(onChange);
  const activeSlotRef = useRef(activeSlot);
  const usedRef       = useRef([]);

  cardsRef.current    = cards;
  onChangeRef.current = onChange;
  activeSlotRef.current = activeSlot;

  const otherSlotCards = cards.filter((c, i) => c && i !== activeSlot);
  const effectiveUsed  = [...usedCards, ...otherSlotCards];
  usedRef.current      = effectiveUsed;

  // Document-level pointer handlers (attached only while pressing)
  useEffect(() => {
    function onMove(e) {
      const ps = pressRef.current;
      if (!ps) return;
      const px = e.clientX, py = e.clientY;

      let suit = null;
      // Activate when finger is above (or level with) the rank button
      if (py <= ps.originY + 16) {
        const relX = px - ps.overlayLeft - OVERLAY_PAD;
        if (relX >= 0 && relX < 4 * SUIT_STRIDE) {
          const idx = Math.min(3, Math.floor(relX / SUIT_STRIDE));
          const candidate = SUITS[idx].key;
          if (!usedRef.current.includes(ps.rank + candidate)) {
            suit = candidate;
          }
        }
      }

      if (suit !== hoveredRef.current) {
        hoveredRef.current = suit;
        setHoveredSuit(suit);
      }
    }

    function onUp() {
      const ps = pressRef.current;
      if (!ps) return;
      const suit = hoveredRef.current;
      if (suit) {
        doSelect(ps.rank, suit);
      } else {
        // No suit hit by drag → fall back to tap flow (show suit row)
        setPendingRank(ps.rank);
      }
      pressRef.current  = null;
      hoveredRef.current = null;
      setPressState(null);
      setHoveredSuit(null);
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, []); // stable — uses refs only

  function doSelect(rank, suit) {
    const card = rank + suit;
    const next = [...cardsRef.current];
    next[activeSlotRef.current] = card;
    onChangeRef.current(next);
    setPendingRank(null);
    const nextEmpty = next.findIndex(c => !c);
    if (nextEmpty !== -1) setActiveSlot(nextEmpty);
  }

  function startPress(e, rank) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const overlayLeft = clamp(originX - OVERLAY_TOTAL_W / 2, 8, window.innerWidth - OVERLAY_TOTAL_W - 8);
    const overlayTop  = Math.max(8, originY - 130); // float above the button

    const state = { rank, originX, originY, overlayLeft, overlayTop };
    pressRef.current   = state;
    hoveredRef.current = null;
    setPressState(state);
    setHoveredSuit(null);
    setPendingRank(null);
  }

  function handleSlotClick(idx) {
    if (cards[idx]) {
      const next = [...cards];
      next[idx] = null;
      onChange(next);
    }
    setActiveSlot(idx);
    setPendingRank(null);
  }

  // Tap-flow suit handler (suit grid shown after quick tap without drag)
  function handleSuitTap(s) {
    if (!pendingRank) return;
    doSelect(pendingRank, s);
  }

  return (
    <div className="inline-card-picker">
      {/* Card slots */}
      <div className="inline-card-slots">
        {cards.map((card, i) => (
          <CardSlotDisplay
            key={i}
            card={card}
            active={activeSlot === i && !pressState}
            onClick={() => handleSlotClick(i)}
          />
        ))}
      </div>

      {/* Rank grid — hold & drag up to pick suit */}
      {!pendingRank ? (
        <div className="rank-grid">
          {RANKS.map(r => {
            const allUsed = SUITS.every(s => effectiveUsed.includes(r + s.key));
            return (
              <button
                key={r}
                className={`pick-btn${allUsed ? ' disabled' : ''}${pressState?.rank === r ? ' selected' : ''}`}
                onPointerDown={e => !allUsed && startPress(e, r)}
                onContextMenu={e => e.preventDefault()}
                style={{ touchAction: 'none', userSelect: 'none' }}
              >
                {r}
              </button>
            );
          })}
        </div>
      ) : (
        /* Tap fallback: suit row */
        <div>
          <div className="text-muted text-sm" style={{ textAlign: 'center', marginBottom: 8 }}>
            {pendingRank} — tap a suit
          </div>
          <div className="suit-grid">
            {SUITS.map(s => {
              const disabled = effectiveUsed.includes(pendingRank + s.key);
              return (
                <button
                  key={s.key}
                  className={`pick-btn${s.red ? ' red-suit' : ''}${disabled ? ' disabled' : ''}`}
                  onClick={() => !disabled && handleSuitTap(s.key)}
                >
                  {s.symbol}
                </button>
              );
            })}
          </div>
          <button className="btn btn-secondary btn-full mt-12" onClick={() => setPendingRank(null)}>
            ← Back to ranks
          </button>
        </div>
      )}

      {/* Floating suit overlay — shown while holding a rank */}
      {pressState && (
        <div
          className="suit-float"
          style={{ left: pressState.overlayLeft, top: pressState.overlayTop }}
        >
          <div className="suit-float-rank">{pressState.rank}</div>
          <div className="suit-float-row">
            {SUITS.map(s => {
              const disabled = effectiveUsed.includes(pressState.rank + s.key);
              const hovered  = hoveredSuit === s.key;
              return (
                <div
                  key={s.key}
                  className={`suit-float-btn${s.red ? ' red-suit' : ''}${hovered ? ' hovered' : ''}${disabled ? ' suit-disabled' : ''}`}
                >
                  {s.symbol}
                </div>
              );
            })}
          </div>
          <div className="text-xs text-muted" style={{ textAlign: 'center' }}>
            {hoveredSuit
              ? `${SUITS.find(s => s.key === hoveredSuit)?.symbol} — release`
              : 'slide up to suit'}
          </div>
        </div>
      )}
    </div>
  );
}
