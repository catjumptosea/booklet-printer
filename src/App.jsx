import { useEffect, useRef, useState } from 'react';
import { Alert, Dropdown, InputNumber, message, Segmented, Tooltip } from 'antd';
import { AlertTriangle, BookOpenCheck, Columns2, FileUp, Info, Layers, Loader2, RotateCcw, Scissors, ShieldCheck, X } from 'lucide-react';
import 'antd/dist/reset.css';
import packageJson from '../package.json';
import Dropzone from './components/Dropzone';
import SheetView from './components/SheetView';
import FlipView from './components/FlipView';
import ExportPanel from './components/ExportPanel';
import {
  BOOKLET_FORMATS,
  buildBookletPlan,
  DEFAULT_BOOKLET_FORMAT,
  DEFAULT_PAPER_SIZE,
  MAX_SPINE_GAP_MM,
  normalizeBookletFormat,
  normalizePaperSize,
  normalizeSpineGap,
  PAPER_SIZES,
} from './lib/booklet';
import { loadPdfDoc } from './lib/pdfjs';
import { baseName, buildExportPdf } from './lib/exportPdf';
import { processSplitScan } from './lib/splitScan';
import { processDoublePageScan } from './lib/doublePageScan';

const MAX_SIZE = 100 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function App() {
  const changeFileInputRef = useRef(null);
  const fileTokenRef = useRef(0);
  const lastPdfDocRef = useRef(null);

  function disposeDoc(doc) {
    try {
      const disposed = doc?.destroy?.();
      disposed?.catch?.(() => {});
    } catch {
      // ignore dispose errors
    }
  }
  const [status, setStatus] = useState('idle'); // idle | parsing | ready
  const [error, setError] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [plan, setPlan] = useState(null);
  const [paperSize, setPaperSize] = useState('a4');
  const [bookletFormat, setBookletFormat] = useState(DEFAULT_BOOKLET_FORMAT);
  const [spineGap, setSpineGap] = useState(0);
  const [spineGapDraft, setSpineGapDraft] = useState(0);
  const [blankInputs, setBlankInputs] = useState([]);
  const [view, setView] = useState('flip');
  const [exportMode, setExportMode] = useState('duplex');
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(null);
  const [changingFile, setChangingFile] = useState(false);
  const [uploadMode, setUploadMode] = useState('direct'); // direct | split | double
  const [splitStatus, setSplitStatus] = useState('idle'); // idle | processing | error
  const [splitProgress, setSplitProgress] = useState('');
  const [replaceProgress, setReplaceProgress] = useState('');
  const [splitError, setSplitError] = useState(null);
  const [sourceIsSplit, setSourceIsSplit] = useState(false);
  const replaceModeRef = useRef('direct');
  const activeSpineGap = normalizeSpineGap(spineGap);
  const activePaperSize = normalizePaperSize(paperSize);
  const activeBookletFormat = activePaperSize === 'a4'
    ? normalizeBookletFormat(bookletFormat)
    : 'a5';
  const activePaper = PAPER_SIZES[activePaperSize];

  function resetWorkspaceSettings() {
    setPaperSize(DEFAULT_PAPER_SIZE);
    setBookletFormat(DEFAULT_BOOKLET_FORMAT);
    setSpineGap(0);
    setSpineGapDraft(0);
    setView('flip');
    setExportMode('duplex');
    setExportDone(null);
  }

  function clearSplitSource() {
    setSourceIsSplit(false);
  }

  function handleBackToUpload() {
    fileTokenRef.current += 1;
    const currentDoc = lastPdfDocRef.current;
    if (currentDoc) {
      disposeDoc(currentDoc);
    }
    lastPdfDocRef.current = null;
    setStatus('idle');
    setError(null);
    setFileMeta(null);
    setBytes(null);
    setPdfDoc(null);
    setPlan(null);
    setBlankInputs([]);
    setChangingFile(false);
    resetWorkspaceSettings();
    setSplitStatus('idle');
    setSplitProgress('');
    setReplaceProgress('');
    setSplitError(null);
    clearSplitSource();
  }

  async function handleFile(file, mode = uploadMode) {
    if (!file) return;
    if (mode === 'split' || mode === 'double') {
      await handleSplitFile(file, Boolean(pdfDoc && plan), mode);
      return;
    }
    const isReplacement = Boolean(pdfDoc && plan);
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    if (!isPdf) {
      setError('仅支持 PDF 文件');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('文件超过 100 MB，请先拆分后再试');
      return;
    }

    const token = ++fileTokenRef.current;
    resetWorkspaceSettings();
    setError(null);
    setExportDone(null);
    if (isReplacement) {
      setChangingFile(true);
    } else {
      setStatus('parsing');
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (token !== fileTokenRef.current) return;
      const doc = await loadPdfDoc(bytes.slice());
      if (token !== fileTokenRef.current) {
        disposeDoc(doc);
        return;
      }

      const previousDoc = lastPdfDocRef.current;
      if (previousDoc && previousDoc !== doc) {
        disposeDoc(previousDoc);
      }
      lastPdfDocRef.current = doc;
      setBytes(bytes);
      setPdfDoc(doc);
      setFileMeta({ name: file.name, size: file.size });
      const nextPlan = buildBookletPlan(
        doc.numPages,
        undefined,
        DEFAULT_BOOKLET_FORMAT,
      );
      setPlan(nextPlan);
      setBlankInputs(nextPlan.blankPositions.map(String));
      setBookletFormat(nextPlan.format);
      clearSplitSource();
      setStatus('ready');
    } catch (err) {
      if (token !== fileTokenRef.current) return;
      if (err?.name === 'PasswordException') {
        setError('该 PDF 已加密，请先解密后再试');
      } else {
        setError('文件无法读取，请确认文件未损坏');
      }
      if (!isReplacement) {
        setStatus('idle');
      }
    } finally {
      if (token === fileTokenRef.current) {
        setChangingFile(false);
      }
    }
  }

  async function handleSplitFile(file, fromWorkspace, processMode = 'split') {
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    if (!isPdf) {
      if (fromWorkspace) setError('仅支持 PDF 文件');
      else {
        setSplitError('仅支持 PDF 文件');
        setSplitStatus('error');
      }
      return;
    }
    if (file.size > MAX_SIZE) {
      if (fromWorkspace) setError('文件超过 100 MB，请先拆分后再试');
      else {
        setSplitError('文件超过 100 MB，请先拆分后再试');
        setSplitStatus('error');
      }
      return;
    }

    const token = ++fileTokenRef.current;
    if (fromWorkspace) {
      setChangingFile(true);
      setError(null);
    } else {
      setSplitStatus('processing');
      setSplitError(null);
    }
    setSplitProgress('');
    setReplaceProgress('');

    try {
      const originalBytes = new Uint8Array(await file.arrayBuffer());
      if (token !== fileTokenRef.current) return;
      const processor = processMode === 'double' ? processDoublePageScan : processSplitScan;
      const { blob, info } = await processor(originalBytes, ({ phase, current, total }) => {
        if (token !== fileTokenRef.current) return;
        if (phase === 'validate') {
          setSplitProgress(`正在检查第 ${current} / ${total} 页`);
          if (fromWorkspace) setReplaceProgress(`${current}/${total}页`);
        } else if (phase === 'process') {
          setSplitProgress(`正在处理第 ${current} / ${total} 页`);
          if (fromWorkspace) setReplaceProgress(`${current}/${total}页`);
        } else if (phase === 'build') {
          setSplitProgress('正在生成 PDF');
        }
      });
      if (token !== fileTokenRef.current) return;
      const resultBytes = new Uint8Array(await blob.arrayBuffer());
      const doc = await loadPdfDoc(resultBytes.slice());
      if (token !== fileTokenRef.current) {
        disposeDoc(doc);
        return;
      }

      const previousDoc = lastPdfDocRef.current;
      if (previousDoc && previousDoc !== doc) {
        disposeDoc(previousDoc);
      }
      lastPdfDocRef.current = doc;

      resetWorkspaceSettings();
      setBytes(resultBytes);
      setPdfDoc(doc);
      setFileMeta({ name: file.name, size: originalBytes.length });
      const nextPlan = buildBookletPlan(
        doc.numPages,
        undefined,
        DEFAULT_BOOKLET_FORMAT,
      );
      setPlan(nextPlan);
      setBlankInputs(nextPlan.blankPositions.map(String));
      setBookletFormat(nextPlan.format);
      setStatus('ready');
      setSourceIsSplit(true);
      const successText = processMode === 'double' ? '双页拆分完成' : '拆分完成';
      message.success(`${successText}：${info.originalPages} 页 → ${info.resultPages} 页`);
      setSplitStatus('idle');
      setSplitProgress('');
      setSplitError(null);
    } catch (err) {
      if (token !== fileTokenRef.current) return;
      const isPasswordError = err?.name === 'PasswordException'
        || /encrypted|password/i.test(err?.message || '');
      const message = isPasswordError
        ? '该 PDF 已加密，请先解密后再试'
        : (err?.message || '处理失败，请重试');
      if (fromWorkspace) {
        setError(message);
      } else {
        setSplitError(message);
        setSplitStatus('error');
      }
    } finally {
      if (token === fileTokenRef.current && fromWorkspace) {
        setChangingFile(false);
        setReplaceProgress('');
      }
    }
  }

  function handleSplitReset() {
    setSplitStatus('idle');
    setSplitProgress('');
    setSplitError(null);
  }

  function handleUploadModeChange(mode) {
    setUploadMode(mode);
    handleSplitReset();
  }

  function handleReplaceOption(mode) {
    replaceModeRef.current = mode;
    changeFileInputRef.current?.click();
  }

  async function handleExport() {
    if (!bytes || !plan || exporting) return;
    setExporting(true);
    setError(null);
    setExportDone(null);
    const exportBytes = bytes.slice();
    const exportPlan = structuredClone(plan);
    const exportOptions = {
      paperSize: activePaperSize,
      bookletFormat: activeBookletFormat,
    };
    const download = (data, name) => {
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    try {
      const base = baseName(fileMeta.name);
      if (exportMode === 'duplex') {
        const data = await buildExportPdf(exportBytes, exportPlan, 'duplex', activeSpineGap, exportOptions);
        download(data, `${base}-小册子-${activeBookletFormat.toUpperCase()}-自动双面.pdf`);
      } else {
        const front = await buildExportPdf(exportBytes, exportPlan, 'front', activeSpineGap, exportOptions);
        download(front, `${base}-小册子-${activeBookletFormat.toUpperCase()}-正面.pdf`);
        await new Promise((r) => setTimeout(r, 600));
        const back = await buildExportPdf(exportBytes, exportPlan, 'back', activeSpineGap, exportOptions);
        download(back, `${base}-小册子-${activeBookletFormat.toUpperCase()}-反面.pdf`);
      }
      setExportDone(exportMode);
    } catch (err) {
      setError(`导出失败：${err?.message || '未知错误'}`);
    } finally {
      setExporting(false);
    }
  }

  const ready = status === 'ready' && plan && pdfDoc;

  function handleBlankPositionChange(index, value) {
    const nextValue = value == null ? '' : String(value);
    setBlankInputs((current) => {
      if (current[index] === nextValue) return current;
      return current.map((item, itemIndex) => (
        itemIndex === index ? nextValue : item
      ));
    });
  }

  function commitBlankPosition(index) {
    if (!plan) return;
    const parsedPosition = Number(blankInputs[index]);
    const isValid = Number.isInteger(parsedPosition)
      && parsedPosition >= 1
      && parsedPosition <= plan.total
      && !plan.blankPositions.some((position, positionIndex) => (
        positionIndex !== index && position === parsedPosition
      ));

    if (!isValid) {
      setBlankInputs((current) => current.map((item, itemIndex) => (
        itemIndex === index ? String(plan.blankPositions[index]) : item
      )));
      return;
    }

    if (plan.blankPositions[index] === parsedPosition) return;

    const nextPositions = plan.blankPositions.map((position, positionIndex) => (
      positionIndex === index ? parsedPosition : position
    ));
    const nextPlan = buildBookletPlan(plan.sourcePageCount, nextPositions, activeBookletFormat);
    setPlan(nextPlan);
    setBlankInputs((current) => current.map((item, itemIndex) => (
      itemIndex === index ? String(parsedPosition) : item
    )));
    setExportDone(null);
  }

  function handleSpineGapChange(value) {
    const nextValue = value == null ? '' : Number(value);
    setSpineGapDraft((current) => current === nextValue ? current : nextValue);
  }

  function commitSpineGap() {
    const nextValue = normalizeSpineGap(spineGapDraft);
    if (nextValue === spineGap) {
      if (spineGapDraft !== nextValue) setSpineGapDraft(nextValue);
      return;
    }
    setSpineGap(nextValue);
    setSpineGapDraft(nextValue);
    setExportDone(null);
  }

  function handlePaperSizeChange(value) {
    if (value === activePaperSize) return;
    setPaperSize(value);
    const nextBookletFormat = value === 'long' ? 'a5' : normalizeBookletFormat(bookletFormat);
    setBookletFormat(nextBookletFormat);
    if (plan && plan.format !== nextBookletFormat) {
      const nextPlan = buildBookletPlan(plan.sourcePageCount, undefined, nextBookletFormat);
      setPlan(nextPlan);
      setBlankInputs(nextPlan.blankPositions.map(String));
      setSpineGap(0);
      setSpineGapDraft(0);
    }
    setExportDone(null);
  }

  function handleBookletFormatChange(value) {
    if (value === activeBookletFormat || !plan) return;
    setBookletFormat(value);
    const nextPlan = buildBookletPlan(plan.sourcePageCount, undefined, value);
    setPlan(nextPlan);
    setBlankInputs(nextPlan.blankPositions.map(String));
    setExportDone(null);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <button
            type="button"
            className="brand-mark"
            onClick={handleBackToUpload}
            aria-label="返回上传界面"
            title="返回上传界面"
          >
            <BookOpenCheck size={18} strokeWidth={2} />
          </button>
          <div className="brand-text">
            <span className="brand-name">
              Booklet Press <small className="brand-version">v{packageJson.version}</small>
            </span>
            <span className="brand-sub">PDF 小册子打印</span>
          </div>
        </div>
        <div className="topbar-note">
          <ShieldCheck size={14} strokeWidth={2} />
          本地处理 · 文件不上传
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      )}

      {!ready ? (
        <Dropzone
          onFile={(file) => handleFile(file, uploadMode)}
          busy={status === 'parsing' || splitStatus === 'processing'}
          uploadMode={uploadMode}
          onUploadModeChange={handleUploadModeChange}
          splitStatus={splitStatus}
          splitProgress={splitProgress}
          splitError={splitError}
          onSplitReset={handleSplitReset}
        />
      ) : (
        <main className="workspace">
          <aside className="sidebar">
            <section className="card">
              <div className="form-section">
              <div className="file-row">
                <div className="file-info">
                  <span className="file-name" title={fileMeta.name}>{fileMeta.name}</span>
                  <span className="file-meta-line">
                    {sourceIsSplit && <span className="split-badge">已拆分</span>}
                    <span className="file-size">{formatSize(fileMeta.size)}</span>
                  </span>
                </div>
                <input
                  ref={changeFileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(event) => {
                    handleFile(event.target.files?.[0], replaceModeRef.current);
                    event.target.value = '';
                  }}
                />
                <div className="file-row-actions">
                  <Dropdown
                    trigger={['click']}
                    disabled={changingFile || exporting}
                    menu={{
                      items: [
                        { key: 'direct', icon: <FileUp size={13} />, label: '单页文档' },
                        { key: 'double', icon: <Columns2 size={13} />, label: '双页文档' },
                        { key: 'split', icon: <Scissors size={13} />, label: '混合文档' },
                      ],
                      onClick: ({ key }) => handleReplaceOption(key),
                    }}
                  >
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={changingFile || exporting}
                    >
                      {changingFile ? <Loader2 size={13} className="spin" /> : <RotateCcw size={13} />}
                      {changingFile ? (
                        replaceProgress
                          ? <span className="btn-progress-text">{replaceProgress}</span>
                          : '替换中'
                      ) : '换文件'}
                    </button>
                  </Dropdown>
                </div>
              </div>
              <div className="file-meta-strip" aria-label="文件统计">
                <div className="file-meta-item">
                  <span>原始页数</span>
                  <strong>{plan.originalPageCount}</strong>
                </div>
                <div className="file-meta-item">
                  <span>总页数</span>
                  <strong>{plan.total}</strong>
                </div>
                <div className="file-meta-item">
                  <span>{activePaper.label} 纸张</span>
                  <strong>{plan.printedSides}</strong>
                </div>
              </div>
              <div className="stat stat-wide paper-size-stat antd-form-item">
                <span className="stat-label">纸张尺寸</span>
                <Segmented
                  block
                  size="large"
                  className="paper-size-segmented soft-segmented"
                  aria-label="纸张尺寸"
                  value={activePaperSize}
                  onChange={handlePaperSizeChange}
                  options={Object.values(PAPER_SIZES).map((paper) => ({
                    label: <span className="segmented-option"><strong>{paper.label}</strong><small>{paper.sizeText}</small></span>,
                    value: paper.id,
                  }))}
                />
              </div>
              {activePaperSize === 'a4' && (
                <div className="stat stat-wide paper-size-stat antd-form-item">
                  <span className="stat-label">小册子格式</span>
                  <Segmented
                    block
                    size="large"
                    className="paper-size-segmented soft-segmented"
                    aria-label="小册子格式"
                    value={activeBookletFormat}
                    onChange={handleBookletFormatChange}
                    options={Object.values(BOOKLET_FORMATS).map((format) => ({
                      label: <span className="segmented-option segmented-option-simple"><strong>{format.label}</strong></span>,
                      value: format.id,
                    }))}
                  />
                </div>
              )}
              <div className="setting-row spine-row">
                <label className="stat-label-with-help" htmlFor="spine-gap">
                  <span className="stat-label">书脊间距</span>
                  <Tooltip title="折页处两页内容之间预留的折叠区域宽度">
                    <span className="field-help" role="img" aria-label="书脊间距说明">
                      <Info size={13} />
                    </span>
                  </Tooltip>
                </label>
                <InputNumber
                  id="spine-gap"
                  className="stat-input-number"
                  min={0}
                  max={MAX_SPINE_GAP_MM}
                  step={1}
                  value={spineGapDraft === '' ? null : spineGapDraft}
                  aria-label="书脊间距"
                  addonAfter="mm"
                  onChange={handleSpineGapChange}
                  onBlur={commitSpineGap}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitSpineGap();
                    }
                  }}
                />
              </div>
              </div>
              <div className="form-section editable-section legacy-spine-section">
                <div className="stat stat-wide editable-stat">
                  <span className="stat-label">书脊间距</span>
                  <InputNumber
                    className="stat-input-number"
                    min={0}
                    max={MAX_SPINE_GAP_MM}
                    step={1}
                    value={spineGapDraft === '' ? null : spineGapDraft}
                    aria-label="书脊间距"
                    title="折页处两页内容之间预留的折叠区域宽度"
                    addonAfter="mm"
                    onChange={handleSpineGapChange}
                    onBlur={commitSpineGap}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitSpineGap();
                      }
                    }}
                  />
                </div>
              </div>
              {plan.blankCount > 0 && (
                <div className="blank-config">
                  <div className="blank-divider" aria-hidden="true" />
                  <Alert
                    className="blank-config-intro"
                    type="info"
                    showIcon
                    message={`已自动补充 ${plan.blankCount} 页空白页，可调整其作为成册第 N 页的位置。`}
                  />
                <div className="blank-position-list">
                  {plan.blankPositions.map((position, index) => (
                    <div className="blank-position-row" key={`${position}-${index}`}>
                      <label className="stat-label-with-help" htmlFor={`blank-position-${index}`}>
                        <span className="stat-label">空白页 {index + 1}</span>
                        <Tooltip title="输入该空白页作为成册的第 N 页">
                          <span className="field-help" role="img" aria-label="作为成册的第 N 页说明">
                            <Info size={13} />
                          </span>
                        </Tooltip>
                      </label>
                      <div className="blank-input-group">
                        <InputNumber
                          id={`blank-position-${index}`}
                          className="blank-input-number"
                          min={1}
                          max={plan.total}
                          step={1}
                          value={blankInputs[index] ?? position}
                          addonAfter="页"
                          onChange={(value) => handleBlankPositionChange(index, value)}
                          onBlur={() => commitBlankPosition(index)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitBlankPosition(index);
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              )}
              {plan.originalPageCount > 300 && (
                <p className="warn-note">
                  <AlertTriangle size={13} />
                  页数较多，解析和导出可能较慢，请耐心等待
                </p>
              )}
            </section>

          </aside>

          <section className="preview-pane">
            <div className="view-switch" role="tablist" aria-label="预览视图">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'flip'}
                className={view === 'flip' ? 'active' : ''}
                onClick={() => setView('flip')}
              >
                <BookOpenCheck size={14} />
                册子视图
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'sheet'}
                className={view === 'sheet' ? 'active' : ''}
                onClick={() => setView('sheet')}
              >
                <Layers size={14} />
                纸张视图
              </button>
            </div>
            {view === 'sheet' ? (
              <SheetView
                pdfDoc={pdfDoc}
                plan={plan}
                spineGap={activeSpineGap}
                paperSize={activePaperSize}
                bookletFormat={activeBookletFormat}
              />
            ) : (
              <FlipView
                pdfDoc={pdfDoc}
                plan={plan}
                spineGap={activeSpineGap}
                paperSize={activePaperSize}
                bookletFormat={activeBookletFormat}
              />
            )}
          </section>

          <aside className="export-sidebar">
            <ExportPanel
              plan={plan}
              paperSize={activePaperSize}
              bookletFormat={activeBookletFormat}
              exportMode={exportMode}
              onModeChange={setExportMode}
              onExport={handleExport}
              exporting={exporting}
              exportDone={exportDone}
            />
          </aside>
        </main>
      )}
    </div>
  );
}
