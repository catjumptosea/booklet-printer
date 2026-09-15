import { useRef, useState } from 'react';
import { Segmented } from 'antd';
import { AlertTriangle, Columns2, FileUp, Loader2, RotateCcw, Scissors, ShieldCheck } from 'lucide-react';

export default function Dropzone({
  onFile,
  busy,
  uploadMode,
  onUploadModeChange,
  splitStatus,
  splitProgress,
  splitError,
  onSplitReset,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function pick(file) {
    if (file) onFile(file);
  }

  function renderWideDemoPage(leftLabel = '前页', rightLabel = '后页') {
    return (
      <div className="split-demo-page split-demo-wide">
        {leftLabel && <span className="split-demo-side-label split-demo-left">{leftLabel}</span>}
        <span className="split-demo-cut">
          <Scissors size={13} strokeWidth={2} />
        </span>
        {rightLabel && <span className="split-demo-side-label split-demo-right">{rightLabel}</span>}
      </div>
    );
  }

  return (
    <div className="dropzone-stage">
      <div className="upload-path-selector">
        <Segmented
          block
          className="upload-mode-segmented soft-segmented"
          value={uploadMode}
          onChange={onUploadModeChange}
          aria-label="上传方式"
          options={[
            {
              value: 'direct',
              disabled: busy,
              label: (
                <span className="upload-mode-option">
                  <FileUp size={14} strokeWidth={2} />
                  单页文档
                </span>
              ),
            },
            {
              value: 'double',
              disabled: busy,
              label: (
                <span className="upload-mode-option">
                  <Columns2 size={14} strokeWidth={2} />
                  双页文档
                </span>
              ),
            },
            {
              value: 'split',
              disabled: busy,
              label: (
                <span className="upload-mode-option">
                  <Scissors size={14} strokeWidth={2} />
                  混合文档
                </span>
              ),
            },
          ]}
        />
      </div>

      <div
        className={`dropzone${dragging ? ' dragging' : ''}${busy ? ' busy' : ''}`}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="dropzone-icon">
          {uploadMode === 'split' ? (
            <Scissors size={28} strokeWidth={1.8} />
          ) : uploadMode === 'double' ? (
            <Columns2 size={28} strokeWidth={1.8} />
          ) : (
            <FileUp size={28} strokeWidth={1.8} />
          )}
        </div>
        {busy ? (
          <p className="dropzone-title">正在处理 PDF…</p>
        ) : (
          <>
            <p className="dropzone-title">拖入 PDF 文件，或点击选择</p>
            <p className="dropzone-hint">支持 100 MB 以内的 PDF，页数不限（超过 300 页处理较慢）</p>
          </>
        )}
      </div>

      {uploadMode === 'direct' && (
        <div className="split-tool active">
          <div className="split-tool-header">
            <FileUp size={15} strokeWidth={2} />
            <span className="split-tool-name">适合的文档：</span>
          </div>
          <div className="split-demo" aria-hidden="true">
            <div className="split-demo-page split-demo-square">
              <span className="split-demo-square-label">封面</span>
            </div>
            <div className="split-demo-page split-demo-square">
              <span className="split-demo-square-label">1</span>
            </div>
            <div className="split-demo-page split-demo-square">
              <span className="split-demo-square-label">2</span>
            </div>
            <div className="split-demo-page split-demo-square">
              <span className="split-demo-square-label">3</span>
            </div>
            <div className="split-demo-page split-demo-square">
              <span className="split-demo-square-label">封底</span>
            </div>
          </div>
          <ul className="split-rules">
            <li>适合每页 PDF 仅有一页书籍内容的 PDF 文件</li>
            <li>请保证页面阅读方向正确，页面若旋转或倒置，可能影响拆分和排版方向</li>
            <li>当页数不是 4 的倍数时会自动补充空白页，并可在工作区调整空白页位置</li>
          </ul>
        </div>
      )}

      {uploadMode === 'double' && splitStatus === 'idle' && (
        <div className="split-tool active">
          <div className="split-tool-header">
            <Columns2 size={15} strokeWidth={2} />
            <span className="split-tool-name">适合的文档：</span>
          </div>
          <div className="split-demo" aria-hidden="true">
            {renderWideDemoPage('封面', '封底')}
            {renderWideDemoPage('1', '2')}
            {renderWideDemoPage('3', '4')}
            {renderWideDemoPage('5', '6')}
            {renderWideDemoPage('7', '8')}
          </div>
          <ul className="split-rules">
            <li>适合每页都是一张完整的左右双页的 PDF 文件</li>
            <li>第一个对开页为封面与封底，其余页面按左页、右页顺序</li>
            <li>请保证页面阅读方向正确，页面若旋转或倒置，可能影响拆分和排版方向</li>
          </ul>
        </div>
      )}

      {uploadMode === 'split' && splitStatus === 'idle' && (
        <div className="split-tool active">
          <div className="split-tool-header">
            <Scissors size={15} strokeWidth={2} />
            <span className="split-tool-name">适合的文档：</span>
          </div>
          <div className="split-demo" aria-hidden="true">
            <div className="split-demo-page split-demo-square">
              <span className="split-demo-square-label">封面</span>
            </div>
            {renderWideDemoPage('1', '2')}
            <div className="split-demo-page split-demo-square">
              <span className="split-demo-square-label">3</span>
            </div>
            {renderWideDemoPage('4', '5')}
            <div className="split-demo-page split-demo-square">
              <span className="split-demo-square-label">封底</span>
            </div>
          </div>
          <ul className="split-rules">
            <li>适合混杂了单页和双页的内容的PDF文件</li>
            <li>程序会根据页面尺寸拆分：宽高比 ≥ 1.5 的宽页自动拆成前页、后页，并参考文档内单页宽度识别其他对开页</li>
            <li>请保证页面阅读方向正确，页面若旋转或倒置，可能影响拆分和排版方向</li>
          </ul>
        </div>
      )}

      {(uploadMode === 'split' || uploadMode === 'double') && splitStatus === 'processing' && (
        <div className="split-tool active">
          <div className="split-tool-status">
            <Loader2 size={14} className="spin" />
            <span>{splitProgress || '正在拆分…'}</span>
          </div>
        </div>
      )}

      {(uploadMode === 'split' || uploadMode === 'double') && splitStatus === 'error' && (
        <div className="split-tool active">
          <div className="split-tool-status split-tool-error">
            <AlertTriangle size={14} />
            <span>{splitError}</span>
          </div>
          <div className="split-tool-actions">
            <button type="button" onClick={onSplitReset} className="btn-ghost">
              <RotateCcw size={13} />
              重新上传
            </button>
          </div>
        </div>
      )}

      <p className="privacy-note">
        <ShieldCheck size={14} strokeWidth={2} />
        文件全程在你的浏览器本地处理，不会上传到任何服务器
      </p>
    </div>
  );
}
