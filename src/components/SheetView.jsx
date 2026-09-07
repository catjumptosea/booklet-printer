import { useEffect, useMemo, useRef, useState } from 'react';
import Slot from './Slot';
import { MAX_SPINE_GAP_MM, PAPER_SIZES } from '../lib/booklet';

const PX_PER_MM = 840 / PAPER_SIZES.a4.sheetWidthMm;

export default function SheetView({ pdfDoc, plan, spineGap = 0, paperSize = 'a4' }) {
  const faces = useMemo(() => {
    const list = [];
    for (const sheet of plan.plan) {
      list.push({ sheet, side: 'front' });
      list.push({ sheet, side: 'back' });
    }
    return list;
  }, [plan]);

  const [index, setIndex] = useState(0);
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const clampedSpineGap = Math.min(MAX_SPINE_GAP_MM, Math.max(0, Number(spineGap) || 0));
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.a4;
  const sheetWidth = paper.sheetWidthMm * PX_PER_MM;
  const sheetHeight = paper.sheetHeightMm * PX_PER_MM;
  const slotHeight = sheetHeight;
  const spineGapPx = clampedSpineGap * PX_PER_MM;
  const slotWidth = Math.max(0, (sheetWidth - spineGapPx) / 2);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setScale(Math.min(1, el.clientWidth / (sheetWidth + 16)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheetWidth]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') setIndex((v) => Math.max(0, v - 1));
      if (e.key === 'ArrowRight') setIndex((v) => Math.min(faces.length - 1, v + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [faces.length]);

  const current = faces[index];
  const face = current.sheet[current.side];

  return (
    <div className="view-block">
      <div className="view-canvas" ref={wrapRef}>
        <div style={{ height: sheetHeight * scale }}>
          <div className="sheet" style={{ width: sheetWidth, height: sheetHeight, transform: `scale(${scale})` }}>
            <Slot
              pdfDoc={pdfDoc}
              slot={face.left}
              boxWidth={slotWidth}
              boxHeight={slotHeight}
              badgeSide="left"
              anchor="right"
            />
            <div className="fold-line" style={{ width: spineGapPx }} />
            <Slot
              pdfDoc={pdfDoc}
              slot={face.right}
              boxWidth={slotWidth}
              boxHeight={slotHeight}
              badgeSide="right"
              anchor="left"
            />
          </div>
        </div>
      </div>

      <div className="paper-size-note">
        <span>{paper.label}</span>
        <span>{paper.sizeText}</span>
      </div>

      <div className="face-strip" role="tablist" aria-label="纸张面列表">
        {faces.map((f, i) => (
          <button
            key={`${f.sheet.index}-${f.side}`}
            type="button"
            className={`face-chip${i === index ? ' active' : ''}`}
            onClick={() => setIndex(i)}
          >
            {f.sheet.index}{f.side === 'front' ? '正' : '反'}
          </button>
        ))}
      </div>
    </div>
  );
}
