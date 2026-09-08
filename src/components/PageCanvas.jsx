import { useEffect, useRef } from 'react';

export default function PageCanvas({
  pdfDoc,
  pageNumber,
  boxWidth,
  boxHeight,
  forceLandscape = false,
  contentAnchor = 'center',
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;

    async function render() {
      const canvas = canvasRef.current;
      if (!pdfDoc || !canvas || !pageNumber) return;
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const dpr = window.devicePixelRatio || 1;
      const shouldRotate = forceLandscape && base.width < base.height;
      const naturalWidth = shouldRotate ? base.height : base.width;
      const naturalHeight = shouldRotate ? base.width : base.height;
      const scale = Math.min((boxWidth * dpr) / naturalWidth, (boxHeight * dpr) / naturalHeight);
      const drawW = base.width * scale;
      const drawH = base.height * scale;
      const visibleWidth = shouldRotate ? drawH : drawW;
      canvas.width = Math.max(1, Math.floor((boxWidth * dpr)));
      canvas.height = Math.max(1, Math.floor((boxHeight * dpr)));
      canvas.style.width = `${Math.floor(boxWidth)}px`;
      canvas.style.height = `${Math.floor(boxHeight)}px`;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const contentCenterX = contentAnchor === 'left'
        ? visibleWidth / 2
        : contentAnchor === 'right'
          ? canvas.width - visibleWidth / 2
          : canvas.width / 2;
      ctx.translate(contentCenterX, canvas.height / 2);
      if (shouldRotate) {
        ctx.rotate(Math.PI / 2);
      }
      const centeredViewport = page.getViewport({
        scale,
        offsetX: -(drawW / 2),
        offsetY: -(drawH / 2),
      });
      renderTask = page.render({ canvasContext: ctx, viewport: centeredViewport });
      try {
        await renderTask.promise;
      } catch (err) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          throw err;
        }
      } finally {
        ctx.restore();
      }
    }

    render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNumber, boxWidth, boxHeight, forceLandscape, contentAnchor]);

  return <canvas ref={canvasRef} className="page-canvas" />;
}
