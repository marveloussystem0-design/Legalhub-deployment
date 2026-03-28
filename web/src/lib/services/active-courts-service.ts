import { createClient } from '@/lib/supabase/server';

export interface ActiveCourt {
    courtName: string;
    caseCount: number;
    advocateCount: number;
    cases: Array<{
        number: string;
        title: string;
    }>;
}

export class ActiveCourtsService {
    /**
     * Get list of courts where we have active cases
     * Sorted by case count (descending)
     */
    static async getRecommendedCourts(): Promise<ActiveCourt[]> {
        const supabase = await createClient();
        
        // Fetch all cases with their court names and advocate IDs
        const { data: cases, error } = await supabase
            .from('cases')
            .select('court_name, created_by, case_number, title');

        if (error) {
            console.error('Error fetching cases:', error);
            return [];
        }

        // Aggregate by court
        const courtMap = new Map<string, { 
            caseCount: number; 
            advocates: Set<string>;
            caseList: Array<{ number: string; title: string }>;
        }>();
        
        cases.forEach(c => {
            const courtName = c.court_name || 'Unknown Court';
            
            if (!courtMap.has(courtName)) {
                courtMap.set(courtName, {
                    caseCount: 0,
                    advocates: new Set(),
                    caseList: []
                });
            }
            
            const court = courtMap.get(courtName)!;
            court.caseCount++;
            if (c.created_by) {
                court.advocates.add(c.created_by);
            }
            
            // Add case details
            if (c.case_number || c.title) {
                court.caseList.push({
                    number: c.case_number || 'No Number',
                    title: c.title || 'Untitled Case'
                });
            }
        });

        // Convert to array and sort
        const results: ActiveCourt[] = Array.from(courtMap.entries())
            .map(([courtName, data]) => ({
                courtName,
                caseCount: data.caseCount,
                advocateCount: data.advocates.size,
                cases: data.caseList.sort((a, b) => a.number.localeCompare(b.number))
            }))
            .sort((a, b) => b.caseCount - a.caseCount);

        return results;
    }

    /**
     * Check if a specific court is in our active list
     */
    static async isActiveCourt(courtName: string): Promise<boolean> {
        const courts = await this.getRecommendedCourts();
        return courts.some(c => c.courtName.toLowerCase() === courtName.toLowerCase());
    }
}
