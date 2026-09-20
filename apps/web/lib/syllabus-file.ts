import 'server-only';
import { getDocumentProxy } from 'unpdf';
import { SyllabusError, SYLLABUS_MAX_BYTES } from './syllabus-check';

export async function extractSyllabus(file: File) {
  if (!file.size || file.size > SYLLABUS_MAX_BYTES) throw new SyllabusError('Choose a PDF or text file smaller than 2 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = '';
  if (/\.txt$/i.test(file.name) && (!file.type || file.type === 'text/plain')) {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new SyllabusError('This text file could not be read. Upload a UTF-8 text file or a text-based PDF.'); }
    if (text.includes('\0')) throw new SyllabusError('Upload a readable text file or PDF.');
  } else if (/\.pdf$/i.test(file.name) && (!file.type || file.type === 'application/pdf') && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') {
    let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
    try {
      pdf = await getDocumentProxy(bytes.slice(), { useSystemFonts: false });
      if (pdf.numPages > 30) throw new SyllabusError('Please upload a syllabus with no more than 30 pages.');
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        text += content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('') + '\n';
        page.cleanup();
        if (text.length > 100_000) throw new SyllabusError('This syllabus contains too much text. Upload a shorter document.');
      }
    } catch (error) {
      if (error instanceof SyllabusError) throw error;
      throw new SyllabusError('This PDF could not be read. Try an unlocked, text-based PDF or a text file.');
    } finally { await pdf?.loadingTask.destroy(); }
  } else throw new SyllabusError('Upload a PDF or .txt syllabus. Other file types are not supported yet.');
  if (text.trim().length < 80) throw new SyllabusError('We could not find enough readable text. Scanned images are not supported; upload a text-based PDF or .txt syllabus.');
  if (text.length > 100_000) throw new SyllabusError('This syllabus contains too much text. Upload a shorter document.');
  return { text, bytes };
}
