function robustParse(metaRaw) {
    if (!metaRaw || typeof metaRaw !== 'string') return null;
    
    // 1. Remove ordinal suffixes: 1st, 2nd, 3rd, 4th...
    const clean = metaRaw.replace(/(\d+)(st|nd|rd|th)/, '$1');
    
    // 2. Try standard parsing
    let d = new Date(clean);
    
    // 3. Fallback: Split and reorder if parsing failed or produced weird results
    // Example: "04 March 2026"
    if (isNaN(d.getTime())) {
        const parts = clean.split(' ');
        if (parts.length === 3) {
            // Try "March 04 2026"
            d = new Date(`${parts[1]} ${parts[0]} ${parts[2]}`);
        }
    }
    
    return d;
}

const testDates = ["04th March 2026", "03rd March 2026", "13th February 2026"];
testDates.forEach(rd => {
    const d = robustParse(rd);
    console.log(`Raw: [${rd}] -> Parsed: [${d ? d.toISOString().split('T')[0] : 'failed'}]`);
});
