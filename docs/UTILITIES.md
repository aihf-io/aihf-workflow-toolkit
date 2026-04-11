# Utilities Guide

The AIHF.io Platform SDK provides 9 utility sub-managers on `sdk.utilities` for document processing, signal analysis, UI fragment generation, and more.

## Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          sdk.utilities                                       │
├──────────┬──────────────┬────────┬─────────┬──────────┬──────────┬──────────┤
│documents │ spreadsheets │  pdfs  │ images  │ tensors  │ diagrams │ calendar │
│          │              │        │         │          │          │          │
│ parse    │ parse        │extract │metadata │ analyze  │ create   │monthGrid │
│          │ toCSV        │validate│detect   │ reshape  │ validate │weekdays  │
│          │              │toBase64│dataUrl  │ to2D     │ flowchart│datemath  │
│          │              │        │annotate │ from2D   │ sequence │ format   │
├──────────┴──────────────┴────────┴─────────┴──────────┴──────────┴──────────┤
│  waves (30+ signal processing methods)  │  ui (18 fragment generators)      │
│  normalize, fft, peaks, correlate, ...  │  viewers, editors, nav, toasts,...│
└─────────────────────────────────────────┴───────────────────────────────────┘
```

All utilities are accessed through the `sdk.utilities` namespace within your workflow step handlers.

---

## 1. Documents (`sdk.utilities.documents`)

**Class:** `DocumentsUtility`

Parse DOCX, RTF, HTML, or TXT files into structured content.

### `parse(buffer, format)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffer` | `ArrayBuffer` | Raw file contents |
| `format` | `DocumentFormat` | `'docx'` \| `'rtf'` \| `'html'` \| `'txt'` |

**Returns:** `Promise<DocumentParseResult>`

```typescript
interface DocumentParseResult {
  html: string;
  text: string;
  metadata: {
    title?: string;
    author?: string;
    createdAt?: string;
    modifiedAt?: string;
    pageCount?: number;
    wordCount?: number;
  };
  messages?: Array<{ type: 'warning' | 'info'; message: string }>;
}
```

### Example

```typescript
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { fileBuffer } = JSON.parse(sanitisedInput);

  // Parse a DOCX file
  const parsed = await sdk.utilities.documents.parse(fileBuffer, 'docx');

  return new Response(JSON.stringify({
    success: true,
    html: parsed.html,
    text: parsed.text,
    metadata: parsed.metadata,
    wordCount: parsed.text.split(/\s+/).length
  }));
}
```

---

## 2. Spreadsheets (`sdk.utilities.spreadsheets`)

**Class:** `SpreadsheetsUtility`

Parse spreadsheet files and convert data to CSV.

### `parse(buffer, format)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffer` | `ArrayBuffer` | Raw file contents |
| `format` | `SpreadsheetFormat` | `'xlsx'` \| `'xls'` \| `'csv'` \| `'ods'` |

**Returns:** `Promise<SpreadsheetParseResult>`

```typescript
interface SpreadsheetParseResult {
  sheets: Array<{
    name: string;
    data: CellValue[][];
    headers?: string[];
    rowCount: number;
    columnCount: number;
  }>;
  metadata: {
    sheetCount: number;
    author?: string;
    createdAt?: string;
    modifiedAt?: string;
  };
}

type CellValue = string | number | boolean | Date | null;
```

### `toCSV(data, headers?)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `CellValue[][]` | 2D array of cell values |
| `headers` | `string[]` (optional) | Header row |

**Returns:** `string` (CSV formatted)

### Example

```typescript
// Parse an XLSX file
const result = await sdk.utilities.spreadsheets.parse(buffer, 'xlsx');

const firstSheet = result.sheets[0];
console.log(firstSheet.name, firstSheet.rowCount);
console.log(firstSheet.headers);  // ['Name', 'Age', 'Email']
console.log(firstSheet.data[0]);  // ['Alice', 30, 'alice@example.com']

// Convert sheet data back to CSV
const csv = sdk.utilities.spreadsheets.toCSV(firstSheet.data, firstSheet.headers);
```

---

## 3. PDFs (`sdk.utilities.pdfs`)

**Class:** `PDFsUtility`

Extract text from PDFs, validate PDF buffers, and convert to base64.

