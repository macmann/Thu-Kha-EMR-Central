declare module 'pdf-parse' {
  interface PDFParseResult {
    text?: string | null;
  }

  type PDFParse = (data: Buffer) => Promise<PDFParseResult>;

  const pdfParse: PDFParse;
  export = pdfParse;
}
