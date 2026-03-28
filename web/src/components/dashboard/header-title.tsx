'use client';

import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function HeaderTitle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = searchParams.get('view');

  let headerConfig: { title: string; backUrl?: string; useRouterBack?: boolean } | null = null;

  if (view === 'courts') {
    headerConfig = {
      title: 'Court Directory',
      backUrl: pathname,
      useRouterBack: true
    };
  } else {
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const isSubPage = (segments[1] === 'client' || segments[1] === 'advocate') && segments.length > 2;

    const titleMap: Record<string, string> = {
      'cases': 'My Cases',
      'profile': 'My Profile',
      'messages': 'Messages',
      'find-advocate': 'Find Advocate',
      'ai-assistant': 'AI Assistant',
      'knowledge-base': 'Knowledge Base',
      'hearings': 'Hearings',
      'clients': 'My Clients',
    };

    if (pathname.includes('/find-advocate/') && segments.length > 3) {
      const name = searchParams.get('name');
      headerConfig = {
        title: name || 'Advocate Profile',
        backUrl: pathname.split('/').slice(0, -1).join('/'),
      };
    } else if (pathname.includes('/cases/') && segments.length > 3) {
      headerConfig = {
        title: 'Case Details',
        backUrl: pathname.split('/').slice(0, -1).join('/'),
      };
    } else if (isSubPage) {
      headerConfig = {
        title: titleMap[lastSegment] || lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1),
        backUrl: `/${segments.slice(0, 2).join('/')}`,
      };
    } else if (pathname === '/dashboard/client' || pathname === '/dashboard/advocate' || pathname === '/dashboard/admin') {
      headerConfig = { title: 'Dashboard' };
    }
  }

  if (!headerConfig) return null;

  const handleBack = () => {
    if (headerConfig.useRouterBack) {
       // If we are on ?view=courts, we just want to go back to the base dashboard
       router.push(pathname); 
    } else if (headerConfig.backUrl) {
      router.push(headerConfig.backUrl);
    }
  };

  return (
    <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-200">
      {(headerConfig.backUrl || headerConfig.useRouterBack) && (
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center border border-gray-200 bg-white shadow-sm group"
          title="Go Back"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600 group-hover:text-teal-600 transition-colors" />
        </button>
      )}
      <h1 className="text-xl font-bold text-gray-900 tracking-tight">
        {headerConfig.title}
      </h1>
    </div>
  );
}