### `extractPages(buffer)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffer` | `ArrayBuffer` | Raw PDF file contents |

**Returns:** `Promise<PDFExtractResult>`

```typescript
interface PDFExtractResult {
  pages: Array<{
    pageNumber: number;
    text: string;
    width: number;
    height: number;
  }>;
  metadata: {
    pageCount: number;
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    createdAt?: string;
    modifiedAt?: string;
  };
}
```

### `isValidPdf(buffer)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffer` | `ArrayBuffer` | Buffer to check |

**Returns:** `boolean`

### `toBase64(buffer)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffer` | `ArrayBuffer` | PDF file contents |

**Returns:** `string` (base64-encoded)

### Example

```typescript
// Validate and extract pages from a PDF
const buffer: ArrayBuffer = /* uploaded file */;

if (!sdk.utilities.pdfs.isValidPdf(buffer)) {
  return new Response(JSON.stringify({ error: 'Invalid PDF' }), { status: 400 });
}

const result = await sdk.utilities.pdfs.extractPages(buffer);
console.log(`${result.metadata.pageCount} pages`);

for (const page of result.pages) {
  console.log(`Page ${page.pageNumber}: ${page.text.substring(0, 100)}...`);
}

// Convert to base64 for client-side rendering
const base64 = sdk.utilities.pdfs.toBase64(buffer);
const dataUrl = `data:application/pdf;base64,${base64}`;
```

---

## 4. Images (`sdk.utilities.images`)

**Class:** `ImagesUtility`

Read image metadata, detect formats, generate data URLs, and manage annotations.

### `getMetadata(buffer)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffer` | `ArrayBuffer` | Raw image file contents |

**Returns:** `Promise<ImageMetadataResult>`

```typescript
interface ImageMetadataResult {
  format: ImageFormat;
  width: number;
  height: number;
  size: number;
  hasAlpha?: boolean;
  exif?: Record<string, unknown>;
}

type ImageFormat = 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp' | 'svg';
```

### `detectFormat(buffer)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffer` | `ArrayBuffer` | Raw image data |

**Returns:** `ImageFormat`

### `toDataUrl(buffer, format)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffer` | `ArrayBuffer` | Raw image data |
| `format` | `ImageFormat` | Image format for the MIME type |

**Returns:** `string` (data URL, e.g. `data:image/png;base64,...`)

### `serializeAnnotations(annotations)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `annotations` | `ImageAnnotation[]` | Annotation objects |

**Returns:** `string` (JSON)

### `deserializeAnnotations(json)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `json` | `string` | JSON string of annotations |

**Returns:** `ImageAnnotation[]`

```typescript
interface ImageAnnotation {
  id: string;
  shape: 'rectangle' | 'circle' | 'arrow' | 'line' | 'freehand' | 'text';
  bounds: { x: number; y: number; width?: number; height?: number; endX?: number; endY?: number };
  style: { strokeColor?: string; fillColor?: string; strokeWidth?: number; opacity?: number };
  text?: string;
  label?: string;
}
```

### Example

```typescript
// Get image metadata
const meta = await sdk.utilities.images.getMetadata(imageBuffer);
console.log(`${meta.format} ${meta.width}x${meta.height} (${meta.size} bytes)`);

// Auto-detect format from magic bytes
const format = sdk.utilities.images.detectFormat(imageBuffer);

// Convert to data URL for embedding in HTML
const dataUrl = sdk.utilities.images.toDataUrl(imageBuffer, format);
const html = `<img src="${dataUrl}" alt="uploaded image" />`;

// Persist/restore annotations
const json = sdk.utilities.images.serializeAnnotations(myAnnotations);
// ... store json ...
const restored = sdk.utilities.images.deserializeAnnotations(json);
```

---

## 5. Tensors (`sdk.utilities.tensors`)

**Class:** `TensorsUtility`

Analyze, reshape, and convert multi-dimensional tensor data.

### `analyze(tensor)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `tensor` | `TensorData` | Tensor to analyze |

**Returns:** `Promise<TensorAnalysisResult>`

