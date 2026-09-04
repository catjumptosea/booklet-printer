import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export function loadPdfDoc(bytes) {
  const task = pdfjsLib.getDocument({ data: bytes });
  return task.promise;
}
