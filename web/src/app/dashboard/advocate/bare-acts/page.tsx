'use client';

import { Book, ExternalLink, ArrowRight } from 'lucide-react';

const ACTS = [
  {
    id: 'IPC',
    title: 'Indian Penal Code, 1860',
    shortName: 'IPC',
    url: 'https://www.indiacode.nic.in/handle/123456789/2263',
    description: 'Defines criminal offenses and prescribes punishments',
    color: '#EF4444',
  },
  {
    id: 'CrPC',
    title: 'Code of Criminal Procedure, 1973',
    shortName: 'CrPC',
    url: 'https://www.indiacode.nic.in/handle/123456789/1362',
    description: 'Procedural law for criminal matters in India',
    color: '#F59E0B',
  },
  {
    id: 'CPC',
    title: 'Code of Civil Procedure, 1908',
    shortName: 'CPC',
    url: 'https://www.indiacode.nic.in/handle/123456789/1469',
    description: 'Procedural law for civil litigation',
    color: '#3B82F6',
  },
  {
    id: 'Evidence',
    title: 'Indian Evidence Act, 1872',
    shortName: 'Evidence Act',
    url: 'https://www.indiacode.nic.in/handle/123456789/2191',
    description: 'Rules regarding admissibility of evidence',
    color: '#8B5CF6',
  },
  {
    id: 'Constitution',
    title: 'Constitution of India',
    shortName: 'Constitution',
    url: 'https://www.indiacode.nic.in/handle/123456789/1362',
    description: 'Supreme law of India',
    color: '#059669',
  },
  {
    id: 'Companies',
    title: 'Companies Act, 2013',
    shortName: 'Companies Act',
    url: 'https://www.indiacode.nic.in/handle/123456789/2114',
    description: 'Regulation of companies in India',
    color: '#0891B2',
  },
];

export default function BareActsPage() {
  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
            <Book className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bare Acts Library</h1>
            <p className="text-gray-600 mt-1">Access official Indian legislation from IndiaCode</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <ExternalLink className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Powered by IndiaCode</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              All acts are sourced from <span className="font-semibold">IndiaCode.nic.in</span>, the official repository of Central and State Acts maintained by the Government of India. 
              Click any act below to view the complete, up-to-date legislation on the official portal.
            </p>
          </div>
        </div>
      </div>

      {/* Acts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ACTS.map((act) => (
          <a
            key={act.id}
            href={act.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border border-gray-200 rounded-xl p-6 hover:border-teal-500 hover:shadow-xl transition-all duration-200"
          >
            {/* Act Icon */}
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${act.color}15` }}
            >
              <Book className="h-7 w-7" style={{ color: act.color }} />
            </div>

            {/* Act Title */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span 
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ 
                    backgroundColor: `${act.color}15`,
                    color: act.color 
                  }}
                >
                  {act.shortName}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg leading-tight">
                {act.title}
              </h3>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 leading-relaxed">
              {act.description}
            </p>

            {/* External Link Indicator */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
              <ExternalLink className="h-3 w-3" />
              <span>Opens in IndiaCode.nic.in</span>
            </div>
          </a>
        ))}
      </div>

      {/* Browse All Link */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <h3 className="font-semibold text-gray-900 mb-2">Looking for other acts?</h3>
        <p className="text-gray-600 mb-4">Browse the complete collection of Indian legislation</p>
        <a
          href="https://www.indiacode.nic.in/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors"
        >
          Visit IndiaCode
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

    </div>
  );
}