```typescript
interface TensorData {
  values: number[];
  shape: number[];
  dtype: TensorDataType;
  labels?: { rows?: string[]; columns?: string[] };
}

type TensorDataType = 'float32' | 'float64' | 'int32' | 'int64' | 'uint8' | 'bool';

interface TensorAnalysisResult {
  shape: number[];
  dtype: TensorDataType;
  stats: { min: number; max: number; mean: number; std: number; sum: number; nonZeroCount: number };
  histogram?: { bins: number[]; counts: number[] };
}
```

### `reshape(tensor, newShape)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `tensor` | `TensorData` | Source tensor |
| `newShape` | `number[]` | New dimensions (total elements must match) |

**Returns:** `TensorData`

### `to2DArray(tensor)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `tensor` | `TensorData` | Tensor to convert |

**Returns:** `number[][]`

### `from2DArray(data, dtype?)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `number[][]` | 2D array of numbers |
| `dtype` | `TensorDataType` (optional) | Defaults to `'float32'` |

**Returns:** `TensorData`

### Example

```typescript
// Create a tensor from a 2D array
const tensor = sdk.utilities.tensors.from2DArray([
  [1, 2, 3],
  [4, 5, 6]
], 'float32');
// tensor.shape => [2, 3]

// Analyze statistics
const analysis = await sdk.utilities.tensors.analyze(tensor);
console.log(analysis.stats.mean);  // 3.5
console.log(analysis.stats.min);   // 1
console.log(analysis.stats.max);   // 6

// Reshape to 3x2
const reshaped = sdk.utilities.tensors.reshape(tensor, [3, 2]);
// reshaped.shape => [3, 2]

// Convert back to 2D array for display
const grid = sdk.utilities.tensors.to2DArray(reshaped);
// [[1, 2], [3, 4], [5, 6]]
```

---

## 6. Diagrams (`sdk.utilities.diagrams`)

**Class:** `DiagramsUtility`

Create diagrams from Mermaid syntax, validate, and generate flowcharts/sequence diagrams.

### `create(definition)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `definition` | `DiagramDefinition` | Format and source code |

**Returns:** `Promise<DiagramCreateResult>`

```typescript
interface DiagramDefinition {
  format: 'mermaid' | 'svg';
  source: string;
}

interface DiagramCreateResult {
  svg: string;
  bounds: { width: number; height: number };
}
```

### `validateMermaidSyntax(source)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | `string` | Mermaid diagram source |

**Returns:** `{ valid: boolean; error?: string }`

### `generateFlowchart(nodes, edges)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `nodes` | `Array<{ id: string; label: string; shape?: 'rect' \| 'round' \| 'diamond' }>` | Graph nodes |
| `edges` | `Array<{ from: string; to: string; label?: string }>` | Connections |

**Returns:** `string` (Mermaid source)

### `generateSequenceDiagram(participants, messages)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `participants` | `string[]` | Participant names |
| `messages` | `Array<{ from: string; to: string; text: string; type?: 'sync' \| 'async' \| 'reply' }>` | Messages |

**Returns:** `string` (Mermaid source)

### Example

```typescript
// Create a diagram from raw Mermaid source
const result = await sdk.utilities.diagrams.create({
  format: 'mermaid',
  source: 'flowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Done]\n  B -->|No| D[Retry]'
});
// result.svg contains the rendered SVG

// Validate syntax before rendering
const check = sdk.utilities.diagrams.validateMermaidSyntax('flowchart TD\n  A --> B');
if (!check.valid) console.error(check.error);

// Generate a flowchart programmatically
const mermaidSource = sdk.utilities.diagrams.generateFlowchart(
  [
    { id: 'start', label: 'Start', shape: 'round' },
    { id: 'process', label: 'Process Data', shape: 'rect' },
    { id: 'check', label: 'Valid?', shape: 'diamond' },
    { id: 'end', label: 'Done', shape: 'round' }
  ],
  [
    { from: 'start', to: 'process' },
    { from: 'process', to: 'check' },
    { from: 'check', to: 'end', label: 'Yes' },
    { from: 'check', to: 'process', label: 'No' }
  ]
);

// Generate a sequence diagram
const seqSource = sdk.utilities.diagrams.generateSequenceDiagram(
  ['Client', 'Gateway', 'Worker'],
  [
    { from: 'Client', to: 'Gateway', text: 'POST /api/data', type: 'sync' },
    { from: 'Gateway', to: 'Worker', text: 'Process request', type: 'async' },
    { from: 'Worker', to: 'Gateway', text: 'Result', type: 'reply' },
    { from: 'Gateway', to: 'Client', text: '200 OK', type: 'reply' }
  ]
);
```

