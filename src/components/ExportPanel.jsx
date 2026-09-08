import { CheckCircle2, Download, Files, Loader2, Printer } from 'lucide-react';
import { PAPER_SIZES } from '../lib/booklet';

export default function ExportPanel({
  plan,
  paperSize = 'a4',
  exportMode,
  onModeChange,
  onExport,
  exporting,
  exportDone,
}) {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.a4;
  const paperLabel = paper.label === 'A4' ? 'A4纸' : paper.label;

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
          <span>自动双面</span>
          <small>1 个 PDF</small>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={exportMode === 'separate'}
          className={exportMode === 'separate' ? 'active' : ''}
          onClick={() => onModeChange('separate')}
        >
          <Files size={15} strokeWidth={2} />
          <span>手动双面</span>
          <small>2 个 PDF</small>
        </button>
      </div>

      {exportMode === 'duplex' ? (
        <div className="mode-tip mode-guide">
          <strong>适合支持自动双面打印的打印机</strong>
          <span>导出为 1 个 PDF 文件，使用机器对应的「双面打印」功能即可，打印机会自动翻面。</span>
        </div>
      ) : (
        <div className="mode-tip mode-guide">
          <strong>适合不支持自动双面打印的打印机</strong>
          <span>导出为 2 个 PDF 文件，先打印“正面”文件，然后将纸张按提示放回纸盒，再打印“反面”文件，完成双面打印。</span>
        </div>
      )}

      <button type="button" className="btn-primary" onClick={onExport} disabled={exporting}>
        {exporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
        {exporting ? '正在生成…' : exportMode === 'duplex' ? '导出双面打印 PDF' : '导出正/反面 2 个 PDF'}
      </button>

      <p className="export-meta">
        共需 {plan.sheets} 张 {paperLabel} · {paper.sizeText}
      </p>

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
    </section>
  );
}
