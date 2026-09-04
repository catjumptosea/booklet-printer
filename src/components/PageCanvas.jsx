import { useEffect, useRef } from 'react';

export default function PageCanvas({ pdfDoc, pageNumber, boxWidth, boxHeight }) {
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
      const scale = Math.min((boxWidth * dpr) / base.width, (boxHeight * dpr) / base.height);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
      const ctx = canvas.getContext('2d');
      renderTask = page.render({ canvasContext: ctx, viewport });
      try {
        await renderTask.promise;
      } catch (err) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          throw err;
        }
      }
    }

    render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNumber, boxWidth, boxHeight]);

  return <canvas ref={canvasRef} className="page-canvas" />;
}