---

## 7. Calendar (`sdk.utilities.calendar`)

**Class:** `CalendarsUtility`

Build month grids, perform date math, and format dates.

### `buildMonthGrid(year, month, options?)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `year` | `number` | Full year (e.g. 2025) |
| `month` | `number` | Month (0-11, January = 0) |
| `options` | `object` (optional) | Events, team map, selections, date constraints, firstDayOfWeek |

**Returns:** `CalendarMonthGrid`

```typescript
interface CalendarMonthGrid {
  year: number;
  month: number;
  monthName: string;
  weeks: CalendarDay[][];  // Each week is an array of 7 days
}
```

### `getWeekdayNames(short?, firstDayOfWeek?)`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `short` | `boolean` | `true` | Use short names (`'Mon'`) vs full (`'Monday'`) |
| `firstDayOfWeek` | `0 \| 1` | `0` | 0 = Sunday, 1 = Monday |

**Returns:** `string[]`

### `getMonthName(month)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `month` | `number` | Month (0-11) |

**Returns:** `string` (e.g. `'January'`)

### `toISODate(date)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `string \| Date` | Date input |

**Returns:** `string` (e.g. `'2025-01-15'`)

### `isDateInRange(date, start, end)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `string` | ISO date string to check |
| `start` | `string` | Range start (inclusive) |
| `end` | `string` | Range end (inclusive) |

**Returns:** `boolean`

### `daysBetween(start, end)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | `string \| Date` | Start date |
| `end` | `string \| Date` | End date |

**Returns:** `number`

### `addDays(date, days)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `string \| Date` | Starting date |
| `days` | `number` | Days to add (negative to subtract) |

**Returns:** `string` (ISO date string)

### `formatDate(date, format?)`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date` | `string \| Date` | | Date to format |
| `format` | `string` | `'short'` | Format string |

**Returns:** `string`

### Example

```typescript
// Build a month grid with events and team assignments
const grid = sdk.utilities.calendar.buildMonthGrid(2025, 0, {
  events: [
    { id: '1', date: '2025-01-15', title: 'Meeting', category: 'social' }
  ],
  teamMap: {
    '2025-01-15': { team: 'A', color: 'rgba(236, 72, 153, 0.15)', borderColor: '#ec4899' },
    '2025-01-16': { team: 'B', color: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6' }
  },
  firstDayOfWeek: 1
});

console.log(grid.monthName);  // 'January'
console.log(grid.weeks.length);  // 5 (number of weeks in the month view)

// Date math
const weekdays = sdk.utilities.calendar.getWeekdayNames(true, 1);
// ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const iso = sdk.utilities.calendar.toISODate(new Date());
const inRange = sdk.utilities.calendar.isDateInRange('2025-01-15', '2025-01-01', '2025-01-31');
const gap = sdk.utilities.calendar.daysBetween('2025-01-01', '2025-01-31');  // 30
const nextWeek = sdk.utilities.calendar.addDays('2025-01-15', 7);  // '2025-01-22'
const formatted = sdk.utilities.calendar.formatDate('2025-01-15', 'short');
```

---

## 8. Waves (`sdk.utilities.waves`)

**Class:** `WavesUtility`

Signal processing with 30+ methods for waveform manipulation, filtering, spectral analysis, comparison, peak detection, and waveform generation.

### Arithmetic and Transform Operations

| Method | Signature | Description |
|--------|-----------|-------------|
| `normalize` | `(wave: number[] \| WaveData) => WaveNormalizationResult` | Normalize values to 0-1 range |
| `scale` | `(wave: number[], factor: number) => number[]` | Multiply all values by a constant |
| `offset` | `(wave: number[], value: number) => number[]` | Add a constant to all values |
| `add` | `(a: number[], b: number[]) => number[]` | Element-wise addition |
| `subtract` | `(a: number[], b: number[]) => number[]` | Element-wise subtraction |
| `multiply` | `(a: number[], b: number[]) => number[]` | Element-wise multiplication |
| `invert` | `(wave: number[]) => number[]` | Flip vertically (negate) |
| `clip` | `(wave: number[], min: number, max: number) => number[]` | Clamp values to range |

