// CSV eksport (Excel oʻzbek harflarini toʻgʻri koʻrishi uchun UTF-8 BOM bilan)
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(escape).join(',')).join('\r\n');
}

export function downloadFile(fileName: string, content: string | Blob, mime = 'text/csv;charset=utf-8'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(s: string): string {
  return s.replace(/[^a-z0-9ʻʼ'_-]+/gi, '_').replace(/_+/g, '_').slice(0, 60);
}
