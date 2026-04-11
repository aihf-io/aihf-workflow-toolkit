/**
 * UI Component: Document Upload
 * File upload interface for document analysis
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
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Analysis</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f3f4f6;
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    h1 {
      font-size: 32px;
      color: #1f2937;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #6b7280;
      margin-bottom: 32px;
    }
    .upload-zone {
      background: white;
      border: 2px dashed #d1d5db;
      border-radius: 16px;
      padding: 60px 40px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .upload-zone:hover,
    .upload-zone.dragover {
      border-color: #3b82f6;
      background: #eff6ff;
    }
    .upload-zone svg {
      width: 64px;
      height: 64px;
      color: #9ca3af;
      margin-bottom: 16px;
    }
    .upload-zone h3 {
      color: #374151;
      margin-bottom: 8px;
    }
    .upload-zone p {
      color: #6b7280;
      font-size: 14px;
    }
    .file-types {
      margin-top: 16px;
      font-size: 12px;
      color: #9ca3af;
    }
    #fileInput { display: none; }
    .selected-file {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .file-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .file-icon {
      width: 48px;
      height: 48px;
      background: #eff6ff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #3b82f6;
    }
    .file-name {
      font-weight: 500;
      color: #1f2937;
    }
    .file-size {
      font-size: 14px;
      color: #6b7280;
    }
    .btn-analyze {
      padding: 12px 32px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-analyze:hover { background: #2563eb; }
    .btn-analyze:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
    .status {
      text-align: center;
      padding: 40px;
      display: none;
    }
    .status.visible { display: block; }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <h1>Document Analysis</h1>
    <p class="subtitle">Upload a document for AI-powered analysis</p>

    <div class="upload-zone" id="dropZone">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
      </svg>
      <h3>Drop your document here</h3>
      <p>or click to browse</p>
      <p class="file-types">Supported: DOCX, RTF, TXT, HTML, PDF</p>
    </div>
    <input type="file" id="fileInput" accept=".docx,.rtf,.txt,.html,.pdf">

    <div class="selected-file" id="selectedFile" style="display: none;">
      <div class="file-info">
        <div class="file-icon">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div>
          <div class="file-name" id="fileName"></div>
          <div class="file-size" id="fileSize"></div>
        </div>
      </div>
      <button class="btn-analyze" id="analyzeBtn">Analyze Document</button>
    </div>

    <div class="status" id="status">
      <div class="spinner"></div>
      <p id="statusText">Uploading document...</p>
    </div>
  </div>

  <script>
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const selectedFile = document.getElementById('selectedFile');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const status = document.getElementById('status');
    const statusText = document.getElementById('statusText');

    let currentFile = null;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        handleFile(e.target.files[0]);
      }
    });

    function handleFile(file) {
      currentFile = file;
      fileName.textContent = file.name;
      fileSize.textContent = formatSize(file.size);
      selectedFile.style.display = 'flex';
      dropZone.style.display = 'none';
    }

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    analyzeBtn.addEventListener('click', async () => {
      if (!currentFile) return;

      analyzeBtn.disabled = true;
      selectedFile.style.display = 'none';
      status.classList.add('visible');
      statusText.textContent = 'Uploading document...';

      const formData = new FormData();
      formData.append('document', currentFile);
      formData.append('filename', currentFile.name);

      try {
        const response = await fetch('/upload/submit', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.success) {
          statusText.textContent = 'Analysis in progress...';
          // Poll for results or redirect
          setTimeout(() => {
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
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
