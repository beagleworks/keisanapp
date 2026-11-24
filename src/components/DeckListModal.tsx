import { useEffect } from 'react';
import { formatExpression, type DeckDefinition } from '../data/decks';

interface DeckListModalProps {
  deck: DeckDefinition;
  onClose: () => void;
}

export function DeckListModal({ deck, onClose }: DeckListModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${deck.name} のもんだいいちらん`}
      onClick={onClose}
    >
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottomColor: deck.colorSoft }}>
          <div>
            <h2 className="modal-title" style={{ color: deck.colorDark }}>
              {deck.name}（ぜんぶで {deck.cards.length}まい）
            </h2>
            <p className="modal-subtitle">{deck.subtitle}</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="とじる"
          >
            ✕
          </button>
        </div>

        <div className="deck-list-grid">
          {deck.cards.map((card, index) => (
            <div
              key={card.id}
              className="deck-list-chip"
              style={{ borderColor: deck.colorSoft }}
            >
              <span className="deck-list-num">{index + 1}</span>
              <span className="deck-list-expr">{formatExpression(card)}</span>
              <span className="deck-list-ans" style={{ color: deck.colorDark }}>
                ＝ {card.answer}
              </span>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <a
            href={deck.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="source-link"
          >
            さんこう：ちびむすドリル（大サイズ）
          </a>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            とじる
          </button>
        </div>
      </div>
    </div>
  );
}
