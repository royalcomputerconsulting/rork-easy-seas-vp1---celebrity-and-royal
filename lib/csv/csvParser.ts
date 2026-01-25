export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === '\t') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function normalizeDateString(dateStr: string): string {
  if (!dateStr) return '';

  const cleaned = dateStr.trim();

  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleaned)) {
    const [month, day, year] = cleaned.split('/');
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${month.padStart(2, '0')}-${day.padStart(2, '0')}-${fullYear}`;
  }

  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleaned)) {
    const [month, day, year] = cleaned.split('-');
    return `${month.padStart(2, '0')}-${day.padStart(2, '0')}-${year}`;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    const [year, month, day] = cleaned.split('T')[0].split('-');
    return `${month}-${day}-${year}`;
  }

  if (/^\d{8}$/.test(cleaned)) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    return `${month}-${day}-${year}`;
  }

  return cleaned;
}

export function calculateReturnDate(sailDate: string, nights: number): string {
  try {
    const parts = sailDate.split('-');
    let date: Date;
    
    if (parts[0].length === 4) {
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    }
    
    date.setDate(date.getDate() + nights);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  } catch {
    return sailDate;
  }
}

export function getPriceForRoomType(
  roomType: string,
  interior: number,
  oceanview: number,
  balcony: number,
  suite: number
): number {
  const type = roomType?.toLowerCase() || '';
  if (type.includes('interior')) return interior;
  if (type.includes('ocean') || type.includes('view')) return oceanview;
  if (type.includes('balcony')) return balcony;
  if (type.includes('suite')) return suite;
  return balcony || oceanview || interior || suite || 0;
}

export function detectDelimiter(headerLine: string): 'tab' | 'comma' {
  return headerLine.includes('\t') ? 'tab' : 'comma';
}

export function createHeaderMap(headers: string[]): Record<string, number> {
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h] = i;
  });
  return headerMap;
}

export function getColumnIndex(headerMap: Record<string, number>, possibleNames: string[]): number {
  for (const name of possibleNames) {
    const idx = headerMap[name.toLowerCase()];
    if (idx !== undefined) return idx;
  }
  return -1;
}