### Resampling

| Method | Signature | Description |
|--------|-----------|-------------|
| `downsample` | `(wave: number[], targetLength: number, method?: WaveDownsampleMethod) => number[]` | Reduce sample count |
| `upsample` | `(wave: number[], targetLength: number) => number[]` | Increase via linear interpolation |
| `resample` | `(wave: number[], targetLength: number) => number[]` | Resample to exact length |

`WaveDownsampleMethod`: `'average'` | `'max'` | `'min'` | `'subsample'`

### Filtering and Smoothing

| Method | Signature | Description |
|--------|-----------|-------------|
| `movingAverage` | `(wave: number[], windowSize: number) => number[]` | Moving average filter |
| `ema` | `(wave: number[], alpha?: number) => number[]` | Exponential moving average |
| `gaussianSmooth` | `(wave: number[], sigma?: number) => number[]` | Gaussian smoothing |
| `convolve` | `(wave: number[], kernel: number[]) => number[]` | Convolve with arbitrary kernel |
| `removeDC` | `(wave: number[]) => number[]` | Remove DC offset (center at zero) |

### Calculus

| Method | Signature | Description |
|--------|-----------|-------------|
| `derivative` | `(wave: number[]) => number[]` | First difference (discrete derivative) |
| `integral` | `(wave: number[]) => number[]` | Cumulative sum (discrete integral) |

### Spectral Analysis

| Method | Signature | Description |
|--------|-----------|-------------|
| `fft` | `(wave: number[], sampleRate?: number) => WaveFFTResult` | Fast Fourier Transform |
| `ifft` | `(magnitudes: number[], phases: number[]) => number[]` | Inverse FFT |

```typescript
interface WaveFFTResult {
  magnitudes: number[];
  phases: number[];
  frequencies?: number[];  // Present when sampleRate is provided
}
```

### Comparison and Correlation

| Method | Signature | Description |
|--------|-----------|-------------|
| `compare` | `(a: number[], b: number[]) => WaveComparisonMetrics` | Full comparison metrics |
| `pearsonCorrelation` | `(a: number[], b: number[]) => number` | Correlation coefficient (-1 to 1) |
| `rmse` | `(a: number[], b: number[]) => number` | Root mean square error |
| `crossCorrelation` | `(a: number[], b: number[]) => number[]` | Cross-correlation array |

```typescript
interface WaveComparisonMetrics {
  correlation: number;
  rmse: number;
  maxDeviation: { index: number; difference: number };
  areaBetween: number;
}
```

### Peak Detection and Alignment

| Method | Signature | Description |
|--------|-----------|-------------|
| `findPeaks` | `(wave: number[], options?) => WavePeakInfo[]` | Find local maxima |
| `findValleys` | `(wave: number[], options?) => WavePeakInfo[]` | Find local minima |
| `align` | `(a: number[], b: number[]) => WaveAlignmentResult` | Align b to a via cross-correlation |

Options for `findPeaks` / `findValleys`: `{ minProminence?: number; minDistance?: number; maxPeaks?: number }`

```typescript
interface WavePeakInfo {
  index: number;
  value: number;
  prominence: number;
}

interface WaveAlignmentResult {
  aligned: number[];
  offset: number;
  correlation: number;
}
```

### Statistics

| Method | Signature | Description |
|--------|-----------|-------------|
| `stats` | `(wave: number[]) => { min, max, mean, std, rms, energy }` | Basic signal statistics |

### Waveform Generation

| Method | Signature | Description |
|--------|-----------|-------------|
| `sine` | `(length, frequency, sampleRate?, amplitude?, phase?) => number[]` | Generate sine wave |
| `square` | `(length, frequency, sampleRate?, amplitude?) => number[]` | Generate square wave |
| `sawtooth` | `(length, frequency, sampleRate?, amplitude?) => number[]` | Generate sawtooth wave |
| `noise` | `(length, amplitude?) => number[]` | Generate white noise |

### Example

