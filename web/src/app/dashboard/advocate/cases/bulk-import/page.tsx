'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parseBulkImportFile, ParsedCase } from '@/lib/ecourts/parser';
import Link from 'next/link';

type BatchImportError = { case_number: string; error: string };
type BatchImportDuplicate = { case_number: string };
type BatchImportResponse = {
  success?: ParsedCase[];
  errors?: BatchImportError[];
  duplicates?: BatchImportDuplicate[];
  error?: string;
};

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [parsedResults, setParsedResults] = useState<{
    total: number;
    data: ParsedCase[];
    errors: { line: number; message: string }[];
  } | null>(null);
  const [importStatus, setImportStatus] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [isPlanEligible, setIsPlanEligible] = useState<boolean | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const loadEligibility = async () => {
      try {
        const res = await fetch('/api/subscription/status', { cache: 'no-store' });
        const data = await res.json() as { subscription?: { canBulkImport?: boolean }; error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to verify subscription');
        setIsPlanEligible(Boolean(data.subscription?.canBulkImport));
      } catch (e: unknown) {
        setPlanError(e instanceof Error ? e.message : 'Failed to verify subscription');
      }
    };

    void loadEligibility();
  }, []);

  const handleRetry = () => {
    setImportStatus(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setImportStatus(null);
      
      // Auto-parse on selection
      const text = await selectedFile.text();
      const result = parseBulkImportFile(text);
      setParsedResults({
        total: result.data.length,
        data: result.data,
        errors: result.errors
      });
    }
  };

  const handleImport = async () => {
    if (!parsedResults || parsedResults.data.length === 0) return;
    
    setImporting(true);
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Process in batches of 50
      const BATCH_SIZE = 50;
      const batches = [];
      
      for (let i = 0; i < parsedResults.data.length; i += BATCH_SIZE) {
        batches.push(parsedResults.data.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        try {
          // Send batch to API
          const response = await fetch('/api/cases/bulk-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cases: batch })
          });

          const result: BatchImportResponse = await response.json();

          if (!response.ok) {
             throw new Error(result.error || 'Batch import failed');
          }

          // Count successes
          if (result.success) {
            successCount += result.success.length;
          }

          // Handle per-case errors in batch
          if (result.errors && result.errors.length > 0) {
            failCount += result.errors.length;
            result.errors.forEach((err: BatchImportError) => {
              errors.push(`Case ${err.case_number}: ${err.error}`);
            });
          }
           
          // Handle duplicates
          if (result.duplicates && result.duplicates.length > 0) {
            failCount += result.duplicates.length;
            result.duplicates.forEach((dup: BatchImportDuplicate) => {
               errors.push(`Duplicate: ${dup.case_number}`);
            });
          }

        } catch (err: unknown) {
          // If entire batch fails (e.g. network error)
          failCount += batch.length;
          errors.push(`Batch error: ${getErrorMessage(err)}`);
        }
      }

      setImportStatus({
        success: successCount,
        failed: failCount,
        errors
      });

    } catch (error: unknown) {
      alert('Import process failed: ' + getErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      {isPlanEligible === false && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Bulk import is available only for Medium and Pro plans.
          <div className="mt-2">
            <Link href="/signup" className="font-semibold underline underline-offset-4">
              View plans
            </Link>
          </div>
        </div>
      )}
      {planError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {planError}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bulk Import Cases</h1>
        <p className="text-gray-600 mt-2">Upload a text file to import multiple cases at once.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
            <input
              type="file"
              accept=".txt,.csv,.json"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              disabled={importing || isPlanEligible === false}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <div className="bg-blue-100 p-4 rounded-full mb-4">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {file ? file.name : 'Click to upload'}
              </p>
              <p className="text-sm text-gray-500 mt-1">JSON, TXT or CSV files</p>
            </label>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">Required Format</h3>
            <pre className="text-xs bg-white p-2 rounded border border-amber-100 overflow-x-auto text-amber-900">
{`JSON Array:
[{ "cino": "...", "case_no": "...", "petparty_name": "..." }]

csv
CNR,Case No,Type,Court,Date,Petitioner,Respondent,Status`}
            </pre>
            <p className="text-xs text-amber-700 mt-2">
              <strong>Note:</strong> This tool imports data <em>as-is</em>. It does not automatically fetch details from eCourts. 
              For automated syncing, please use the &quot;Add Case via CNR&quot; button on the main dashboard.
            </p>

          </div>

          {parsedResults && parsedResults.data.length > 0 && !importStatus && (
            <div className="space-y-3">
              <button
                onClick={handleImport}
                disabled={importing || isPlanEligible === false}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50 transition-all"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Import {parsedResults.data.length} Cases
                  </>
                )}
              </button>

              {importing && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  Please wait a few minutes while the bulk import runs. Large files are processed in batches and may take some time to complete.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="lg:col-span-2">
          {/* Parse Preview */}
          {parsedResults && !importStatus && (
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Preview Cases</h3>
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                  {parsedResults.total} found
                </span>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0">
                    <tr>
                      <th className="px-6 py-3">CINO/CNR</th>
                      <th className="px-6 py-3">Case No</th>
                      <th className="px-6 py-3">Parties</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedResults.data.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-mono text-xs">{c.cino || c.cnr_number}</td>
                        <td className="px-6 py-3">{c.case_number}</td>
                        <td className="px-6 py-3 text-gray-600">
                          {c.petitioner_name} vs {c.respondent_name}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            c.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Results */}
          {importStatus && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 p-6 rounded-xl text-center">
                  <p className="text-3xl font-bold text-green-600">{importStatus.success}</p>
                  <p className="text-green-800 font-medium">Successfully Imported</p>
                </div>
                <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-center">
                  <p className="text-3xl font-bold text-red-600">{importStatus.failed}</p>
                  <p className="text-red-800 font-medium">Failed</p>
                </div>
              </div>

              {importStatus.failed > 0 && (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-900">
                      Some cases failed to import. You can retry with the same file, or reload this page if the import summary looks stuck.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        onClick={handleRetry}
                        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                      >
                        Retry Import
                      </button>
                      <button
                        onClick={() => window.location.reload()}
                        className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                      >
                        Reload Page
                      </button>
                    </div>
                  </div>
                  <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
                  <div className="bg-red-50 px-6 py-3 border-b border-red-100 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <h3 className="font-semibold text-red-900">Error Details</h3>
                  </div>
                  <div className="p-6 max-h-60 overflow-y-auto bg-gray-50">
                    <ul className="space-y-2 text-sm text-red-600 font-mono">
                      {importStatus.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                </>
              )}
            </div>
          )}

          {!parsedResults && !importStatus && (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p>Upload a file to see preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Import failed';
  };
