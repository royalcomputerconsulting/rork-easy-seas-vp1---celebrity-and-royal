export function exportToCSV(
  data: any[],
  headers: { key: string; label: string }[],
  filename: string
): void {
  if (data.length === 0) {
    console.log('No data to export');
    return;
  }

  const csvHeaders = headers.map(h => h.label).join(',');
  
  const csvRows = data.map(row => {
    return headers.map(h => {
      const value = row[h.key];
      const stringValue = value !== null && value !== undefined ? String(value) : '';
      const escaped = stringValue.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  const csvContent = [csvHeaders, ...csvRows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  
  console.log(`Exported ${data.length} rows to ${filename}`);
}
