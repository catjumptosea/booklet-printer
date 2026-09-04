import PageCanvas from './PageCanvas';

// 预览里的一个半区槽位：内容页渲染真实页面，空白页显示虚线占位。
export default function Slot({ pdfDoc, slot, boxWidth, boxHeight, badgeSide = 'right' }) {
  if (slot.kind === 'blank') {
    return (
      <div className="slot slot-blank" style={{ width: boxWidth, height: boxHeight }}>
        <span className="slot-blank-label">空白页</span>
      </div>
    );
  }
  return (
    <div className="slot" style={{ width: boxWidth, height: boxHeight }}>
      <PageCanvas pdfDoc={pdfDoc} pageNumber={slot.sourcePage} boxWidth={boxWidth} boxHeight={boxHeight} />
      <span className={`slot-badge badge-${badgeSide}`}>P{slot.sourcePage}</span>
    </div>
  );
}
