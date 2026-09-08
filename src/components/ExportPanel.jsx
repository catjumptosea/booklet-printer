import { CheckCircle2, Download, Files, Loader2, Printer } from 'lucide-react';
import { PAPER_SIZES } from '../lib/booklet';

export default function ExportPanel({
  plan,
  paperSize = 'a4',
  bookletFormat = 'a5',
  exportMode,
  onModeChange,
  onExport,
  exporting,
  exportDone,
}) {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.a4;
  const isA6 = bookletFormat === 'a6';

  return (
    <section className="card export-card">
      <h3 className="card-title">导出打印文件</h3>
      <div className="mode-switch" role="radiogroup" aria-label="导出模式">
        <button
          type="button"
          role="radio"
          aria-checked={exportMode === 'duplex'}
          className={exportMode === 'duplex' ? 'active' : ''}
          onClick={() => onModeChange('duplex')}
        >
          <Printer size={15} strokeWidth={2} />
          双面打印 · 1 个 PDF
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={exportMode === 'separate'}
          className={exportMode === 'separate' ? 'active' : ''}
          onClick={() => onModeChange('separate')}
        >
          <Files size={15} strokeWidth={2} />
          手动双面 · 2 个 PDF
        </button>
      </div>

      {exportMode === 'duplex' ? (
        <p className="mode-tip">
          页序：纸1正、纸1反、纸2正、纸2反……打印时选择「双面打印 +
          <strong>{isA6 ? '短边翻转' : '短边翻转'}</strong>」，缩放 100%。
        </p>
      ) : (
        <ol className="guide-list">
          <li>先打印「正面文件」：实际大小（100%）、单面打印；</li>
          <li>取出纸张，像翻书一样<strong>左右翻面</strong>（上下方向不变），放回进纸器；</li>
          <li>再打印「反面文件」，设置相同；</li>
          {isA6 ? (
            <li>
              每张 A4 纸<strong>先沿水平中线裁成上下两半</strong>，再沿<strong>短边中线对折</strong>；把上半裁片放进下半裁片，按纸张顺序叠放，从折缝处骑马订。
            </li>
          ) : (
            <li>按纸张顺序叠放，沿中线对折，装订。</li>
          )}
        </ol>
      )}

      <button type="button" className="btn-primary" onClick={onExport} disabled={exporting}>
        {exporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
        {exporting ? '正在生成…' : exportMode === 'duplex' ? '导出双面打印 PDF' : '导出正/反面 2 个 PDF'}
      </button>

      {exportDone && (
        <p className="done-note">
          <CheckCircle2 size={14} />
          已生成并开始下载{exportDone === 'separate' ? '（正面、反面共 2 个文件）' : ''}
        </p>
      )}
      {exportMode === 'separate' && (
        <p className="warn-note">
          不同打印机进纸方向可能不同，建议先用 2 张纸试印；如果反面方向反了，把纸旋转 180 度再放回。
        </p>
      )}
      <p className="export-meta">
        共 {plan.sheets} 张 {paper.label}纸 · {paper.sizeText}
      </p>
    </section>
  );
}
