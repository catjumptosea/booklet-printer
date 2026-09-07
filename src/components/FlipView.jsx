import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageFlip } from 'page-flip';
import { ChevronLeft, ChevronRight, CornerDownLeft, Maximize, Minimize } from 'lucide-react';

const PAGE_W = 420;
const PAGE_H = 594;
const SHEET_W = PAGE_W * 2;
const MAX_HIGH_RES_PAGE_WIDTH = 1800;
const HIGH_RES_JPEG_QUALITY = 0.92;
const HIGH_RES_MEMORY_BUDGET = 256 * 1024 * 1024;
const HIGH_RES_RETENTION_MS = 60 * 1000;
const HIGH_RES_SOURCE_RELEASE_DELAY_MS = 1500;
const A4_WIDTH_MM = 297;
const A4_HEIGHT_MM = 210;
const MAX_SPINE_GAP_MM = 280;

function canvasToObjectUrl(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode preview page.'));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, type, quality);
  });
}

function clampSpineGap(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_SPINE_GAP_MM, Math.max(0, parsed));
}

function getSpineGapPx(spineGap) {
  return (clampSpineGap(spineGap) / A4_WIDTH_MM) * SHEET_W;
}

function getPageContentWidthPx(spineGap) {
  return (SHEET_W - getSpineGapPx(spineGap)) / 2;
}

// Each flipping page keeps the gutter symmetrically on both edges. The view
// crops the outer halves, leaving one continuous gutter at the book spine.
// PageFlip then moves an image with identical left/right geometry, so a page
// does not jump when its orientation changes during the flip animation.
function getPageBoxWidth(spineGap) {
  return getPageContentWidthPx(spineGap) + getSpineGapPx(spineGap);
}

function getStageWidth(spineGap) {
  return getPageBoxWidth(spineGap) * 2;
}

function getDisplayPageHeight(pageWidth, spineGap) {
  const pageBoxWidth = getPageBoxWidth(spineGap);
  return Math.max(1, Math.round((pageWidth / pageBoxWidth) * PAGE_H));
}

function getVisibleAspect() {
  return SHEET_W / PAGE_H;
}

function renderPageImage(
  pdfDoc,
  pageNumber,
  boxWidth,
  boxHeight,
  renderScale = Math.min(2, window.devicePixelRatio || 1),
  quality = 0.86,
  contentInsetPx = 0,
) {
  return new Promise((resolve, reject) => {
    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const inset = Math.max(0, Math.min(boxWidth / 2, contentInsetPx)) * renderScale;
      const contentWidth = Math.max(1, boxWidth * renderScale - inset * 2);
      const scale = Math.min(
        contentWidth / baseViewport.width,
        (boxHeight * renderScale) / baseViewport.height,
      );
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(boxWidth * renderScale));
      canvas.height = Math.max(1, Math.floor(boxHeight * renderScale));

      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.translate(
        inset + (contentWidth - viewport.width) / 2,
        (canvas.height - viewport.height) / 2,
      );
      await page.render({ canvasContext: context, viewport }).promise;
      resolve(await canvasToObjectUrl(canvas, 'image/jpeg', quality));
    })().catch(reject);
  });
}

async function renderBlankPageImage(boxWidth, boxHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(boxWidth));
  canvas.height = Math.max(1, Math.floor(boxHeight));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvasToObjectUrl(canvas, 'image/jpeg', 0.86);
}

async function renderVirtualPageImage(boxWidth, boxHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(boxWidth));
  canvas.height = Math.max(1, Math.floor(boxHeight));
  const context = canvas.getContext('2d');
  context.fillStyle = '#e9edf1';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvasToObjectUrl(canvas, 'image/png');
}

function revokeImageUrls(urls) {
  for (const url of urls || []) {
    if (url) URL.revokeObjectURL(url);
  }
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = () => reject(new Error('预览页面图片加载失败'));
    image.src = src;
  });
}

