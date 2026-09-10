import * as pdfjsLib from 'pdfjs-dist';
import workerSource from 'pdfjs-dist/build/pdf.worker.min.mjs?raw';

const workerUrl = typeof Blob !== 'undefined' && typeof URL !== 'undefined'
  ? URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))
  : null;

let fakeWorkerPromise;

if (workerUrl) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

export async function loadPdfDoc(bytes) {
  try {
    return await pdfjsLib.getDocument({ data: bytes }).promise;
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    const workerError = message.includes('worker') || message.includes('fake worker');
    if (!workerError) throw error;

    if (!workerUrl) throw error;
    fakeWorkerPromise ??= import(workerUrl).then((workerModule) => {
      globalThis.pdfjsWorker = workerModule;
      return workerModule;
    });
    await fakeWorkerPromise;
    return pdfjsLib.getDocument({ data: bytes }).promise;
  }
}
