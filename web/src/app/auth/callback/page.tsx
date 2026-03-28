import { Suspense } from 'react';
import CallbackClient from './callback-client';
import { Loader2 } from 'lucide-react';

export default function CallbackPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-[#1a1410] flex items-center justify-center p-4">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 text-amber-500 animate-spin mx-auto" />
            <h1 className="text-xl font-bold text-amber-50">Loading legal authentication...</h1>
          </div>
        </div>
      }
    >
      <CallbackClient />
    </Suspense>
  );
}
