# Office Utilities Example

Document processing utilities demonstrating:

- Document parsing (DOCX, RTF, TXT, HTML)
- Spreadsheet parsing (XLSX, CSV)
- PDF extraction and viewing
- Image metadata extraction and storage

## Structure

```
office-utilities/
├── bundle.yaml
├── config/
│   └── config.json
└── src/
    ├── api/
    │   ├── parse-document.ts
    │   ├── parse-spreadsheet.ts
    │   ├── generate-pdf.ts
    │   └── process-image.ts
    └── ui/
        ├── document-editor.ts
        ├── spreadsheet-viewer.ts
        └── image-gallery.ts
```

## Workflow Steps

1. **Document Editor** (`/documents`) - Parse and edit documents
2. **Spreadsheet Viewer** (`/spreadsheets`) - View spreadsheet data
3. **PDF Extractor** (`/pdf`) - Extract text and metadata from PDFs
4. **Image Gallery** (`/images`) - Extract metadata and store images

## Key Concepts Demonstrated

### Document Parsing

```typescript
// parse(buffer: ArrayBuffer, format: DocumentFormat)
// DocumentFormat: 'docx' | 'rtf' | 'html' | 'txt'
const parsed = await sdk.utilities.documents.parse(fileBuffer, 'docx');
// Returns: { html, text, metadata, messages }
```

### Spreadsheet Parsing

```typescript
// parse(buffer: ArrayBuffer, format: SpreadsheetFormat)
// SpreadsheetFormat: 'xlsx' | 'xls' | 'csv' | 'ods'
const parsed = await sdk.utilities.spreadsheets.parse(fileBuffer, 'xlsx');
// Returns: { sheets: [{ name, data, headers, rowCount, columnCount }], metadata }
```

### PDF Extraction

```typescript
// Extract text and metadata from PDF files
const extracted = await sdk.utilities.pdfs.extractPages(pdfBuffer);
// Returns: { pages: [{ pageNumber, text, width, height }], metadata }

// Validate a PDF buffer
const isValid = sdk.utilities.pdfs.isValidPdf(pdfBuffer);

// Convert to base64 for client-side rendering
const base64 = sdk.utilities.pdfs.toBase64(pdfBuffer);
```

### Image Metadata

```typescript
// Get image metadata (dimensions, format, etc.)
const metadata = await sdk.utilities.images.getMetadata(imageBuffer);
// Returns: { format, width, height, size, hasAlpha }

// Detect format from buffer
const format = sdk.utilities.images.detectFormat(imageBuffer);

// Convert to data URL for preview
const dataUrl = sdk.utilities.images.toDataUrl(imageBuffer, format);
```
