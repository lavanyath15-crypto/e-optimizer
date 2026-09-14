import * as XLSX from 'xlsx';
import { PROCESS_UNITS, PROCESS_DEFAULTS } from '../data/processUnits';

export interface TemplateRow {
  Stage: string;
  Parameter: string;
  Key: string;
  Value: number;
  Unit: string;
  NormalRange: string;
}

/**
 * Generates an Excel workbook (.xlsx) containing both:
 * 1. "Process_Readings": Vertical parameter list (easy for shift operators to enter single batch/shift values).
 * 2. "Tabular_Export": Horizontal row format (compatible with historian multi-row exports).
 */
export function generateProcessTemplate(): Blob {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Vertical Parameter Sheet
  const verticalData: (string | number)[][] = [
    ['Stage', 'Parameter', 'Column_Key', 'Value', 'Unit', 'Normal Operating Band'],
  ];

  // Sheet 2: Tabular Sheet
  const headers: string[] = [];
  const defaultRow: number[] = [];

  for (const unit of PROCESS_UNITS) {
    for (const field of unit.fields) {
      const defVal = PROCESS_DEFAULTS[unit.id]?.[field.key] ?? field.normalMin;
      verticalData.push([
        unit.name,
        field.label,
        field.key === 'feedRate' && unit.id === 'milling' ? 'Grain_Input_tpd' : field.label.replace(/\s+/g, '_'),
        defVal,
        field.unit,
        `${field.normalMin} - ${field.normalMax} ${field.unit}`.trim(),
      ]);

      const colHeader = field.key === 'feedRate' && unit.id === 'milling' ? 'Grain_Input_tpd' : field.label.replace(/\s+/g, '_');
      headers.push(colHeader);
      defaultRow.push(defVal);
    }
  }

  const wsVertical = XLSX.utils.aoa_to_sheet(verticalData);
  // Auto-fit column widths
  wsVertical['!cols'] = [
    { wch: 15 },
    { wch: 26 },
    { wch: 24 },
    { wch: 12 },
    { wch: 10 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, wsVertical, 'Process_Parameters');

  const wsTabular = XLSX.utils.aoa_to_sheet([headers, defaultRow]);
  wsTabular['!cols'] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsTabular, 'Batch_Tabular');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadProcessTemplate(filename = 'e_optimizer_process_template.xlsx') {
  const blob = generateProcessTemplate();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