async function waitForReadState(pageFlip) {
  if (pageFlip.getState?.() === 'read') return;

  await new Promise((resolve) => {
    const timer = window.setInterval(() => {
      if (pageFlip.getState?.() === 'read') {
        window.clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}

function getSpreadIndex(pageIndex) {
  return Math.floor((pageIndex + 1) / 2);
}

function getHighResRenderTarget(shell, spineGap) {
  const availableWidth = shell.clientWidth;
  const availableHeight = shell.clientHeight;
  if (!availableWidth || !availableHeight) return null;

  const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const displayWidth = Math.min(availableWidth, availableHeight * getVisibleAspect());
  const displayGapPx = getSpineGapPx(spineGap) * (displayWidth / SHEET_W);
  const displayContentWidth = Math.max(0, (displayWidth - displayGapPx) / 2);
  const targetPixelWidth = Math.max(1, Math.round(displayContentWidth * devicePixelRatio));
  const gapPx = Math.round(displayGapPx * devicePixelRatio);
  const targetHeight = Math.max(1, Math.round(targetPixelWidth * (PAGE_H / PAGE_W)));
  const pagePixelWidth = targetPixelWidth + gapPx;
  const basePixelWidth = Math.round(PAGE_W * devicePixelRatio * 1.12);

  if (targetPixelWidth < basePixelWidth || pagePixelWidth < 2) return null;

  return {
    width: targetPixelWidth,
    height: targetHeight,
    pageWidth: pagePixelWidth,
    gap: gapPx,
  };
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

function useDesktopCanvas(pageFlip) {
  const render = pageFlip.getRender?.();
  if (!render || typeof render.clear !== 'function') return;

  render.clear = function clear() {
    // StPageFlip's clipped pages can leave sub-pixel seams. Match the fill to
    // the active surface: white for ordinary pages, desktop gray for the
    // preview-only cover/back-cover spreads.
    const hasVirtualPage = [
      this.leftPage,
      this.rightPage,
      this.flippingPage,
      this.bottomPage,
    ].some((page) => page?.isVirtual);

    this.ctx.fillStyle = hasVirtualPage ? '#e9edf1' : '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  };
}

function hideBoundaryOuterShadow(pageFlip) {
  const render = pageFlip.getRender?.();
  if (!render || typeof render.drawOuterShadow !== 'function') return;

  const originalDrawOuterShadow = render.drawOuterShadow;
  render.drawOuterShadow = function drawOuterShadow() {
    const hasVirtualPage = [
      this.leftPage,
      this.rightPage,
      this.flippingPage,
      this.bottomPage,
    ].some((page) => page?.isVirtual);

    if (hasVirtualPage) return;
    originalDrawOuterShadow.call(this);
  };
}

function markVirtualPages(pageFlip) {
  const pages = pageFlip.getPageCollection()?.getPages() || [];
  if (pages[0]) pages[0].isVirtual = true;
  if (pages[pages.length - 1]) pages[pages.length - 1].isVirtual = true;
}

function applyIntegerPageGeometry(pageFlip, spineGap) {
  const render = pageFlip.getRender?.();
  const settings = pageFlip.getSettings?.();
  if (!render || !settings) return;

  const rect = render.getRect?.();
  const pageWidth = Math.max(1, Math.round(rect?.pageWidth || 0));
  if (!pageWidth) return;

  const pageHeight = getDisplayPageHeight(pageWidth, spineGap);
  if (settings.width === pageWidth && settings.height === pageHeight) return;

  settings.width = pageWidth;
  settings.height = pageHeight;
  pageFlip.updateOrientation(pageFlip.getOrientation());
}

export default function FlipView({ pdfDoc, plan, spineGap = 0 }) {
  const shellRef = useRef(null);
  const stageRef = useRef(null);
  const viewBlockRef = useRef(null);
  const pageFlipRef = useRef(null);
  const highResRenderTokenRef = useRef(0);
  const highResRenderKeyRef = useRef('');
  const lowResImagesRef = useRef(null);
  const highResImagesRef = useRef(null);
  const highResTargetRef = useRef(null);
  const highResStateRef = useRef('idle');
  const activeQualityRef = useRef('low');
  const downgradeTimerRef = useRef(null);
  const highResReleaseTimerRef = useRef(null);
  const previewSwitchTokenRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highResRender, setHighResRender] = useState({
    active: false,
    progress: 0,
    visible: false,
  });

  const cancelPendingDowngrade = useCallback(() => {
    if (downgradeTimerRef.current) {
      window.clearTimeout(downgradeTimerRef.current);
      downgradeTimerRef.current = null;
    }
    previewSwitchTokenRef.current += 1;
  }, []);

  const releaseHighResSources = useCallback(() => {
    if (highResReleaseTimerRef.current) {
      window.clearTimeout(highResReleaseTimerRef.current);
      highResReleaseTimerRef.current = null;
    }
    revokeImageUrls(highResImagesRef.current);
    highResImagesRef.current = null;
    highResTargetRef.current = null;
    highResStateRef.current = 'idle';
    highResRenderKeyRef.current = '';
    activeQualityRef.current = 'low';
  }, []);

  const scheduleHighResRelease = useCallback(() => {
    if (highResReleaseTimerRef.current) {
      window.clearTimeout(highResReleaseTimerRef.current);
    }

    highResReleaseTimerRef.current = window.setTimeout(() => {
      highResReleaseTimerRef.current = null;
      releaseHighResSources();
    }, HIGH_RES_SOURCE_RELEASE_DELAY_MS);
  }, [releaseHighResSources]);

  const releaseAllPreviewSources = useCallback(() => {
    cancelPendingDowngrade();
    if (highResReleaseTimerRef.current) {
      window.clearTimeout(highResReleaseTimerRef.current);
      highResReleaseTimerRef.current = null;
    }
    revokeImageUrls(lowResImagesRef.current);
    revokeImageUrls(highResImagesRef.current);
    lowResImagesRef.current = null;
    highResImagesRef.current = null;
    highResTargetRef.current = null;
    highResStateRef.current = 'idle';
    activeQualityRef.current = 'low';
    highResRenderKeyRef.current = '';
  }, [cancelPendingDowngrade]);

  const switchToLowRes = useCallback(async () => {
    const pageFlip = pageFlipRef.current;
    const lowResImages = lowResImagesRef.current;

    if (!pageFlip || !lowResImages || activeQualityRef.current !== 'high') return;

    const switchToken = previewSwitchTokenRef.current + 1;
    previewSwitchTokenRef.current = switchToken;

    await waitForReadState(pageFlip);
    if (previewSwitchTokenRef.current !== switchToken || pageFlipRef.current !== pageFlip) return;

    try {
      await Promise.all(lowResImages.map((url) => preloadImage(url)));
    } catch (error) {
      console.error('Failed to prepare low-resolution preview:', error);
      return;
    }

    if (previewSwitchTokenRef.current !== switchToken || pageFlipRef.current !== pageFlip) return;

    pageFlip.updateFromImages(lowResImages);
    pageFlip.getUI()?.update();
    markVirtualPages(pageFlip);
    activeQualityRef.current = 'low';
    highResStateRef.current = 'retained';
    scheduleHighResRelease();
  }, [scheduleHighResRelease]);

  const cancelHighResRender = useCallback(() => {
    if (highResStateRef.current !== 'rendering') return;

    highResRenderTokenRef.current += 1;
    highResRenderKeyRef.current = '';
    highResStateRef.current = activeQualityRef.current === 'high' ? 'applied' : 'idle';
    setHighResRender({ active: false, progress: 0, visible: false });
  }, []);

  const applyRetainedHighRes = useCallback(() => {
    const pageFlip = pageFlipRef.current;
    const highResImages = highResImagesRef.current;

    if (!pageFlip || !highResImages || highResStateRef.current !== 'retained') return;

    pageFlip.updateFromImages(highResImages);
    pageFlip.getUI()?.update();
    markVirtualPages(pageFlip);
    activeQualityRef.current = 'high';
    highResStateRef.current = 'applied';
  }, []);

  const scheduleDowngradeAfterFullscreenExit = useCallback(() => {
    if (activeQualityRef.current !== 'high' || highResStateRef.current !== 'applied') return;

    const target = highResTargetRef.current;
    const pageCount = highResImagesRef.current?.length || 0;
    const estimatedMemory = target && pageCount
      ? target.width * target.height * 4 * pageCount
      : 0;

    if (estimatedMemory > HIGH_RES_MEMORY_BUDGET) {
      switchToLowRes();
      return;
    }

    if (downgradeTimerRef.current) {
      window.clearTimeout(downgradeTimerRef.current);
    }

    downgradeTimerRef.current = window.setTimeout(() => {
      downgradeTimerRef.current = null;
      switchToLowRes();
    }, HIGH_RES_RETENTION_MS);
  }, [switchToLowRes]);

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
      const visibleWidth = Math.min(availableWidth, availableHeight * getVisibleAspect());
      const width = visibleWidth * (getStageWidth(spineGap) / SHEET_W);
      // StPageFlip divides the stage width by two. An odd stage width creates a
      // fractional page width and a visible sub-pixel seam at the outer edges.
      stage.style.width = `${Math.max(0, Math.floor(width / 2) * 2)}px`;
    };

    setIndex(0);
    setReady(false);
    setFlipping(false);
    setJumpValue('');
    releaseAllPreviewSources();
    highResRenderTokenRef.current += 1;
    highResRenderKeyRef.current = '';
    highResStateRef.current = 'idle';
    activeQualityRef.current = 'low';
    setHighResRender({ active: false, progress: 0, visible: false });
    fitStage();

    resizeObserver = new ResizeObserver(() => {
      fitStage();
      const currentFlip = pageFlipRef.current;
      if (currentFlip && currentFlip.getUI()) {
        requestAnimationFrame(() => {
          if (pageFlipRef.current !== currentFlip) return;
          applyIntegerPageGeometry(currentFlip, spineGap);
        });
      }
    });
    resizeObserver.observe(shell);

    let lowResUrls = [];

    async function setup() {
      const spineGapPx = getSpineGapPx(spineGap);
      const pageBoxWidth = getPageBoxWidth(spineGap);
      // These two preview-only pages turn cover/back-cover boundaries into
      // ordinary spreads so StPageFlip can handle every flip state natively.
      lowResUrls = [];
      const firstUrl = await renderVirtualPageImage(pageBoxWidth, PAGE_H);
      if (cancelled) {
        revokeImageUrls([firstUrl]);
        lowResImagesRef.current = null;
        return;
      }
      lowResUrls.push(firstUrl);

      for (let pageNumber = 1; pageNumber <= plan.total; pageNumber += 1) {
        const slot = plan.pageSlots[pageNumber - 1];
        const src = slot.kind === 'blank'
          ? await renderBlankPageImage(pageBoxWidth, PAGE_H)
          : await renderPageImage(
            pdfDoc,
            slot.sourcePage,
            pageBoxWidth,
            PAGE_H,
            undefined,
            undefined,
            spineGapPx / 2,
          );
        if (cancelled) {
          revokeImageUrls([src]);
          revokeImageUrls(lowResUrls);
          lowResImagesRef.current = null;
          return;
        }
        lowResUrls.push(src);
        await preloadImage(src);
        if (cancelled) {
          revokeImageUrls(lowResUrls);
          return;
        }
      }
      const lastUrl = await renderVirtualPageImage(pageBoxWidth, PAGE_H);
      if (cancelled) {
        revokeImageUrls([lastUrl]);
        revokeImageUrls(lowResUrls);
        lowResImagesRef.current = null;
        return;
      }
      lowResUrls.push(lastUrl);
      await preloadImage(lastUrl);

      if (cancelled) {
        revokeImageUrls(lowResUrls);
        return;
      }

      lowResImagesRef.current = lowResUrls;

      const host = document.createElement('div');
      host.className = 'flipbook-host';
      stage.replaceChildren(host);

      pageFlip = new PageFlip(host, {
        width: pageBoxWidth,
        height: PAGE_H,
        size: 'stretch',
        minWidth: 120,
        maxWidth: PAGE_W * 4,
        minHeight: 170,
        maxHeight: PAGE_H * 4,
        autoSize: true,
        usePortrait: false,
        showCover: false,
        drawShadow: true,
        flippingTime: 1000,
        maxShadowOpacity: 0.5,
        mobileScrollSupport: false,
      });
      pageFlipRef.current = pageFlip;
      pageFlip.loadFromImages(lowResUrls);
      applyIntegerPageGeometry(pageFlip, spineGap);
      activeQualityRef.current = 'low';
      softenBookShadow(pageFlip);
      useDesktopCanvas(pageFlip);
      const flipPages = pageFlip.getPageCollection()?.getPages() || [];
      markVirtualPages(pageFlip);
      hideBoundaryOuterShadow(pageFlip);
      pageFlip.getUI()?.update();
      pageFlip.on('resize', () => pageFlip.getUI()?.update());

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
      revokeImageUrls(lowResUrls);
      if (lowResImagesRef.current === lowResUrls) {
        lowResImagesRef.current = null;
      }
    });

    return () => {
      cancelled = true;
      highResRenderTokenRef.current += 1;
      releaseAllPreviewSources();
      if (resizeObserver) resizeObserver.disconnect();
      pageFlipRef.current = null;
      if (pageFlip) pageFlip.destroy();
      stage.replaceChildren();
    };
  }, [pdfDoc, plan, spineGap, releaseAllPreviewSources]);

  useEffect(() => {
    const onKey = (event) => {
      const pageFlip = pageFlipRef.current;
      if (!pageFlip || flipping || highResRender.active) return;
      if (event.key === 'ArrowLeft') pageFlip.flipPrev('top');
      if (event.key === 'ArrowRight') pageFlip.flipNext('top');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipping, highResRender.active]);

  const handleFullscreenChange = useCallback(() => {
    const isFullscreen = document.fullscreenElement === viewBlockRef.current;
    setIsFullscreen(isFullscreen);

    if (isFullscreen) {
      cancelPendingDowngrade();
      if (highResReleaseTimerRef.current) {
        window.clearTimeout(highResReleaseTimerRef.current);
        highResReleaseTimerRef.current = null;
      }
      applyRetainedHighRes();
      return;
    }

    cancelHighResRender();
    scheduleDowngradeAfterFullscreenExit();
  }, [
    applyRetainedHighRes,
    cancelHighResRender,
    cancelPendingDowngrade,
    scheduleDowngradeAfterFullscreenExit,
  ]);

  useEffect(() => {
    const onFullscreenChange = () => handleFullscreenChange();

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [handleFullscreenChange]);

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

    const targetPage = targetIndex * 2;
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

  const toggleFullscreen = async () => {
    const viewBlock = viewBlockRef.current;
    if (!viewBlock) return;

    if (document.fullscreenElement === viewBlock) {
      await document.exitFullscreen();
      return;
    }

    await viewBlock.requestFullscreen();
  };

  const startHighResRender = useCallback(async () => {
    const shell = shellRef.current;
    const pageFlip = pageFlipRef.current;
    if (!shell || !pageFlip || !pdfDoc || !plan) return;

    const target = getHighResRenderTarget(shell, spineGap);
    if (!target) return;

    const renderKey = [
      plan.originalPageCount,
      plan.total,
      plan.blankPositions.join('-'),
      target.width,
      target.height,
    ].join(':');
    if (highResRenderKeyRef.current === renderKey) {
      if (activeQualityRef.current === 'high' || highResStateRef.current === 'rendering') return;

      if (highResImagesRef.current && highResStateRef.current === 'retained') {
        applyRetainedHighRes();
        return;
      }

      highResRenderKeyRef.current = '';
    }

    const token = highResRenderTokenRef.current + 1;
    highResRenderTokenRef.current = token;
    highResRenderKeyRef.current = renderKey;
    highResStateRef.current = 'rendering';
    setHighResRender({ active: true, progress: 0, visible: false });

    const showProgressTimer = window.setTimeout(() => {
      if (highResRenderTokenRef.current === token) {
        setHighResRender((current) => (
          current.active ? { ...current, visible: true } : current
        ));
      }
    }, 180);

    let highResUrls = [];
    let previousHighResUrls = null;
    let previousHighResTarget = null;
    let highResUrlsOwned = true;

    try {
      highResUrls = [await renderVirtualPageImage(target.pageWidth, target.height)];
      const totalImages = plan.total + 2;
      let completedImages = 1;

      const reportProgress = () => {
        if (highResRenderTokenRef.current !== token) return;
        setHighResRender((current) => (
          current.active
            ? { ...current, progress: Math.round((completedImages / totalImages) * 100) }
            : current
        ));
      };

      reportProgress();
      for (let pageNumber = 1; pageNumber <= plan.total; pageNumber += 1) {
        const slot = plan.pageSlots[pageNumber - 1];
        const src = slot.kind === 'blank'
          ? await renderBlankPageImage(target.pageWidth, target.height)
          : await renderPageImage(
            pdfDoc,
            slot.sourcePage,
            target.pageWidth,
            target.height,
            1,
            HIGH_RES_JPEG_QUALITY,
            target.gap / 2,
          );
        highResUrls.push(src);
        await preloadImage(src);
        completedImages += 1;
        reportProgress();

        if (highResRenderTokenRef.current !== token) {
          revokeImageUrls(highResUrls);
          return;
        }
      }

      const lastUrl = await renderVirtualPageImage(target.pageWidth, target.height);
      highResUrls.push(lastUrl);
      await preloadImage(lastUrl);
      completedImages += 1;
      reportProgress();

      if (highResRenderTokenRef.current !== token || pageFlipRef.current !== pageFlip) {
        revokeImageUrls(highResUrls);
        return;
      }

      previousHighResUrls = highResImagesRef.current;
      previousHighResTarget = highResTargetRef.current;
      highResImagesRef.current = highResUrls;
      highResTargetRef.current = target;
      activeQualityRef.current = 'high';
      highResStateRef.current = 'applied';

      pageFlip.updateFromImages(highResUrls);
      pageFlip.getUI()?.update();
      markVirtualPages(pageFlip);
      highResUrlsOwned = false;
      if (previousHighResUrls && previousHighResUrls !== highResUrls) {
        window.setTimeout(() => revokeImageUrls(previousHighResUrls), HIGH_RES_SOURCE_RELEASE_DELAY_MS);
      }
      setHighResRender({ active: false, progress: 100, visible: false });
    } catch (error) {
      console.error('Failed to render high-resolution preview:', error);
      if (highResUrlsOwned) {
        if (highResImagesRef.current === highResUrls) {
          if (previousHighResUrls) {
            highResImagesRef.current = previousHighResUrls;
          } else {
            highResImagesRef.current = null;
          }
        }
        revokeImageUrls(highResUrls);
      }

      if (highResStateRef.current === 'rendering') {
        highResStateRef.current = previousHighResUrls ? 'applied' : 'idle';
      }
      if (previousHighResUrls && highResImagesRef.current === previousHighResUrls) {
        highResTargetRef.current = previousHighResTarget;
      }
      if (highResRenderTokenRef.current === token) {
        highResRenderKeyRef.current = '';
        setHighResRender({ active: false, progress: 0, visible: false });
      }
    } finally {
      window.clearTimeout(showProgressTimer);
    }
  }, [applyRetainedHighRes, pdfDoc, plan, spineGap]);

  useEffect(() => {
    if (!isFullscreen || !ready || flipping) return undefined;

    const timer = window.setTimeout(() => {
      startHighResRender();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [flipping, isFullscreen, ready, startHighResRender]);

  return (
    <div className="view-block" ref={viewBlockRef}>
      <div className="view-canvas">
        <div className="flipbook-shell" ref={shellRef}>
          <div className="flipbook-stage" ref={stageRef} />
        </div>
        {highResRender.active && (
          <div
            className={`render-progress-overlay${highResRender.visible ? ' visible' : ''}`}
            role="status"
            aria-live="polite"
          >
            <p>正在渲染高清预览</p>
            <div className="render-progress-track">
              <span style={{ width: `${highResRender.progress}%` }} />
            </div>
            <span className="render-progress-count">{highResRender.progress}%</span>
          </div>
        )}
      </div>

      <div className="view-footer">
        <p className="view-hint">按成册翻阅顺序预览；空白页会保留在打印文件中。</p>
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
              disabled={!ready || flipping || highResRender.active}
            />
            <button
              type="submit"
              className="jump-button"
              disabled={!ready || flipping || highResRender.active || jumpValue === ''}
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
              disabled={!ready || flipping || highResRender.active || index === 0}
              aria-label="上一页"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="pager-count">{index + 1} / {spreadCount}</span>
            <button
              type="button"
              onClick={() => goTo(1)}
              disabled={!ready || flipping || highResRender.active || index === spreadCount - 1}
              aria-label="下一页"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            type="button"
            className="fullscreen-button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? '退出全屏' : '全屏预览'}
            title={isFullscreen ? '退出全屏' : '全屏预览'}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
