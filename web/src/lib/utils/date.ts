export function getHearingDate(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  
  const d = new Date(date);
  
  // Check if valid
  if (isNaN(d.getTime())) return null;
  
  // Convert to IST (Indian Standard Time)
  // We use string manipulation on the locale date string to ensure YYYY-MM-DD format
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  } catch {
    // Fallback if Intl is not supported (unlikely)
    // Manually adjust for UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  }
}
