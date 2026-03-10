declare module 'pdf-parse' {
  function pdfParse(
    dataBuffer: Buffer,
    options?: { pagerender?: (pageData: unknown) => string }
  ): Promise<{ text: string; numpages: number; info?: unknown }>;
  export default pdfParse;
}
