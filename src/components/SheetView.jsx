import { useEffect, useMemo, useRef, useState } from 'react';
import Slot from './Slot';
import { MAX_SPINE_GAP_MM } from '../lib/booklet';

const SLOT_W = 280;
const SLOT_H = 396;
const SHEET_H = SLOT_H;
const A4_WIDTH_MM = 297;
const SHEET_W = SLOT_W * 2;
const MM_TO_PX = SHEET_W / A4_WIDTH_MM;

export default function SheetView({ pdfDoc, plan, spineGap = 0 }) {
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
  const spineGapPx = clampedSpineGap * MM_TO_PX;
  const slotWidth = Math.max(0, (SHEET_W - spineGapPx) / 2);
  const sheetWidth = SHEET_W;

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
        <div style={{ height: SHEET_H * scale }}>
          <div className="sheet" style={{ width: sheetWidth, height: SHEET_H, transform: `scale(${scale})` }}>
            <Slot pdfDoc={pdfDoc} slot={face.left} boxWidth={slotWidth} boxHeight={SLOT_H} badgeSide="left" />
            <div className="fold-line" style={{ width: spineGapPx }} />
            <Slot pdfDoc={pdfDoc} slot={face.right} boxWidth={slotWidth} boxHeight={SLOT_H} badgeSide="right" />
          </div>
        </div>
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
