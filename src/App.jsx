import { useState } from 'react';
import { AlertTriangle, BookOpenCheck, Layers, RotateCcw, ShieldCheck, X } from 'lucide-react';
import Dropzone from './components/Dropzone';
import SheetView from './components/SheetView';
import FlipView from './components/FlipView';
import ExportPanel from './components/ExportPanel';
import { buildBookletPlan, MAX_SPINE_GAP_MM, normalizeSpineGap } from './lib/booklet';
import { loadPdfDoc } from './lib/pdfjs';
import { baseName, buildExportPdf } from './lib/exportPdf';

const MAX_SIZE = 100 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function App() {
  const [status, setStatus] = useState('idle'); // idle | parsing | ready
  const [error, setError] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [plan, setPlan] = useState(null);
  const [spineGap, setSpineGap] = useState(0);
  const [blankInputs, setBlankInputs] = useState([]);
  const [view, setView] = useState('flip');
  const [exportMode, setExportMode] = useState('duplex');
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(null);

  function reset() {
    pdfDoc?.destroy?.();
    setStatus('idle');
    setError(null);
    setFileMeta(null);
    setBytes(null);
    setPdfDoc(null);
    setPlan(null);
    setSpineGap(0);
    setBlankInputs([]);
    setExportDone(null);
  }

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setExportDone(null);
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    if (!isPdf) {
      setError('仅支持 PDF 文件');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('文件超过 100 MB，请先拆分后再试');
      return;
    }
    setStatus('parsing');
    pdfDoc?.destroy?.();
    setPdfDoc(null);
    try {
      const buf = await file.arrayBuffer();
      const exportBytes = new Uint8Array(buf.slice(0));
      const previewBytes = new Uint8Array(buf.slice(0));
      const doc = await loadPdfDoc(previewBytes);
      setBytes(exportBytes);
      setPdfDoc(doc);
      setFileMeta({ name: file.name, size: file.size });
      const nextPlan = buildBookletPlan(doc.numPages);
      setPlan(nextPlan);
      setSpineGap(0);
      setBlankInputs(nextPlan.blankPositions.map(String));
      setView('flip');
      setStatus('ready');
    } catch (err) {
      if (err?.name === 'PasswordException') {
        setError('该 PDF 已加密，请先解密后再试');
      } else {
        setError('文件无法读取，请确认文件未损坏');
      }
      setStatus('idle');
    }
  }

  async function handleExport() {
    if (!bytes || !plan || exporting) return;
    setExporting(true);
    setError(null);
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
        const data = await buildExportPdf(bytes, plan, 'duplex', spineGap);
        download(data, `${base}-booklet-duplex.pdf`);
      } else {
        const front = await buildExportPdf(bytes, plan, 'front', spineGap);
        download(front, `${base}-booklet-front.pdf`);
        await new Promise((r) => setTimeout(r, 600));
        const back = await buildExportPdf(bytes, plan, 'back', spineGap);
        download(back, `${base}-booklet-back.pdf`);
      }
      setExportDone(exportMode);
    } catch (err) {
      setError(`导出失败：${err?.message || '未知错误'}`);
    } finally {
      setExporting(false);
    }
  }

  const ready = status === 'ready' && plan && pdfDoc;

  function handleBlankPositionChange(index, event) {
    const value = event.target.value;
    setBlankInputs((current) => current.map((item, itemIndex) => (
      itemIndex === index ? value : item
    )));
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

    const nextPositions = plan.blankPositions.map((position, positionIndex) => (
      positionIndex === index ? parsedPosition : position
    ));
    const nextPlan = buildBookletPlan(plan.originalPageCount, nextPositions);
    setPlan(nextPlan);
    setBlankInputs((current) => current.map((item, itemIndex) => (
      itemIndex === index ? String(parsedPosition) : item
    )));
    setExportDone(null);
  }

  function handleSpineGapChange(event) {
    const value = event.target.value;
    setSpineGap(value === '' ? '' : Number(value));
  }

  function commitSpineGap() {
    setSpineGap((current) => normalizeSpineGap(current));
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <BookOpenCheck size={18} strokeWidth={2} />
          </div>
          <div className="brand-text">
            <span className="brand-name">Booklet Press</span>
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
        <Dropzone onFile={handleFile} busy={status === 'parsing'} />
      ) : (
        <main className="workspace">
          <aside className="sidebar">
            <section className="card">
              <div className="file-row">
                <div className="file-info">
                  <span className="file-name" title={fileMeta.name}>{fileMeta.name}</span>
                  <span className="file-size">{formatSize(fileMeta.size)}</span>
                </div>
                <button type="button" className="btn-ghost" onClick={reset}>
                  <RotateCcw size={13} />
                  换文件
                </button>
              </div>
              <div className="stat-grid">
                <div className="stat">
                  <span className="stat-label">原始页数</span>
                  <span className="stat-value">{plan.originalPageCount}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">总页数</span>
                  <span className="stat-value">{plan.total}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">A4 纸张</span>
                  <span className="stat-value">{plan.sheets} 张</span>
                </div>
                <div className="stat stat-wide">
                  <span className="stat-label">书脊间距</span>
                  <div className="stat-input-group">
                    <input
                      className="stat-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={MAX_SPINE_GAP_MM}
                      step="0.5"
                      value={spineGap}
                      aria-label="书脊间距"
                      title="折页处两页内容之间预留的折叠区域宽度"
                      onChange={handleSpineGapChange}
                      onBlur={commitSpineGap}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                      }}
                    />
                    <span className="stat-suffix">mm</span>
                  </div>
                </div>
              </div>
              {plan.blankCount > 0 && (
                <div className="blank-position-list">
                  {plan.blankPositions.map((position, index) => (
                    <div className="blank-position-row" key={`${position}-${index}`}>
                      <label className="stat-label" htmlFor={`blank-position-${index}`}>
                        空白页 {index + 1}
                      </label>
                      <div className="blank-input-group">
                        <input
                          id={`blank-position-${index}`}
                          className="blank-input"
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max={plan.total}
                          step="1"
                          value={blankInputs[index] ?? String(position)}
                          onChange={(event) => handleBlankPositionChange(index, event)}
                          onBlur={() => commitBlankPosition(index)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur();
                          }}
                          title="作为成册后的第 N 页"
                        />
                        <span className="stat-suffix">页</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {plan.blankCount > 0 && (
                <p className="warn-note">
                  <AlertTriangle size={13} />
                  已自动补充 {plan.blankCount} 页空白
                </p>
              )}
              {plan.originalPageCount > 300 && (
                <p className="warn-note">
                  <AlertTriangle size={13} />
                  页数较多，解析和导出可能较慢，请耐心等待
                </p>
              )}
            </section>

            <ExportPanel
              plan={plan}
              exportMode={exportMode}
              onModeChange={setExportMode}
              onExport={handleExport}
              exporting={exporting}
              exportDone={exportDone}
            />
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
              <SheetView pdfDoc={pdfDoc} plan={plan} spineGap={spineGap} />
            ) : (
              <FlipView pdfDoc={pdfDoc} plan={plan} spineGap={spineGap} />
            )}
          </section>
        </main>
      )}
    </div>
  );
}
