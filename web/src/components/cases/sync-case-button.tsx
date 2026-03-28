
'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import SyncModal from './sync-modal';
// import { toast } from 'sonner';

interface SyncCaseButtonProps {
  caseId: string;
  cnrNumber?: string;
}

export default function SyncCaseButton({ caseId, cnrNumber }: SyncCaseButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (!cnrNumber) {
        alert('This case does not have a CNR Number linked.');
        return;
    }
    setIsModalOpen(true);
  };

  return (
    <>
      <button 
        onClick={handleClick}
        className="flex items-center px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Sync eCourts
      </button>

      {cnrNumber && (
          <SyncModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            caseId={caseId}
            cnrNumber={cnrNumber}
          />
      )}
    </>
  );
}
