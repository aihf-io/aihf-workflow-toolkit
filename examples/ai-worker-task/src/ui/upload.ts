/**
 * UI Component: Document Upload
 * File upload interface for document analysis
 *
 * IMPORTANT: Return body fragments, NOT full HTML documents.
 * The platform wraps your output in a shell page and extracts <body> content
 * via regex — any <head>/<style> outside the body will be stripped.
 */

import { AIHFPlatform } from '@aihf/platform-sdk';

export async function renderAIHFWorkflowStepUI(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
): Promise<Response | null> {
  const html = `
<style>
  .du-wrap * { box-sizing: border-box; }
  .du-wrap {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 600px;
    margin: 40px auto;
    padding: 0 20px;
  }
  .du-wrap h1 {
    font-size: 32px;
    color: #1f2937;
    margin: 0 0 8px;
  }
  .du-wrap .du-subtitle {
    color: #6b7280;
    margin: 0 0 32px;
  }
  .du-upload-zone {
    background: white;
    border: 2px dashed #d1d5db;
    border-radius: 16px;
    padding: 60px 40px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  .du-upload-zone:hover,
  .du-upload-zone.dragover {
    border-color: #3b82f6;
    background: #eff6ff;
  }
  .du-upload-zone svg {
    width: 64px;
    height: 64px;
    color: #9ca3af;
    margin-bottom: 16px;
  }
  .du-upload-zone h3 {
    color: #374151;
    margin: 0 0 8px;
  }
  .du-upload-zone p {
    color: #6b7280;
    font-size: 14px;
    margin: 0;
  }
  .du-file-types {
    margin-top: 16px;
    font-size: 12px;
    color: #9ca3af;
  }
  #duFileInput { display: none; }
  .du-selected-file {
    background: white;
    border-radius: 12px;
    padding: 20px;
    margin-top: 20px;
    display: none;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .du-file-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .du-file-icon {
    width: 48px;
    height: 48px;
    background: #eff6ff;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
  }
  .du-file-name {
    font-weight: 500;
    color: #1f2937;
  }
  .du-file-size {
    font-size: 14px;
    color: #6b7280;
  }
  .du-btn-analyze {
    padding: 12px 32px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
  }
  .du-btn-analyze:hover { background: #2563eb; }
  .du-btn-analyze:disabled { background: #9ca3af; cursor: not-allowed; }
  .du-status {
    text-align: center;
    padding: 40px;
    display: none;
  }
  .du-status.visible { display: block; }
  .du-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: duSpin 1s linear infinite;
    margin: 0 auto 16px;
  }
  @keyframes duSpin { to { transform: rotate(360deg); } }
</style>

<div class="du-wrap">
  <h1>Document Analysis</h1>
  <p class="du-subtitle">Upload a document for AI-powered analysis</p>

  <div class="du-upload-zone" id="duDropZone">
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
    </svg>
    <h3>Drop your document here</h3>
    <p>or click to browse</p>
    <p class="du-file-types">Supported: DOCX, RTF, TXT, HTML, PDF</p>
  </div>
  <input type="file" id="duFileInput" accept=".docx,.rtf,.txt,.html,.pdf">

  <div class="du-selected-file" id="duSelectedFile">
    <div class="du-file-info">
      <div class="du-file-icon">
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      </div>
      <div>
        <div class="du-file-name" id="duFileName"></div>
        <div class="du-file-size" id="duFileSize"></div>
      </div>
    </div>
    <button class="du-btn-analyze" id="duAnalyzeBtn">Analyze Document</button>
  </div>

  <div class="du-status" id="duStatus">
    <div class="du-spinner"></div>
    <p id="duStatusText">Uploading document...</p>
  </div>
</div>

<script>
(function() {
  var dropZone = document.getElementById('duDropZone');
  var fileInput = document.getElementById('duFileInput');
  var selectedFile = document.getElementById('duSelectedFile');
  var fileNameEl = document.getElementById('duFileName');
  var fileSizeEl = document.getElementById('duFileSize');
  var analyzeBtn = document.getElementById('duAnalyzeBtn');
  var status = document.getElementById('duStatus');
  var statusText = document.getElementById('duStatusText');

  var currentFile = null;

  dropZone.addEventListener('click', function() { fileInput.click(); });

  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', function() {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', function(e) {
    if (e.target.files.length) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    currentFile = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatSize(file.size);
    selectedFile.style.display = 'flex';
    dropZone.style.display = 'none';
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  analyzeBtn.addEventListener('click', async function() {
    if (!currentFile) return;

    analyzeBtn.disabled = true;
    selectedFile.style.display = 'none';
    status.classList.add('visible');
    statusText.textContent = 'Uploading document...';

    var formData = new FormData();
    formData.append('document', currentFile);
    formData.append('filename', currentFile.name);
    formData.append('taskId', window.AIHF_TASK_ID || '');

    try {
      var response = await fetch('/upload/submit', {
        method: 'POST',
        body: formData
      });

      var result = await response.json();

      if (result.success) {
        statusText.textContent = 'Analysis in progress...';
        setTimeout(function() {
          window.location.href = '/results?id=' + result.documentId;
        }, 2000);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      status.classList.remove('visible');
      selectedFile.style.display = 'flex';
      analyzeBtn.disabled = false;
      alert(error.message);
    }
  });
})();
</script>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
