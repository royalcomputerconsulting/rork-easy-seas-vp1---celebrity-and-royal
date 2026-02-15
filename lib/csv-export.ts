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

export function exportSurveyToText(
  shipName: string,
  sailDate: string,
  crewMembers: Array<{ fullName: string; roleTitle?: string; department: string }>,
  filename: string
): void {
  if (crewMembers.length === 0) {
    console.log('No crew members to export');
    return;
  }

  const textLines: string[] = [];
  
  textLines.push(
    `On ${shipName}, for SAILING DATE: ${sailDate}, the following crew members gave exceptional and outstanding service and show every example of displaying "The Royal Way":`
  );
  textLines.push('');
  
  crewMembers.forEach(member => {
    const role = member.roleTitle || member.department;
    textLines.push(`${member.fullName} - ${role}`);
  });

  const textContent = textLines.join('\n');
  
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  
  console.log(`Exported survey for ${shipName} on ${sailDate} to ${filename}`);
}
