import PageCanvas from './PageCanvas';

// 预览里的一个半区槽位：内容页渲染真实页面，空白页显示虚线占位。
export default function Slot({
  pdfDoc,
  slot,
  boxWidth,
  boxHeight,
  badgeSide = 'right',
  anchor = 'center',
  forceLandscape = false,
}) {
  // Unused halves of a printed A4 side have no booklet page at all, and blank
  // pages are padding. Both render as an empty placeholder box.
  if (!slot || slot.kind === 'blank' || slot.kind === 'outside') {
    return (
      <div
        className="slot slot-blank"
        style={{ width: boxWidth, height: boxHeight }}
      >
        {slot?.kind === 'blank' && <span className="slot-blank-label">空白页</span>}
      </div>
    );
  }
  return (
    <div
      className={`slot${anchor === 'left' ? ' anchor-left' : anchor === 'right' ? ' anchor-right' : ''}`}
      style={{ width: boxWidth, height: boxHeight }}
    >
      <PageCanvas
        pdfDoc={pdfDoc}
        pageNumber={slot.sourcePage}
        crop={slot.crop}
        boxWidth={boxWidth}
        boxHeight={boxHeight}
        forceLandscape={forceLandscape}
        contentAnchor={anchor}
      />
      <span className={`slot-badge badge-${badgeSide}`}>P{slot.bookletPage ?? slot.sourcePage}</span>
    </div>
  );
}
