import { useRef, useState } from 'react';
import { FileUp, ShieldCheck } from 'lucide-react';

export default function Dropzone({ onFile, busy }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function pick(file) {
    if (file) onFile(file);
  }

  return (
    <div className="dropzone-stage">
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
          <FileUp size={28} strokeWidth={1.8} />
        </div>
        {busy ? (
          <p className="dropzone-title">正在解析 PDF…</p>
        ) : (
          <>
            <p className="dropzone-title">拖入 PDF 文件，或点击选择</p>
            <p className="dropzone-hint">支持 100 MB 以内的 PDF，页数不限（超过 300 页处理较慢）</p>
          </>
        )}
      </div>
      <p className="privacy-note">
        <ShieldCheck size={14} strokeWidth={2} />
        文件全程在你的浏览器本地处理，不会上传到任何服务器
      </p>
    </div>
  );
}
