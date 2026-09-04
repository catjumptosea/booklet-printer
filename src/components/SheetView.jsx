import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Slot from './Slot';

const SLOT_W = 280;
const SLOT_H = 396;
const SHEET_W = SLOT_W * 2 + 56;
const SHEET_H = SLOT_H + 40;

export default function SheetView({ pdfDoc, plan }) {
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

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setScale(Math.min(1, el.clientWidth / (SHEET_W + 16)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      <div className="view-toolbar">
        <span className="view-title">
          第 {current.sheet.index} 张 · {current.side === 'front' ? '正面' : '反面'}
        </span>
        <div className="pager">
          <button type="button" onClick={() => setIndex((v) => Math.max(0, v - 1))} disabled={index === 0} aria-label="上一面">
            <ChevronLeft size={16} />
          </button>
          <span className="pager-count">{index + 1} / {faces.length}</span>
          <button
            type="button"
            onClick={() => setIndex((v) => Math.min(faces.length - 1, v + 1))}
            disabled={index === faces.length - 1}
            aria-label="下一面"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="view-canvas" ref={wrapRef}>
        <div style={{ height: SHEET_H * scale }}>
          <div className="sheet" style={{ width: SHEET_W, height: SHEET_H, transform: `scale(${scale})` }}>
            <Slot pdfDoc={pdfDoc} slot={face.left} boxWidth={SLOT_W} boxHeight={SLOT_H} badgeSide="left" />
            <div className="fold-line" />
            <Slot pdfDoc={pdfDoc} slot={face.right} boxWidth={SLOT_W} boxHeight={SLOT_H} badgeSide="right" />
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
