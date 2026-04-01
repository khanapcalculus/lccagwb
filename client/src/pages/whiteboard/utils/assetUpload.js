import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const createImageStroke = ({ uid, src, imageWidth, imageHeight, x, y, id }) => ({
  tool: 'image',
  src,
  imageWidth,
  imageHeight,
  points: [{ x, y }],
  uid,
  id,
});

export const buildAssetStrokes = async ({ file, viewportWidth, viewportHeight, viewportOffset, uid }) => {
  const centerX = viewportWidth / 2 - viewportOffset.x;
  const startY = 48 - viewportOffset.y;

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const bytes = await file.arrayBuffer();
    const pdf = await getDocument({ data: bytes }).promise;

    if (pdf.numPages > 10) {
      throw new Error('PDF upload is limited to 10 pages.');
    }

    const strokes = [];
    let currentY = startY;
    const baseId = Date.now();

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const rawViewport = page.getViewport({ scale: 1 });
      const targetScale = Math.min(
        (viewportWidth * 0.72) / rawViewport.width,
        (viewportHeight * 0.78) / rawViewport.height,
        1.4
      );
      const pageViewport = page.getViewport({ scale: targetScale });
      const renderCanvas = document.createElement('canvas');
      const renderCtx = renderCanvas.getContext('2d');
      renderCanvas.width = pageViewport.width;
      renderCanvas.height = pageViewport.height;
      await page.render({ canvasContext: renderCtx, viewport: pageViewport }).promise;
      const src = renderCanvas.toDataURL('image/png');

      strokes.push(createImageStroke({
        uid,
        src,
        imageWidth: pageViewport.width,
        imageHeight: pageViewport.height,
        x: centerX - pageViewport.width / 2,
        y: currentY,
        id: baseId + pageNumber,
      }));

      currentY += pageViewport.height + 28;
    }

    return strokes;
  }

  const src = await readFileAsDataUrl(file);
  if (typeof src !== 'string') return [];

  const image = await loadImage(src);
  const maxWidth = Math.min(420, viewportWidth * 0.6);
  const maxHeight = Math.min(320, viewportHeight * 0.6);
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;

  return [createImageStroke({
    uid,
    src,
    imageWidth,
    imageHeight,
    x: centerX - imageWidth / 2,
    y: viewportHeight / 2 - imageHeight / 2 - viewportOffset.y,
    id: Date.now(),
  })];
};
