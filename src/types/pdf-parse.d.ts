declare module 'pdf-parse/lib/pdf-parse.js' {
  import type { PDFData } from 'pdf-parse';

  type PdfParse = (data: Buffer) => Promise<PDFData>;

  const pdfParse: PdfParse;
  export default pdfParse;
}
