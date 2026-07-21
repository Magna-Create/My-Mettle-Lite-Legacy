import { Capacitor, registerPlugin } from '@capacitor/core';

export interface MaisReportExportResult {
  fileName: string;
  uri: string;
  bytes: number;
  location: string;
}

interface MaisReportExportPlugin {
  saveReport(options: { fileName: string; content: string }): Promise<MaisReportExportResult>;
}

const nativePlugin = registerPlugin<MaisReportExportPlugin>('MaisReportExport');

function saveInBrowser(fileName: string, content: string): MaisReportExportResult {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return {
    fileName,
    uri: url,
    bytes: new TextEncoder().encode(content).byteLength,
    location: 'Browser downloads',
  };
}

export async function saveMaisReportCard(fileName: string, content: string): Promise<MaisReportExportResult> {
  if (!Capacitor.isNativePlatform()) return saveInBrowser(fileName, content);
  return nativePlugin.saveReport({ fileName, content });
}
