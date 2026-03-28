'use client';

import Link from "next/link";
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, MessageSquare } from "lucide-react";

type ClientViewModel = {
  full_name: string;
  phone?: string | null;
  address?: string | null;
  user?: { email?: string | null };
};

type ClientCase = {
  id: string;
  title?: string | null;
  status?: string | null;
  case_number?: string | null;
  next_hearing_date?: string | null;
};

export default function ClientProfileView({ client, cases }: { client: ClientViewModel, cases: ClientCase[] }) {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/advocate/clients" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.full_name}</h1>
            <p className="text-gray-500 text-sm">Client Profile</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Contact Info */}
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex flex-col items-center mb-6">
                    <div className="h-20 w-20 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 text-2xl font-bold mb-3">
                        {client.full_name.charAt(0).toUpperCase()}
                    </div>
                    <h2 className="font-bold text-gray-900">{client.full_name}</h2>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1">Client</span>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600 truncate">{client.user?.email || 'No email linked'}</span>
                    </div>
                    {client.phone && (
                        <div className="flex items-center gap-3 text-sm">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">{client.phone}</span>
                        </div>
                    )}
                    {client.address && (
                        <div className="flex items-start gap-3 text-sm">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                            <span className="text-gray-600">{client.address}</span>
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                    <button className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
                        <MessageSquare className="h-4 w-4" />
                        Send Message
                    </button>
                    <p className="text-xs text-center text-gray-400 mt-2">Coming in Phase 15</p>
                </div>
            </div>
        </div>

        {/* Right Column: Cases & Activity */}
        <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-teal-600" />
                    Active Cases
                </h3>
                
                {cases && cases.length > 0 ? (
                    <div className="space-y-3">
                        {cases.map((c) => (
                            <Link key={c.id} href={`/dashboard/advocate/cases/${c.id}`}>
                                <div className="p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors group">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-medium text-gray-900 group-hover:text-teal-700 transition-colors">{c.title}</h4>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                            c.status === 'open' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-100 text-gray-600 border-gray-200'
                                        }`}>
                                            {(c.status || 'unknown').toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2">Case #: {c.case_number || 'Pending'}</p>
                                    
                                    {c.next_hearing_date && (
                                        <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 inline-flex px-2 py-1 rounded">
                                            <Calendar className="h-3 w-3" />
                                            Next Hearing: {new Date(c.next_hearing_date).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        No active cases found for this client.
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
