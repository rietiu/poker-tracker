import { formatCard, formatGame } from './utils';
import { chipSym } from './mtt';
import { cleanOpponentCards, showdownHandNames } from './showdown';

// ── Position labels ──────────────────────────────────────────────────────────
const POS_ZH = {
  SB: '小盲 (SB)', BB: '大盲 (BB)', UTG: '枪口位 (UTG)', 'UTG+1': '枪口+1',
  MP: '中间位 (MP)', LJ: '左炮 (LJ)', HJ: '劫持位 (HJ)', CO: '关煞位 (CO)', BTN: '庄家位 (BTN)',
};
const ACTION_EN = { fold: 'fold', check: 'check', call: 'call', bet: 'bet', raise: 'raise' };
const ACTION_ZH = { fold: '弃牌', check: '过牌', call: '跟注', bet: '下注', raise: '加注' };

// ── Hand history generator ───────────────────────────────────────────────────
/**
 * Does this hand carry showdown info worth a share toggle? True when opponent
 * hole cards were recorded, or another player was recorded as the winner of a
 * hand hero did not fold.
 */
export function hasShowdownData(hand) {
  if (Object.keys(cleanOpponentCards(hand?.opponentCards)).length > 0) return true;
  const { outcome, winner } = hand?.result || {};
  return !!winner && winner !== hand?.myPosition && outcome !== 'folded';
}

/**
 * Build the shareable hand text. includeShowdown=false hides opponent cards,
 * hand-type names, the winner and the won/lost/split result line; hero's own
 * cards, board and actions stay.
 */
export function generateHandText(hand, session, lang, { includeShowdown = true } = {}) {
  const zh = lang === 'zh';
  const sym = chipSym(session);
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
    ? `手牌 #${hand.handNum}${venue} — ${formatGame(session?.game, session?.currency)}`
    : `Hand #${hand.handNum}${venue} — ${formatGame(session?.game, session?.currency)}`
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
  const resultLines = [];
  if (includeShowdown) {
    if (outcome === 'won') {
      resultLines.push(zh ? `  贏得 ${fmt(amount)}` : `  Won ${fmt(amount)}`);
    } else if (outcome === 'lost') {
      const winnerStr = winner && winner !== myPos ? ` (${zh ? '贏家：' : 'winner: '}${posLabel(winner)})` : '';
      resultLines.push(zh ? `  輸掉 ${fmt(amount)}${winnerStr}` : `  Lost ${fmt(amount)}${winnerStr}`);
    } else if (outcome === 'split') {
      resultLines.push(zh ? `  平分 ±${fmt(amount)}` : `  Split ±${fmt(amount)}`);
    }
    const oppEntries = Object.entries(cleanOpponentCards(hand.opponentCards));
    if (oppEntries.length) {
      resultLines.push((zh ? '  對手手牌：' : '  Opponents: ') + oppEntries.map(([pos, cs]) => `${pos} ${cards(cs)}`).join(' · '));
      const names = (showdownHandNames({
        board: [...(hand.flop?.cards || []), hand.turn?.card, hand.river?.card].filter(Boolean),
        heroHole: hand.holeCards,
        myPosition: myPos,
        opponentCards: hand.opponentCards,
      }) || []).filter(h => !(outcome === 'folded' && h.pos === myPos));
      if (names.length) {
        resultLines.push((zh ? '  牌型：' : '  Hand types: ') + names.map(h => `${h.pos === myPos ? (zh ? '我' : 'Me') : h.pos}: ${h.name}`).join(' · '));
      }
    }
  }
  if (outcome === 'folded') {
    resultLines.push(zh ? '  棄牌' : '  Folded');
  }
  if (notes) {
    resultLines.push(zh ? `  備注：${notes}` : `  Notes: ${notes}`);
  }
  if (includeShowdown || resultLines.length) {
    lines.push(zh ? '── 結果' : '── Result');
    lines.push(...resultLines);
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

