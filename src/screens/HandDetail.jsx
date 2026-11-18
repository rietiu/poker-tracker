import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, del } from '../db';
import { formatMoney, isRedCard, handNet, heroInvested, formatGame, formatWhen } from '../utils';
import { isMtt, handBlinds, chipSym, currentLevel, levelLabel, formatStacks } from '../mtt';
import PositionBadge from '../components/PositionBadge';
import { cleanOpponentCards, showdownHandNames } from '../showdown';
import { generateHandText, hasShowdownData } from '../share';

const SHOWDOWN_PREF_KEY = 'pt.shareShowdown';


// ── Sub-components ───────────────────────────────────────────────────────────
function CardBadge({ card, large }) {
  if (!card) return null;
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const suitSym = suit === 'h' ? '♥' : suit === 'd' ? '♦' : suit === 's' ? '♠' : '♣';
  const red = suit === 'h' || suit === 'd';
  return (
    <span
      className={'card-display' + (red ? ' red' : '') + (large ? '' : ' sm')}
      style={{ cursor: 'default', margin: '2px' }}
    >
      <span>{rank}</span>
      <span style={{ fontSize: large ? '0.8em' : '0.65em' }}>{suitSym}</span>
    </span>
  );
}

function StreetRow({ label, street, cards, sym }) {
  if (!street && !cards) return null;
  const { pot, myAction, myAmount, notes } = street || {};
  const s = sym || '$';
  return (
    <div className="card">
      <div className="street-header">{label}</div>
      {cards && (
        <div className="row gap-8 mb-8">
          {cards.map((c, i) => <CardBadge key={i} card={c} large />)}
        </div>
      )}
      {pot > 0 && <div className="text-sm"><span className="text-muted">Pot: </span>{s}{Number(pot).toLocaleString()}</div>}
      {myAction && (
        <div className="text-sm mt-8">
          <span className="text-muted">My action: </span>
          <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{myAction}</span>
          {myAmount ? ` ${s}${Number(myAmount).toLocaleString()}` : ''}
        </div>
      )}
      {notes && <div className="text-sm mt-8 text-muted">{notes}</div>}
    </div>
  );
}

