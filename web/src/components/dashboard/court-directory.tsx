'use client';

import { useState, useMemo } from 'react';
import { Search, MapPin, ChevronLeft, ExternalLink, School, Globe } from 'lucide-react';
import courtData from '@/lib/data/court-hierarchy.json';
import TNInteractiveMap from './tn-interactive-map';

interface Court {
    name: string;
    address: string;
    mapParams: string;
}

interface District {
    name: string;
    courts: Court[];
}

export default function CourtDirectory() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

    // Flatten districts for easier filtering
    const districts = useMemo(() => {
        return courtData[0]?.districts || [] as District[];
    }, []);

    const activeDistrictData = useMemo(() => {
        if (!selectedDistrict) return null;
        return districts.find(d => d.name === selectedDistrict);
    }, [districts, selectedDistrict]);

    const filteredCourts = useMemo(() => {
        if (!activeDistrictData) return [];
        if (!searchTerm) return activeDistrictData.courts;
        
        const lowerSearch = searchTerm.toLowerCase();
        return activeDistrictData.courts.filter(court => 
            court.name.toLowerCase().includes(lowerSearch) || 
            court.address.toLowerCase().includes(lowerSearch)
        );
    }, [activeDistrictData, searchTerm]);

    const handleDistrictSelect = (name: string) => {
        setSelectedDistrict(name);
        setViewMode('list');
    };

    const getGoogleMapsUrl = (court: Court) => {
        const query = court.mapParams || `${court.name} ${court.address}`;
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    };

    return (
        <div className={`overflow-hidden flex flex-col ${viewMode === 'map' ? 'bg-transparent border-none shadow-none min-h-[600px]' : 'bg-white border border-gray-200 rounded-xl shadow-sm h-[700px]'}`}>
            {/* Header - Only shown in list view to maintain "only map" experience in map mode */}
            {viewMode === 'list' && (
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setViewMode('map')}
                                className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
                                title="Back to Map"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <School className="h-5 w-5 text-teal-600" />
                                    {selectedDistrict}
                                </h2>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {filteredCourts.length} courts available in this district
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search courts..."
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button 
                                onClick={() => setViewMode('map')}
                                className="p-2 bg-teal-50 text-teal-700 border border-teal-100 rounded-lg hover:bg-teal-100 transition-all flex items-center gap-2 text-xs font-bold"
                            >
                                <Globe className="h-4 w-4" />
                                <span className="hidden sm:inline">Map View</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
                {viewMode === 'map' ? (
                    <div className="p-0 flex items-center justify-center bg-transparent flex-1 overflow-hidden min-h-[500px]">
                        <div className="w-full h-full max-w-2xl mx-auto flex items-center justify-center">
                             <TNInteractiveMap 
                                onDistrictSelect={handleDistrictSelect}
                                activeDistrict={selectedDistrict || undefined}
                             />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/20">
                        {filteredCourts.length > 0 ? (
                            filteredCourts.map((court, idx) => (
                                <div 
                                    key={idx} 
                                    className="bg-white border border-gray-100 rounded-xl p-5 hover:border-teal-200 hover:shadow-md transition-all group relative overflow-hidden"
                                >
                                    {/* Accent line */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
                                    
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-teal-50 text-teal-600 rounded-md">
                                                    <MapPin className="h-3.5 w-3.5" />
                                                </div>
                                                <h4 className="font-bold text-gray-900 group-hover:text-teal-700 transition-colors">
                                                    {court.name}
                                                </h4>
                                            </div>
                                            <p className="text-xs text-gray-500 leading-relaxed max-w-xl pl-8">
                                                {court.address}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 pl-8 md:pl-0">
                                            <a
                                                href={getGoogleMapsUrl(court)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-black hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-all shadow-sm active:scale-95"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                <span>NAVIGATE</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20">
                                <div className="inline-flex p-6 rounded-full bg-gray-100 mb-6 shadow-inner">
                                    <Search className="h-10 w-10 text-gray-300" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">No courts found</h3>
                                <p className="text-gray-500 max-w-xs mx-auto">
                                    We couldn&apos;t find any courts matching &quot;{searchTerm}&quot; in {selectedDistrict}.
                                </p>
                                <button 
                                    onClick={() => setSearchTerm('')}
                                    className="mt-6 text-teal-600 font-bold hover:underline text-sm"
                                >
                                    Clear search filters
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Footer */}
            {viewMode === 'list' && (
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">
                        Official eCourts Data Layer
                    </p>
                    <span className="text-[10px] font-bold text-teal-600/60 uppercase tracking-widest flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                        Live in {selectedDistrict}
                    </span>
                </div>
            )}
        </div>
    );
}
