import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageFlip } from 'page-flip';
import { ChevronLeft, ChevronRight, CornerDownLeft } from 'lucide-react';

const PAGE_W = 420;
const PAGE_H = 594;
const SPREAD_ASPECT = (PAGE_W * 2) / PAGE_H;

function renderPageImage(pdfDoc, pageNumber, boxWidth, boxHeight) {
  return new Promise((resolve, reject) => {
    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const scale = Math.min(
        (boxWidth * dpr) / baseViewport.width,
        (boxHeight * dpr) / baseViewport.height,
      );
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(boxWidth * dpr));
      canvas.height = Math.max(1, Math.floor(boxHeight * dpr));

      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.translate(
        (canvas.width - viewport.width) / 2,
        (canvas.height - viewport.height) / 2,
      );
      await page.render({ canvasContext: context, viewport }).promise;
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    })().catch(reject);
  });
}

function renderBlankPageImage(boxWidth, boxHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(boxWidth));
  canvas.height = Math.max(1, Math.floor(boxHeight));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.86);
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = () => reject(new Error('预览页面图片加载失败'));
    image.src = src;
  });
}

function getSpreadIndex(pageIndex) {
  return Math.floor((pageIndex + 1) / 2);
}

function softenBookShadow(pageFlip) {
  const render = pageFlip.getRender?.();
  if (!render || typeof render.drawBookShadow !== 'function') return;

  render.drawBookShadow = function drawBookShadow() {
    const rect = this.getRect?.();
    const context = this.ctx;
    if (!rect || !context) return;

    context.save();
    context.beginPath();

    const shadowWidth = Math.min(rect.pageWidth * 0.09, 38);
    const hasLeftPage = Boolean(this.leftPage);
    const hasRightPage = Boolean(this.rightPage);
    let shadowLeft = rect.left + (rect.width - shadowWidth) / 2;
    let gradient;

    if (!hasLeftPage) {
      shadowLeft = rect.left + rect.pageWidth;
    } else if (!hasRightPage) {
      shadowLeft = rect.left + rect.pageWidth - shadowWidth;
    }

    context.rect(shadowLeft, rect.top, shadowWidth, rect.height);
    gradient = context.createLinearGradient(shadowLeft, 0, shadowLeft + shadowWidth, 0);

    if (!hasLeftPage) {
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.12, 'rgba(0, 0, 0, 0.065)');
      gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.025)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else if (!hasRightPage) {
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.025)');
      gradient.addColorStop(0.88, 'rgba(0, 0, 0, 0.065)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.38, 'rgba(0, 0, 0, 0.03)');
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.07)');
      gradient.addColorStop(0.62, 'rgba(0, 0, 0, 0.03)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }

    context.clip();
    context.fillStyle = gradient;
    context.fillRect(shadowLeft, rect.top, shadowWidth, rect.height);
    context.restore();
  };
}

