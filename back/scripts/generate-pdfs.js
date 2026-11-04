const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/User/Desktop/work/loyha/back/node_modules/puppeteer');

const rootDir = 'C:/Users/User/Desktop/work/loyha';
const emblemSvgPath = path.join(rootDir, 'front/public/Emblem_of_Uzbekistan.svg');
const emblemSvg = fs.existsSync(emblemSvgPath) ? fs.readFileSync(emblemSvgPath, 'utf8') : '';

// Oddiy va ishonchli Markdown -> HTML konvertori
function markdownToHtml(md) {
  const lines = md.split('\n');
  let html = [];
  let inCode = false;
  let codeLang = '';
  let codeBuffer = [];
  let inTable = false;
  let tableBuffer = [];
  let inList = false;
  let listType = 'ul';

  function flushList() {
    if (inList) {
      html.push(`</${listType}>`);
      inList = false;
    }
  }

  function flushTable() {
    if (inTable && tableBuffer.length > 0) {
      let tHtml = '<table class="doc-table"><thead>';
      const headerLine = tableBuffer[0];
      const headers = headerLine.split('|').map(s => s.trim()).filter((s, idx, arr) => idx > 0 && idx < arr.length - 1);
      tHtml += '<tr>' + headers.map(h => `<th>${formatInline(h)}</th>`).join('') + '</tr></thead><tbody>';

      for (let i = 2; i < tableBuffer.length; i++) {
        const row = tableBuffer[i].split('|').map(s => s.trim()).filter((s, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (row.length > 0) {
          tHtml += '<tr>' + row.map(cell => `<td>${formatInline(cell)}</td>`).join('') + '</tr>';
        }
      }
      tHtml += '</tbody></table>';
      html.push(tHtml);
      tableBuffer = [];
      inTable = false;
    }
  }

  function formatInline(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/&lt;span style="([^"]+)"&gt;([\s\S]*?)&lt;\/span&gt;/gi, '<span style="$1">$2</span>');
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Code block
    if (line.startsWith('```')) {
      flushList();
      flushTable();
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeBuffer = [];
      } else {
        inCode = false;
        const codeText = codeBuffer.join('\n')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        html.push(`<div class="code-container"><div class="code-header">${codeLang || 'kod'}</div><pre><code>${codeText}</code></pre></div>`);
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Table
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      inTable = true;
      tableBuffer.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Empty line
    if (!line) {
      flushList();
      continue;
    }

    // Horizontal rule
    if (line === '---' || line === '***') {
      flushList();
      html.push('<hr class="divider" />');
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      flushList();
      html.push(`<h1 class="h1-title">${formatInline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      html.push(`<h2 class="h2-title">${formatInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      html.push(`<h3 class="h3-title">${formatInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('#### ')) {
      flushList();
      html.push(`<h4 class="h4-title">${formatInline(line.slice(5))}</h4>`);
      continue;
    }

    // Blockquote / Alert callouts
    if (line.startsWith('> ')) {
      flushList();
      const bContent = line.slice(2);
      if (bContent.includes('⚠️') || bContent.includes('Diqqat') || bContent.includes('Внимание') || bContent.includes('Warning')) {
        html.push(`<div class="callout callout-warning">${formatInline(bContent)}</div>`);
      } else if (bContent.includes('🛑') || bContent.includes('Taqiqlanadi') || bContent.includes('Xavfsizlik') || bContent.includes('Security')) {
        html.push(`<div class="callout callout-danger">${formatInline(bContent)}</div>`);
      } else if (bContent.includes('💡') || bContent.includes('Qulaylik') || bContent.includes('Afzallik') || bContent.includes('Tip')) {
        html.push(`<div class="callout callout-success">${formatInline(bContent)}</div>`);
      } else {
        html.push(`<div class="callout callout-info">${formatInline(bContent)}</div>`);
      }
      continue;
    }

    // Unordered lists
    if (line.startsWith('* ') || line.startsWith('- ')) {
      if (!inList || listType !== 'ul') {
        flushList();
        inList = true;
        listType = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${formatInline(line.slice(2))}</li>`);
      continue;
    }

    // Ordered lists
    const olMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        flushList();
        inList = true;
        listType = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${formatInline(olMatch[2])}</li>`);
      continue;
    }

    // Paragraph
    flushList();
    html.push(`<p>${formatInline(line)}</p>`);
  }

  flushList();
  flushTable();
  return html.join('\n');
}

function buildHtmlPage({ title, subtitle, docNumber, isTechnical, contentHtml }) {
  const primaryColor = isTechnical ? '#0f172a' : '#1e3a8a';
  const accentColor = isTechnical ? '#0284c7' : '#059669';

  return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      font-size: 10.5pt;
      background: #ffffff;
    }

    /* Muqova (Cover Page) */
    .cover-page {
      box-sizing: border-box;
      height: 260mm;
      max-height: 260mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      padding: 30px 25px;
      page-break-after: always;
      break-after: page;
      border: 3px double #cbd5e1;
      border-radius: 12px;
      position: relative;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    }
    .cover-header {
      width: 100%;
    }
    .emblem-wrapper {
      width: 105px;
      height: 105px;
      margin: 0 auto 12px auto;
    }
    .emblem-wrapper svg {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .state-name {
      font-size: 13pt;
      font-weight: 800;
      letter-spacing: 2px;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .ministry-title {
      font-size: 10.5pt;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .cover-body {
      margin: 30px 0;
      max-width: 650px;
    }
    .system-badge {
      display: inline-block;
      padding: 5px 14px;
      background: #e2e8f0;
      color: #0f172a;
      font-size: 8.5pt;
      font-weight: 700;
      border-radius: 20px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 16px;
      border: 1px solid #cbd5e1;
    }
    .main-title {
      font-size: 22pt;
      font-weight: 900;
      line-height: 1.25;
      color: ${primaryColor};
      margin-bottom: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .main-subtitle {
      font-size: 12pt;
      color: #334155;
      font-weight: 600;
      line-height: 1.5;
    }
    .doc-decor-line {
      width: 110px;
      height: 4px;
      background: ${accentColor};
      margin: 20px auto;
      border-radius: 2px;
    }

    .cover-footer {
      width: 100%;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      font-size: 8.5pt;
      color: #64748b;
      font-weight: 500;
    }

    /* Sahifalar chegarasida matn uzilib qolishini oldini olish (Print Integrity) */
    p {
      margin-bottom: 9px;
      text-align: justify;
      orphans: 4;
      widows: 4;
    }
    ul, ol {
      margin-left: 22px;
      margin-bottom: 11px;
      page-break-inside: auto;
    }
    li {
      margin-bottom: 4px;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      orphans: 3;
      widows: 3;
    }
    h1, h2, h3, h4 {
      break-after: avoid !important;
      page-break-after: avoid !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .h1-title {
      font-size: 16pt;
      font-weight: 800;
      color: ${primaryColor};
      margin-top: 22px;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid ${accentColor};
    }
    .h2-title {
      font-size: 13pt;
      font-weight: 700;
      color: #1e293b;
      margin-top: 18px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }
    .h3-title {
      font-size: 11.5pt;
      font-weight: 700;
      color: ${accentColor};
      margin-top: 14px;
      margin-bottom: 6px;
    }
    .h4-title {
      font-size: 10.5pt;
      font-weight: 700;
      color: #334155;
      margin-top: 10px;
      margin-bottom: 5px;
    }
    .divider {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 16px 0;
    }

    /* Jadvallar */
    .doc-table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 9pt;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .doc-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-table td {
      padding: 7px 10px;
      border: 1px solid #e2e8f0;
      color: #334155;
      vertical-align: top;
    }
    .doc-table tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .doc-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* Callout ogohlantirish bloklari */
    .callout {
      padding: 10px 14px;
      margin: 12px 0;
      border-left: 4px solid #94a3b8;
      border-radius: 5px;
      font-size: 9.5pt;
      background: #f8fafc;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .callout-warning {
      border-left-color: #f59e0b;
      background: #fffbeb;
      color: #92400e;
    }
    .callout-danger {
      border-left-color: #ef4444;
      background: #fef2f2;
      color: #991b1b;
    }
    .callout-success {
      border-left-color: #10b981;
      background: #ecfdf5;
      color: #065f46;
    }
    .callout-info {
      border-left-color: #0284c7;
      background: #f0f9ff;
      color: #0369a1;
    }

    /* Kod bloklari */
    .inline-code {
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 5px;
      border-radius: 4px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9pt;
      border: 1px solid #e2e8f0;
      font-weight: 600;
    }
    .code-container {
      margin: 12px 0;
      border-radius: 6px;
      overflow: hidden;
      background: #0f172a;
      border: 1px solid #1e293b;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .code-header {
      background: #1e293b;
      color: #94a3b8;
      padding: 5px 12px;
      font-size: 8pt;
      font-family: 'Consolas', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 700;
      border-bottom: 1px solid #334155;
    }
    pre {
      padding: 10px 12px;
      margin: 0;
      overflow-x: auto;
    }
    code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 8.5pt;
      color: #38bdf8;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <!-- Muqova -->
  <div class="cover-page">
    <div class="cover-header">
      <div class="emblem-wrapper">${emblemSvg}</div>
      <div class="state-name">O‘zbekiston Respublikasi</div>
      <div class="ministry-title">Vazirliklar, Davlat Qo‘mitalari va Agentliklari</div>
    </div>
    <div class="cover-body">
      <div class="system-badge">WMS Enterprise Platform v1.0.0</div>
      <h1 class="main-title">${title}</h1>
      <div class="doc-decor-line"></div>
      <div class="main-subtitle">${subtitle}</div>
    </div>
    <div class="cover-footer">
      <div>Hujjat kodi: <strong>${docNumber}</strong></div>
      <div>Maxfiylik darajasi: <strong>Xizmat doirasida foydalanish uchun</strong></div>
      <div>Toshkent — 2026-yil</div>
    </div>
  </div>

  <!-- Asosiy Tarkib -->
  <div class="content-body">
    ${contentHtml}
  </div>
</body>
</html>`;
}

async function generateBothPdfs() {
  console.log('🚀 Puppeteer ishga tushirilmoqda...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // 1. WMS Foydalanuvchi Qo'llanmasi PDF
    console.log('\n📄 1. WMS Foydalanuvchi Qo\'llanmasi (QOLLANMA.md) PDF ga aylantirilmoqda...');
    const qollanmaMd = fs.readFileSync(path.join(rootDir, 'QOLLANMA.md'), 'utf8');
    const qollanmaContentHtml = markdownToHtml(qollanmaMd);
    const qollanmaHtml = buildHtmlPage({
      title: 'Foydalanuvchi va Amaliy Reglamentlar Qo‘llanmasi',
      subtitle: 'Barcha Foydalanuvchi Rollari, Funksional Vakolatlar, Kvartallik Meʼyorlar va Hujjatlar Aylanishi Bo‘yicha Idoraviy Standart Yo‘riqnoma',
      docNumber: 'WMS-DOC-USER-2026',
      isTechnical: false,
      contentHtml: qollanmaContentHtml,
    });

    const page1 = await browser.newPage();
    await page1.setContent(qollanmaHtml, { waitUntil: 'networkidle0' });
    const userPdfPath = path.join(rootDir, 'WMS_FOYDALANUVCHI_QOLLANMASI.pdf');
    await page1.pdf({
      path: userPdfPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="font-size: 8.5pt; color: #64748b; width: 100%; text-align: right; padding-right: 15mm; font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">Sahifa <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    });
    console.log(`✅ Muvaffaqiyatli saqlandi: ${userPdfPath}`);

    // 2. WMS Texnik Pasport & REST API PDF
    console.log('\n📄 2. WMS Texnik Pasport va REST API (README.md) PDF ga aylantirilmoqda...');
    const readmeMd = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
    const readmeContentHtml = markdownToHtml(readmeMd);
    const readmeHtml = buildHtmlPage({
      title: 'Texnik Pasport va To‘liq REST API Katalogi',
      subtitle: 'Dastur Arxitekturasi, Prisma Baza Sxemasi, Kiberxavfsizlik Algoritmlari, Barcha Endpointlar va DevOps Yo‘riqnomasi',
      docNumber: 'WMS-DOC-TECH-2026',
      isTechnical: true,
      contentHtml: readmeContentHtml,
    });

    const page2 = await browser.newPage();
    await page2.setContent(readmeHtml, { waitUntil: 'networkidle0' });
    const techPdfPath = path.join(rootDir, 'WMS_TEXNIK_PASPORT_VA_API.pdf');
    await page2.pdf({
      path: techPdfPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="font-size: 8.5pt; color: #64748b; width: 100%; text-align: right; padding-right: 15mm; font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">Sahifa <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    });
    console.log(`✅ Muvaffaqiyatli saqlandi: ${techPdfPath}`);

    console.log('\n🎉 BARCHA 2 TA MASTER PDF HUJJATLAR 100% MUVAFAQIYATLI TAYYORLANDI!');
  } finally {
    await browser.close();
  }
}

generateBothPdfs().catch(err => {
  console.error('Xatolik yuz berdi:', err);
  process.exit(1);
});