```typescript
// Generate a test signal
const signal = sdk.utilities.waves.sine(1024, 440, 44100, 1.0);

// Add noise
const noisy = sdk.utilities.waves.add(signal, sdk.utilities.waves.noise(1024, 0.1));

// Smooth the noisy signal
const smoothed = sdk.utilities.waves.gaussianSmooth(noisy, 2.0);

// Compare original to smoothed
const metrics = sdk.utilities.waves.compare(signal, smoothed);
console.log(`Correlation: ${metrics.correlation}`);
console.log(`RMSE: ${metrics.rmse}`);

// FFT analysis
const spectrum = sdk.utilities.waves.fft(signal, 44100);
console.log(spectrum.magnitudes);
console.log(spectrum.frequencies);

// Reconstruct from frequency domain
const reconstructed = sdk.utilities.waves.ifft(spectrum.magnitudes, spectrum.phases);

// Find peaks
const peaks = sdk.utilities.waves.findPeaks(signal, { minProminence: 0.5 });
for (const peak of peaks) {
  console.log(`Peak at index ${peak.index}, value ${peak.value}`);
}

// Statistics
const s = sdk.utilities.waves.stats(signal);
console.log(`Mean: ${s.mean}, RMS: ${s.rms}, Energy: ${s.energy}`);

// Normalize to 0-1 range
const norm = sdk.utilities.waves.normalize(signal);
console.log(`Original range: ${norm.min} to ${norm.max}`);
```

---

## 9. UI Fragments (`sdk.utilities.ui`)

**Class:** `UIFragmentUtility`

Generate HTML fragment strings for embedding in workflow step UIs. Each method returns a `string` of HTML that you embed in your response template. Use `getStylesheet` or `getInlineStyles` to include required CSS.

### Data Viewers and Editors

| Method | Options Type | Description |
|--------|-------------|-------------|
| `documentEditor(options)` | `DocumentEditorOptions` | Rich text editor with toolbar |
| `spreadsheetViewer(options)` | `SpreadsheetViewerOptions` | Tabular data viewer with sort/filter/pagination |
| `pdfViewer(options)` | `PDFViewerOptions` | PDF viewer with zoom and page navigation |
| `imageAnnotator(options)` | `ImageAnnotatorOptions` | Image display with annotation tools |
| `tensorExplorer(options)` | `TensorExplorerOptions` | Tensor heatmap/histogram/scatter visualization |
| `diagramBuilder(options)` | `DiagramBuilderOptions` | Mermaid diagram editor with live preview |
| `waveViewer(options)` | `WaveViewerOptions` | Signal waveform viewer with zoom/pan and peaks |

### Calendar and Date

| Method | Options Type | Description |
|--------|-------------|-------------|
| `calendar(options)` | `CalendarViewOptions` | Full calendar with events, team coloring, selection |
| `dateRangePicker(options)` | `DateRangePickerOptions` | Inline, modal, or dropdown date range picker |

### Navigation and Layout

| Method | Options Type | Description |
|--------|-------------|-------------|
| `bottomTabs(options)` | `BottomTabsOptions` | Mobile bottom tab navigation with badges |
| `slideover(options)` | `SlideoverOptions` | Slide-over side panel with backdrop |

### Notifications

| Method | Options Type | Description |
|--------|-------------|-------------|
| `toastContainer(options?)` | `ToastContainerOptions` | Toast notification container (include once per page) |
| `toast(notification)` | `ToastNotification` | Single server-rendered toast notification |

### Payments

| Method | Options Type | Description |
|--------|-------------|-------------|
| `checkoutButton(options)` | `CheckoutButtonOptions` | Subscription checkout button |
| `subscriptionPortalButton(options)` | `SubscriptionPortalButtonOptions` | Billing management portal button |
| `subscriptionStatus(options)` | `SubscriptionStatusOptions` | Subscription status display |

### Styling Helpers

| Method | Signature | Description |
|--------|-----------|-------------|
| `getStylesheet(component)` | `(component: UtilityComponent) => string` | Returns `<link>` tag for component CSS |
| `getInlineStyles(component)` | `(component: UtilityComponent) => string` | Returns raw CSS string for `<style>` embedding |

`UtilityComponent` values: `'document-editor'` | `'spreadsheet-viewer'` | `'pdf-viewer'` | `'image-annotator'` | `'tensor-explorer'` | `'diagram-builder'` | `'calendar'` | `'date-range-picker'` | `'bottom-tabs'` | `'slideover'` | `'toast'` | `'checkout-button'` | `'subscription-portal'` | `'subscription-status'` | `'wave-viewer'`