export default function FlipView({ pdfDoc, plan }) {
  const shellRef = useRef(null);
  const stageRef = useRef(null);
  const pageFlipRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [jumpValue, setJumpValue] = useState('');

  const spreadCount = useMemo(() => Math.floor(plan.total / 2) + 1, [plan.total]);

  useEffect(() => {
    const shell = shellRef.current;
    const stage = stageRef.current;
    if (!shell || !stage || !pdfDoc || !plan) return undefined;

    let cancelled = false;
    let pageFlip = null;
    let resizeObserver = null;

    const fitStage = () => {
      const availableWidth = shell.clientWidth;
      const availableHeight = shell.clientHeight;
      if (!availableWidth || !availableHeight) return;
      const width = Math.min(availableWidth, availableHeight * SPREAD_ASPECT);
      stage.style.width = `${Math.max(0, Math.floor(width))}px`;
    };

    setIndex(0);
    setReady(false);
    setFlipping(false);
    setJumpValue('');
    fitStage();

    resizeObserver = new ResizeObserver(() => {
      fitStage();
      const currentFlip = pageFlipRef.current;
      if (currentFlip && currentFlip.getUI()) {
        requestAnimationFrame(() => currentFlip.getUI()?.update());
      }
    });
    resizeObserver.observe(shell);

    async function setup() {
      const images = [];
      for (let pageNumber = 1; pageNumber <= plan.total; pageNumber += 1) {
        const slot = plan.pageSlots[pageNumber - 1];
        const src = slot.kind === 'blank'
          ? renderBlankPageImage(PAGE_W, PAGE_H)
          : await renderPageImage(pdfDoc, slot.sourcePage, PAGE_W, PAGE_H);
        images.push(await preloadImage(src));
        if (cancelled) return;
      }

      if (cancelled) return;

      const host = document.createElement('div');
      host.className = 'flipbook-host';
      stage.replaceChildren(host);

      pageFlip = new PageFlip(host, {
        width: PAGE_W,
        height: PAGE_H,
        size: 'stretch',
        minWidth: 120,
        maxWidth: PAGE_W,
        minHeight: 170,
        maxHeight: PAGE_H,
        autoSize: true,
        usePortrait: false,
        showCover: true,
        drawShadow: true,
        flippingTime: 1000,
        maxShadowOpacity: 0.5,
        mobileScrollSupport: false,
      });
      pageFlipRef.current = pageFlip;
      pageFlip.loadFromImages(images);
      softenBookShadow(pageFlip);
      pageFlip.getUI()?.update();

      pageFlip.on('init', ({ data }) => {
        if (!cancelled) {
          setIndex(getSpreadIndex(data.page));
          setReady(true);
        }
      });
      pageFlip.on('flip', ({ data }) => {
        if (!cancelled && typeof data === 'number') {
          setIndex(getSpreadIndex(data));
        }
      });
      pageFlip.on('changeState', ({ data }) => {
        if (!cancelled) setFlipping(data !== 'read');
      });
    }

    setup().catch((error) => {
      console.error('Failed to initialize flipbook:', error);
    });

    return () => {
      cancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
      pageFlipRef.current = null;
      if (pageFlip) pageFlip.destroy();
      stage.replaceChildren();
    };
  }, [pdfDoc, plan]);

  useEffect(() => {
    const onKey = (event) => {
      const pageFlip = pageFlipRef.current;
      if (!pageFlip || flipping) return;
      if (event.key === 'ArrowLeft') pageFlip.flipPrev('top');
      if (event.key === 'ArrowRight') pageFlip.flipNext('top');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipping]);

  const goTo = useCallback((delta) => {
    const pageFlip = pageFlipRef.current;
    if (!pageFlip || flipping) return;
    if (delta > 0) {
      pageFlip.flipNext('top');
    } else {
      pageFlip.flipPrev('top');
    }
  }, [flipping]);

  const goToSpread = useCallback((targetIndex) => {
    const pageFlip = pageFlipRef.current;
    if (!pageFlip || flipping || targetIndex === index) return;

    const targetPage = targetIndex === 0
      ? 0
      : targetIndex === spreadCount - 1
        ? plan.total - 1
        : targetIndex * 2 - 1;
    pageFlip.flip(targetPage, 'top');
  }, [flipping, index, plan.total, spreadCount]);

  const submitJump = (event) => {
    event.preventDefault();
    const parsedPosition = Number(jumpValue);
    const isValid = Number.isInteger(parsedPosition)
      && parsedPosition >= 1
      && parsedPosition <= spreadCount;

    if (!isValid) {
      setJumpValue('');
      return;
    }

    goToSpread(parsedPosition - 1);
    setJumpValue('');
  };

  return (
    <div className="view-block">
      <div className="view-toolbar">
        <span className="view-title">
          {index === 0 ? '封面' : index === spreadCount - 1 ? '封底' : `第 ${index} 跨页`}
        </span>
        <div className="view-actions">
          <form className="jump" onSubmit={submitJump}>
            <input
              className="jump-input"
              type="number"
              inputMode="numeric"
              min="1"
              max={spreadCount}
              step="1"
              value={jumpValue}
              placeholder={`1-${spreadCount}`}
              aria-label="跳转页码"
              onChange={(event) => setJumpValue(event.target.value)}
              disabled={!ready || flipping}
            />
            <button
              type="submit"
              className="jump-button"
              disabled={!ready || flipping || jumpValue === ''}
              aria-label="跳转页码"
            >
              <CornerDownLeft size={14} />
              跳转
            </button>
          </form>
          <div className="pager">
            <button
              type="button"
              onClick={() => goTo(-1)}
              disabled={!ready || flipping || index === 0}
              aria-label="上一页"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="pager-count">{index + 1} / {spreadCount}</span>
            <button
              type="button"
              onClick={() => goTo(1)}
              disabled={!ready || flipping || index === spreadCount - 1}
              aria-label="下一页"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="view-canvas">
        <div className="flipbook-shell" ref={shellRef}>
          <div className="flipbook-stage" ref={stageRef} />
        </div>
      </div>

      <p className="view-hint">按成册翻阅顺序预览；空白页会保留在打印文件中。</p>
    </div>
  );
}
