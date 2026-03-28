'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadDocument } from '../actions';
import { Upload, X, File as FileIcon, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function UploadDocumentModal({ caseId }: { caseId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [title, setTitle] = useState('');
    const router = useRouter();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!file) return;

        setIsUploading(true);
        const supabase = createClient();
        
        try {
            // 1. Upload to Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('case-documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Build FormData with state values
            const formData = new FormData();
            formData.append('title', title);
            formData.append('caseId', caseId);
            formData.append('filePath', filePath);
            formData.append('fileSize', file.size.toString());
            formData.append('fileType', file.type);
            
            const result = await uploadDocument(formData);
            
            if (result.error) throw new Error(result.error);
            
            // Success - reset form
            alert('✅ Document uploaded successfully!');
            setIsOpen(false);
            setFile(null);
            setTitle('');
            
            // Refresh the page
            router.refresh();

        } catch (err: unknown) {
            alert('Upload failed: ' + getErrorMessage(err));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium"
            >
                <Upload className="h-4 w-4" />
                Upload Document
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#2a2218] border border-amber-900/50 rounded-xl w-full max-w-md shadow-2xl">
                        <div className="p-4 border-b border-amber-900/30 flex justify-between items-center bg-[#1a1410] rounded-t-xl">
                            <h2 className="text-lg font-bold text-amber-50">Upload Document</h2>
                            <button onClick={() => setIsOpen(false)} className="text-amber-400 hover:text-amber-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-amber-100">Document Title</label>
                                <input 
                                    name="title" 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required 
                                    placeholder="e.g., Evidence Document, Legal Notice" 
                                    className="w-full px-4 py-2 bg-[#1a1410] border border-amber-900/30 rounded-lg text-amber-50 focus:border-amber-600 focus:outline-none" 
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-amber-100">File</label>
                                <div className="border-2 border-dashed border-amber-900/40 rounded-lg p-6 text-center hover:border-amber-700/50 transition-colors relative">
                                    <input 
                                        type="file" 
                                        onChange={handleFileChange} 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    />
                                    {file ? (
                                        <div className="flex flex-col items-center gap-2 text-amber-100">
                                            <FileIcon className="h-8 w-8 text-amber-500" />
                                            <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                                            <span className="text-xs text-amber-200/50">{(file.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-amber-200/40">
                                            <Upload className="h-8 w-8" />
                                            <span className="text-sm">Click to select or drag file here</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setIsOpen(false)} 
                                    className="px-4 py-2 text-amber-200 hover:text-amber-100 text-sm"
                                    disabled={isUploading}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={!file || isUploading}
                                    className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 text-sm"
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        'Upload'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
    const getErrorMessage = (err: unknown) => {
        if (err instanceof Error) return err.message;
        if (typeof err === 'string') return err;
        return 'Upload failed';
    };