### UI Fragment Example

```typescript
export async function renderAIHFWorkflowStepUI(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  // Parse uploaded document
  const { fileBuffer } = JSON.parse(sanitisedInput);
  const parsed = await sdk.utilities.documents.parse(fileBuffer, 'docx');

  // Build UI with fragments
  const editorFragment = sdk.utilities.ui.documentEditor({
    content: parsed.html,
    editable: true,
    theme: 'full',
    toolbar: true,
    onChangeCallback: 'handleContentChange'
  });

  const toastContainer = sdk.utilities.ui.toastContainer({
    position: 'bottom-right',
    maxToasts: 3
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Document Editor</title>
  ${sdk.utilities.ui.getStylesheet('document-editor')}
  ${sdk.utilities.ui.getStylesheet('toast')}
</head>
<body>
  <div style="max-width: 800px; margin: 40px auto;">
    ${editorFragment}
  </div>
  ${toastContainer}

  <script>
    function handleContentChange(content) {
      console.log('Content updated:', content.substring(0, 100));
      aihfToastSuccess('Changes saved');
    }
  </script>
</body>
</html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
```

### Calendar UI Example

```typescript
const calendarFragment = sdk.utilities.ui.calendar({
  viewMode: 'month',
  selectionMode: 'range',
  events: [
    { id: '1', date: '2025-01-20', title: 'School starts', category: 'school' }
  ],
  teamMap: {
    '2025-01-15': { team: 'A', color: 'rgba(236, 72, 153, 0.15)', borderColor: '#ec4899' },
    '2025-01-16': { team: 'B', color: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6' }
  },
  showLegend: true,
  legendItems: [
    { color: '#ec4899', label: 'Home A' },
    { color: '#3b82f6', label: 'Home B' }
  ],
  onRangeSelectCallback: 'handleDateRange'
});

const slideover = sdk.utilities.ui.slideover({
  id: 'day-details',
  title: 'Day Details',
  position: 'right',
  size: '400px',
  content: '<p>Select a day to see details.</p>',
  showCloseButton: true,
  onCloseCallback: 'handleClose'
});

// Open the slideover from JavaScript: aihfSlideoverOpen('day-details')
```

### Wave Viewer UI Example

```typescript
const signal = sdk.utilities.waves.sine(512, 10, 1000);
const noisy = sdk.utilities.waves.add(signal, sdk.utilities.waves.noise(512, 0.2));
const filtered = sdk.utilities.waves.gaussianSmooth(noisy, 3.0);

const waveFragment = sdk.utilities.ui.waveViewer({
  waves: [
    { data: noisy, label: 'Raw Signal', color: '#94a3b8', style: 'line', lineWidth: 1 },
    { data: filtered, label: 'Filtered', color: '#3b82f6', style: 'line', lineWidth: 2 },
    { data: signal, label: 'Original', color: '#22c55e', style: 'line', lineWidth: 1 }
  ],
  xAxis: { label: 'Time (ms)' },
  yAxis: { label: 'Amplitude' },
  showGrid: true,
  showLegend: true,
  interactive: true,
  showPeaks: true,
  peakThreshold: 0.5,
  title: 'Signal Comparison'
});
```

---

## Bundle Configuration

Reference these utilities in your `bundle.yaml` workflow steps:

```yaml
name: document-processing
version: 1

steps:
  - id: "doc-editor"
    route: '/editor'
    domain: 'app'
    ui:
      dynamic: 'ui/document-editor.ts'
    api:
      - route_match: '/parse'
        file: 'api/parse-document.ts'
        input:
          - name: 'fileBuffer'
            type: 'arraybuffer'
          - name: 'format'
            type: 'string'
        output:
          - name: 'html'
            type: 'string'
          - name: 'text'
            type: 'string'

  - id: "signal-analysis"
    route: '/signals'
    domain: 'app'
    ui:
      dynamic: 'ui/wave-viewer.ts'
    api:
      - route_match: '/analyze'
        file: 'api/analyze-signal.ts'
        input:
          - name: 'signalData'
            type: 'arraybuffer'
```

---

## Related Documentation

- [Platform SDK Reference](./SDK_REFERENCE.md) - Full API documentation
- [Bundle.yaml Reference](./BUNDLE_YAML.md) - Workflow configuration
