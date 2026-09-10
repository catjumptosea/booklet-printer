import { useEffect, useRef } from 'react';

export default function PageCanvas({
  pdfDoc,
  pageNumber,
  crop = null,
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
      const cropLeft = Math.max(0, Math.min(1, crop?.left ?? 0));
      const cropTop = Math.max(0, Math.min(1, crop?.top ?? 0));
      const cropWidth = Math.max(0.001, Math.min(1 - cropLeft, crop?.width ?? 1));
      const cropHeight = Math.max(0.001, Math.min(1 - cropTop, crop?.height ?? 1));
      const contentWidth = base.width * cropWidth;
      const contentHeight = base.height * cropHeight;
      const naturalWidth = shouldRotate ? contentHeight : contentWidth;
      const naturalHeight = shouldRotate ? contentWidth : contentHeight;
      const scale = Math.min((boxWidth * dpr) / naturalWidth, (boxHeight * dpr) / naturalHeight);
      const drawW = base.width * scale;
      const drawH = base.height * scale;
      const visibleWidth = shouldRotate ? contentHeight * scale : contentWidth * scale;
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
        offsetX: -((cropLeft + cropWidth / 2) * drawW),
        offsetY: -((cropTop + cropHeight / 2) * drawH),
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
  }, [pdfDoc, pageNumber, crop, boxWidth, boxHeight, forceLandscape, contentAnchor]);

  return <canvas ref={canvasRef} className="page-canvas" />;
}
