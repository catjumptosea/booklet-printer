import { useEffect, useMemo, useRef, useState } from 'react';
import Slot from './Slot';
import { BOOKLET_FORMATS, getSheetLayout, MAX_SPINE_GAP_MM, PAPER_SIZES } from '../lib/booklet';

const PX_PER_MM = 840 / PAPER_SIZES.a4.sheetWidthMm;

export default function SheetView({
  pdfDoc,
  plan,
  spineGap = 0,
  paperSize = 'a4',
  bookletFormat = 'a5',
}) {
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
  const isA6 = bookletFormat === 'a6';
  const layout = getSheetLayout(paperSize, bookletFormat);
  const paper = layout.paper;
  const sheetWidth = layout.sheetWidthMm * PX_PER_MM;
  const sheetHeight = layout.sheetHeightMm * PX_PER_MM;
  const slotHeight = sheetHeight;
  const a6SlotHeight = sheetHeight / 2;
  const spineGapPx = clampedSpineGap * PX_PER_MM;
  const slotWidth = Math.max(0, (sheetWidth - spineGapPx) / 2);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => {
      // Account for the canvas padding so portrait A6 sheets fit vertically too.
      const availableWidth = Math.max(0, el.clientWidth - 72);
      const availableHeight = Math.max(0, el.clientHeight - 64);
      setScale(Math.min(
        1,
        availableWidth / sheetWidth,
        availableHeight / sheetHeight,
      ));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheetHeight, sheetWidth]);

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
  const formatLabel = BOOKLET_FORMATS[bookletFormat]?.label || BOOKLET_FORMATS.a5.label;
  const paperSizeText = isA6
    ? `${layout.sheetWidthMm} × ${layout.sheetHeightMm} mm`
    : paper.sizeText;

  return (
    <div className="view-block">
      <div className="view-canvas" ref={wrapRef}>
        <div style={{ height: sheetHeight * scale }}>
          <div
            className={`sheet${isA6 ? ' sheet-a6' : ''}`}
            style={{ width: sheetWidth, height: sheetHeight, transform: `scale(${scale})` }}
          >
            {isA6 ? (
              <>
                <div className="sheet-row">
                  <Slot
                    pdfDoc={pdfDoc}
                    slot={face.topLeft}
                    boxWidth={slotWidth}
                    boxHeight={a6SlotHeight}
                    badgeSide="left"
                    anchor="right"
                    forceLandscape
                  />
                  <div className="fold-line" style={{ width: spineGapPx }} />
                  <Slot
                    pdfDoc={pdfDoc}
                    slot={face.topRight}
                    boxWidth={slotWidth}
                    boxHeight={a6SlotHeight}
                    badgeSide="right"
                    anchor="left"
                    forceLandscape
                  />
                </div>
                <div className="sheet-row">
                  <Slot
                    pdfDoc={pdfDoc}
                    slot={face.bottomLeft}
                    boxWidth={slotWidth}
                    boxHeight={a6SlotHeight}
                    badgeSide="left"
                    anchor="right"
                    forceLandscape
                  />
                  <div className="fold-line" style={{ width: spineGapPx }} />
                  <Slot
                    pdfDoc={pdfDoc}
                    slot={face.bottomRight}
                    boxWidth={slotWidth}
                    boxHeight={a6SlotHeight}
                    badgeSide="right"
                    anchor="left"
                    forceLandscape
                  />
                </div>
                <div className="cut-line" />
              </>
            ) : (
              <>
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
              </>
            )}
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