// ── ExportSheet ──────────────────────────────────────────────────────────────
function ExportSheet({ hand, session, onClose }) {
  const [lang, setLang] = useState('en');
  const [copied, setCopied] = useState(false);
  const showdownAvailable = hasShowdownData(hand);
  const [includeShowdown, setIncludeShowdown] = useState(() => {
    try { return localStorage.getItem(SHOWDOWN_PREF_KEY) !== '0'; } catch { return true; }
  });
  const text = generateHandText(hand, session, lang, { includeShowdown: !showdownAvailable || includeShowdown });

  function toggleShowdown(on) {
    setIncludeShowdown(on);
    try { localStorage.setItem(SHOWDOWN_PREF_KEY, on ? '1' : '0'); } catch { /* private mode */ }
  }

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {}
    } else {
      handleCopy();
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh' }}>
        <div className="sheet-header">
          <h2>Export Hand</h2>
          <button className="back-btn" style={{ minHeight: 'auto', paddingRight: 0 }} onClick={onClose}>✕</button>
        </div>

        <div className="pill-group mb-12">
          <button className={'pill' + (lang === 'en' ? ' selected' : '')} onClick={() => setLang('en')}>English</button>
          <button className={'pill' + (lang === 'zh' ? ' selected' : '')} onClick={() => setLang('zh')}>中文</button>
        </div>

        {showdownAvailable && (
          <label className="row gap-8 mb-12 text-sm" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={includeShowdown} onChange={e => toggleShowdown(e.target.checked)} />
            <span>包含攤牌（對手手牌＋牌型）</span>
          </label>
        )}

        <textarea
          className="export-textarea"
          value={text}
          readOnly
          onFocus={e => e.target.select()}
        />

        <div className="row gap-8 mt-12">
          <button className="btn btn-primary flex-1" onClick={handleCopy}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
          {typeof navigator.share === 'function' && (
            <button className="btn btn-secondary flex-1" onClick={handleShare}>
              Share
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function HandDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hand, setHand] = useState(null);
  const [session, setSession] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    get('hands', id).then(h => {
      setHand(h);
      if (h?.sessionId) get('sessions', h.sessionId).then(setSession);
    });
  }, [id]);

  if (!hand) return <div className="screen"><div className="text-muted">Loading…</div></div>;

  const sym = chipSym(session);
  const { outcome, amount } = hand.result || {};

  function resultText() {
    if (outcome === 'folded') return { text: 'Folded', cls: 'result-fold' };
    if (outcome === 'won') return { text: `Won +${sym}${Number(amount).toLocaleString()}`, cls: 'result-won' };
    if (outcome === 'lost') return { text: `Lost -${sym}${Math.abs(Number(amount)).toLocaleString()}`, cls: 'result-lost' };
    if (outcome === 'split') return { text: `Split ±${sym}${Number(amount).toLocaleString()}`, cls: 'result-split' };
    return { text: '', cls: '' };
  }

  const res = resultText();
  const blinds = handBlinds(session, hand);
  const trueNet = handNet(hand, blinds);
  const invested = heroInvested(hand, blinds.sb, blinds.bb, blinds.ante);
  const levelText = isMtt(session) ? levelLabel(hand.blinds || currentLevel(session)) : '';

  const oppEntries = Object.entries(cleanOpponentCards(hand.opponentCards));
  const handNames = oppEntries.length
    ? (showdownHandNames({
        board: [...(hand.flop?.cards || []), hand.turn?.card, hand.river?.card].filter(Boolean),
        heroHole: hand.holeCards,
        myPosition: hand.myPosition,
        opponentCards: hand.opponentCards,
      }) || []).filter(h => !(outcome === 'folded' && h.pos === hand.myPosition))
    : [];

  async function handleDelete() {
    await del('hands', id);
    navigate(-1);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h1>Hand #{hand.handNum}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(true)}>Export</button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/hand/${id}/edit`)}>Edit</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)}>Delete</button>
        </div>
      </div>

      <div className="card mb-16">
        <div className="row gap-8 mb-8">
          <PositionBadge position={hand.myPosition} />
          {session && <span className="text-muted text-sm">{session.venue || formatGame(session.game, session.currency)}</span>}
          {levelText && <span className="text-muted text-sm">· {levelText}</span>}
          {hand.playedAt && <span className="text-muted text-sm">· {formatWhen(hand.playedAt)}</span>}
        </div>
        <div className="row gap-8">
          {hand.holeCards?.map((c, i) => <CardBadge key={i} card={c} large />)}
          {hand.holeCards?.length > 0 && <span style={{ margin: '0 8px' }}>→</span>}
          <span className={res.cls} style={{ fontSize: '1.1rem' }}>{res.text}</span>
        </div>
        {outcome && (outcome !== 'folded' || trueNet !== 0) && (
          <div className={'text-sm mt-8 ' + (trueNet >= 0 ? 'result-won' : 'result-lost')}>
            Net: {trueNet >= 0 ? '+' : '−'}{sym}{Math.abs(trueNet).toLocaleString()}
            {!hand.quick && invested > 0 && (
              <span className="text-muted"> · you put in {sym}{invested.toLocaleString()}</span>
            )}
          </div>
        )}
        {hand.result?.notes && <div className="text-muted text-sm mt-8">{hand.result.notes}</div>}
        {oppEntries.length > 0 && (
          <div className="text-sm mt-8">
            <span className="text-muted">對手：</span>
            {oppEntries.map(([pos, cs], i) => (
              <span key={pos}>
                {i > 0 && <span className="text-muted"> · </span>}
                {pos} {cs.map((c, j) => <CardBadge key={j} card={c} />)}
              </span>
            ))}
          </div>
        )}
        {handNames.length > 0 && (
          <div className="text-sm mt-8 text-muted">
            {handNames.map(h => `${h.pos === hand.myPosition ? 'Me' : h.pos}: ${h.name}`).join(' · ')}
          </div>
        )}
      </div>

      {hand.seating?.length > 0 && (
        <div className="card mb-16">
          <div className="text-muted text-sm mb-8">Table this hand · {hand.dealt || hand.seating.length} players</div>
          {hand.seating.map(p => (
            <div key={p.seat} className={'seating-row' + (p.code === 'ME' ? ' seating-me' : '')}>
              <span className="text-muted">Seat {p.seat}</span>
              <span>{p.code === 'ME' ? 'Me' : p.name ? `${p.name} (${p.code})` : p.code}</span>
              <PositionBadge position={p.position} />
            </div>
          ))}
        </div>
      )}

      <StreetRow label="Pre-flop" street={{ ...hand.preflop, notes: hand.preflop?.notes }} sym={sym} />
      {isMtt(session) && formatStacks(hand, blinds.bb) && (
        <div className="text-muted text-xs mb-8">後手：{formatStacks(hand, blinds.bb)}</div>
      )}
      {hand.flop && <StreetRow label="Flop" street={hand.flop} cards={hand.flop.cards} sym={sym} />}
      {hand.turn && <StreetRow label="Turn" street={hand.turn} cards={[hand.turn.card]} sym={sym} />}
      {hand.river && <StreetRow label="River" street={hand.river} cards={[hand.river.card]} sym={sym} />}

      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300, padding: 24,
        }}>
          <div className="card" style={{ maxWidth: 320, width: '100%', textAlign: 'center' }}>
            <h2 className="mb-8">Delete Hand?</h2>
            <p className="text-muted text-sm mb-16">This cannot be undone.</p>
            <div className="row gap-8">
              <button className="btn btn-secondary flex-1" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-danger flex-1" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <ExportSheet hand={hand} session={session} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
