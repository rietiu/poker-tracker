import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, del } from '../db';
import { formatCard, formatMoney, isRedCard } from '../utils';
import PositionBadge from '../components/PositionBadge';

const CURRENCY_SYMBOLS = { USD: '$', PHP: '₱', EUR: '€', GBP: '£' };

// ── Position labels ──────────────────────────────────────────────────────────
const POS_ZH = {
  SB: '小盲 (SB)', BB: '大盲 (BB)', UTG: '枪口位 (UTG)', 'UTG+1': '枪口+1',
  MP: '中间位 (MP)', LJ: '左炮 (LJ)', HJ: '劫持位 (HJ)', CO: '关煞位 (CO)', BTN: '庄家位 (BTN)',
};
const ACTION_EN = { fold: 'fold', check: 'check', call: 'call', bet: 'bet', raise: 'raise' };
const ACTION_ZH = { fold: '弃牌', check: '过牌', call: '跟注', bet: '下注', raise: '加注' };

// ── Hand history generator ───────────────────────────────────────────────────
function generateHandText(hand, session, lang) {
  const zh = lang === 'zh';
  const sym = CURRENCY_SYMBOLS[session?.currency || 'USD'] || '$';
  const fmt = (n) => sym + Number(n).toLocaleString();
  const card = (c) => c ? formatCard(c) : '?';
  const cards = (arr) => (arr || []).filter(Boolean).map(card).join(' ');

  const posLabel = (pos) => zh ? (POS_ZH[pos] || pos) : pos;
  const actionWord = (a) => zh ? (ACTION_ZH[a] || a) : (ACTION_EN[a] || a);
  const heroMark = zh ? '（我）' : ' (Hero)';
  const myPos = hand.myPosition;

  const lines = [];

  // Header
  const venue = session?.venue ? (zh ? `【${session.venue}】` : ` @ ${session.venue}`) : '';
  lines.push(zh
    ? `手牌 #${hand.handNum}${venue} — ${session?.game || ''}`
    : `Hand #${hand.handNum}${venue} — ${session?.game || ''}`
  );
  lines.push(zh
    ? `位置：${posLabel(myPos)}　手牌：${cards(hand.holeCards)}`
    : `Position: ${posLabel(myPos)}  |  Hole cards: ${cards(hand.holeCards)}`
  );
  lines.push('');

  // Street renderer
  function renderStreet(label, labelZh, streetData, communityCards) {
    if (!streetData) return;
    const actions = streetData.actions || [];
    const pot = streetData.pot || streetData.endPot || 0;
    const startPot = streetData.startPot; // optional

    const streetLabel = zh ? labelZh : label;
    const potStr = pot > 0 ? (zh ? `（底池：${fmt(pot)}）` : ` (Pot: ${fmt(pot)})`) : '';
    let header = streetLabel + potStr;
    if (communityCards && communityCards.filter(Boolean).length > 0) {
      header = streetLabel + `: ${cards(communityCards)}` + potStr;
    }
    lines.push('── ' + header);

    for (const a of actions) {
      const isMe = a.pos === myPos;
      const posStr = posLabel(a.pos) + (isMe ? heroMark : '');
      const amt = a.amount > 0 ? ` ${fmt(a.amount)}` : '';
      lines.push(`  ${posStr}: ${actionWord(a.action)}${amt}`);
    }

    if (actions.length === 0) {
      lines.push(zh ? '  （無行動記錄）' : '  (no actions recorded)');
    }
    lines.push('');
  }

  renderStreet('Pre-flop', '翻牌前', {
    actions: hand.preflop?.actions || [],
    pot: hand.preflop?.pot,
  });

  if (hand.flop) {
    renderStreet('Flop', '翻牌', {
      actions: hand.flop.actions || [],
      pot: hand.flop.pot,
    }, hand.flop.cards);
  }

  if (hand.turn) {
    renderStreet('Turn', '轉牌', {
      actions: hand.turn.actions || [],
      pot: hand.turn.pot,
    }, [hand.turn.card]);
  }

  if (hand.river) {
    renderStreet('River', '河牌', {
      actions: hand.river.actions || [],
      pot: hand.river.pot,
    }, [hand.river.card]);
  }

  // Result
  const { outcome, amount, winner, notes } = hand.result || {};
  lines.push(zh ? '── 結果' : '── Result');
  if (outcome === 'won') {
    lines.push(zh ? `  贏得 ${fmt(amount)}` : `  Won ${fmt(amount)}`);
  } else if (outcome === 'lost') {
    const winnerStr = winner && winner !== myPos ? ` (${zh ? '贏家：' : 'winner: '}${posLabel(winner)})` : '';
    lines.push(zh ? `  輸掉 ${fmt(amount)}${winnerStr}` : `  Lost ${fmt(amount)}${winnerStr}`);
  } else if (outcome === 'split') {
    lines.push(zh ? `  平分 ±${fmt(amount)}` : `  Split ±${fmt(amount)}`);
  } else if (outcome === 'folded') {
    lines.push(zh ? '  棄牌' : '  Folded');
  }
  if (notes) {
    lines.push(zh ? `  備注：${notes}` : `  Notes: ${notes}`);
  }

  // Street notes
  ['preflop', 'flop', 'turn', 'river'].forEach(s => {
    const n = hand[s]?.notes;
    if (n) {
      const streetName = zh
        ? { preflop: '翻牌前', flop: '翻牌', turn: '轉牌', river: '河牌' }[s]
        : { preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River' }[s];
      lines.push(zh ? `  ${streetName}備注：${n}` : `  ${streetName} note: ${n}`);
    }
  });

  lines.push('');
  lines.push(zh
    ? '請幫我分析這手牌的打法是否正確，有什麼改進空間？'
    : 'Please analyze this hand. Were my decisions correct? What could be improved?'
  );

  return lines.join('\n');
}

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
  const text = generateHandText(hand, session, lang);

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

  const sym = CURRENCY_SYMBOLS[session?.currency || 'USD'] || '$';
  const { outcome, amount } = hand.result || {};

  function resultText() {
    if (outcome === 'folded') return { text: 'Folded', cls: 'result-fold' };
    if (outcome === 'won') return { text: `Won +${sym}${Number(amount).toLocaleString()}`, cls: 'result-won' };
    if (outcome === 'lost') return { text: `Lost -${sym}${Math.abs(Number(amount)).toLocaleString()}`, cls: 'result-lost' };
    if (outcome === 'split') return { text: `Split ±${sym}${Number(amount).toLocaleString()}`, cls: 'result-split' };
    return { text: '', cls: '' };
  }

  const res = resultText();

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
          {session && <span className="text-muted text-sm">{session.venue || session.game}</span>}
        </div>
        <div className="row gap-8">
          {hand.holeCards?.map((c, i) => <CardBadge key={i} card={c} large />)}
          {hand.holeCards?.length > 0 && <span style={{ margin: '0 8px' }}>→</span>}
          <span className={res.cls} style={{ fontSize: '1.1rem' }}>{res.text}</span>
        </div>
        {hand.result?.notes && <div className="text-muted text-sm mt-8">{hand.result.notes}</div>}
      </div>

      <StreetRow label="Pre-flop" street={{ ...hand.preflop, notes: hand.preflop?.notes }} sym={sym} />
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
