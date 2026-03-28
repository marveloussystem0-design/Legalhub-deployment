'use client';

import { useState, useMemo } from 'react';
import { FileText, Download, ArrowRight, X, Sparkles } from 'lucide-react';
import DocumentEditor from '@/components/editor/document-editor';

interface PlaceholderFormProps {
  template: {
    id: string;
    title: string;
    content: string;
  };
  onClose: (filledContent?: string) => void;
}

export default function PlaceholderForm({ template, onClose }: PlaceholderFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [manualContent, setManualContent] = useState<string | null>(null);
  const [isLegalFormat, setIsLegalFormat] = useState(false); 

  // Extract placeholders from template content
  const placeholders = useMemo(() => {
    const fields: Array<{ id: string; label: string; pattern: string; type: 'underscore' | 'dot' | 'implicit' | 'emptySpace' | 'handlebars' }> = [];
    let fieldCounter = 0;
    
    // Parse HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = template.content;
    const textContent = tempDiv.textContent || '';
    const htmlContent = template.content;
    
    const seen = new Set<string>();

    // Helper to clean extracted labels
    const cleanLabel = (text: string) => {
      return text
        .replace(/[_\.]/g, ' ') // Replace underscores/dots with space
        .replace(/{{|}}/g, '') // Remove brackets
        .replace(/\b(Enter|Type|Here|Insert)\b/gi, '') // Remove instruction words
        .replace(/[:\-\(\)]/g, '') // Remove punctuation
        .trim();
    };

    // Helper to add field
    const addField = (pattern: string, position: number, type: 'underscore' | 'dot' | 'implicit' | 'emptySpace' | 'handlebars', explicitLabel?: string) => {
      let label = explicitLabel || '';
      
      if (!label) {
        if (type === 'implicit') {
          label = pattern.replace(':', '').trim();
        } else if (type === 'handlebars') {
             label = cleanLabel(pattern);
        } else {
          // Contextual extraction: Look at words BEFORE the placeholder
          const before = textContent.substring(Math.max(0, position - 50), position);
          // Split by whitespace but keep phrases together if possible
          const cleanBefore = before.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
          const words = cleanBefore.trim().split(' ');
          
          // Grab last few words as label candidates
          const candidates = words.slice(-3).filter(w => w.length > 2); // Filter short words
          
          if (candidates.length > 0) {
            // Join and clean
            label = candidates.join(' ');
          }
        }
      }
      
      // Clean up the label final pass
      label = cleanLabel(label);
      
      // Fallback
      if (!label || label.length < 2) label = `Unknown Field ${fieldCounter + 1}`;
      
      // Capitalize
      label = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(); // Normalize casing

      const fieldId = `field_${fieldCounter}`;
      const uniqueKey = label + "_" + fieldCounter; 
      
      if (!seen.has(uniqueKey)) {
        fields.push({ id: fieldId, label, pattern, type });
        seen.add(uniqueKey);
        fieldCounter++;
      }
    };
    
    // 0. Find Handlebars ({{NAME}}) - Priority 1 (from AI)
    const handlebarsRegex = /{{[\w\s\-_]+}}/g; 
    let match;
    while ((match = handlebarsRegex.exec(textContent)) !== null) {
        addField(match[0], match.index, 'handlebars');
    }

    // 1. Find underscores (_____)
    const underscoreRegex = /_{3,}/g; // Matches 3 or more underscores
    while ((match = underscoreRegex.exec(textContent)) !== null) {
      addField(match[0], match.index, 'underscore');
    }

    // 2. Find dots (...) or Ellipsis (…)
    const dotRegex = /(?:\.{3,}|…+)/g; // 3 dots or more, or ellipsis char
    while ((match = dotRegex.exec(textContent)) !== null) {
      addField(match[0], match.index, 'dot');
    }

    // 3. Find Empty Spaces (   )
    const emptySpaceRegex = /[ \t\u00A0]{3,}/g; // 3 or more spaces
    while ((match = emptySpaceRegex.exec(textContent)) !== null) {
      // confirm it's not just a newline or normal spacing issue by checking it's mostly horizontal layout
      addField(match[0], match.index, 'emptySpace');
    }

    // 4. Find Implicit Labels (Dated:, Place:, etc)
    // Expanded regex to catch more variations and robust spacing
    const implicitRegex = /\b(Dated?|Place|Signed|Witness|Address|Ref(?:\.|)\s*No|From|To|Between|And)\s*:\s*(?=(?:<|&nbsp;|\s|$))/gi;
    while ((match = implicitRegex.exec(htmlContent)) !== null) {
      addField(match[0], match.index, 'implicit', match[1]); // match[1] is the captured label name
    }
    
    return fields;
  }, [template.content]);

  // Generate filled content 
  const autoFilledContent = useMemo(() => {
    let content = template.content;
    let fieldIndex = 0;
    
    // Helper replacement function
    const replaceMatch = (match: string, type: 'underscore' | 'dot' | 'implicit' | 'emptySpace' | 'handlebars') => {
      const field = placeholders[fieldIndex];
      
      if (field) {
        const value = values[field.id];
        fieldIndex++;
        
        // Styling for filled vs empty
        const emptyStyle = "color: #9ca3af; border-bottom: 2px dotted #d1d5db; display: inline-block; min-width: 60px; padding: 0 4px; background: #f9fafb;";
        const filledStyle = "color: #111827; font-weight: 500; border-bottom: 1px solid #e5e7eb; padding: 0 2px;";

        if (type === 'implicit') {
          // e.g. "Dated:" -> "Dated: [Value]"
          if (value) return `${match} <span style="${filledStyle}">${value}</span>`;
          else return `${match} <span style="${emptyStyle}">&nbsp;</span>`;
        } else if (type === 'emptySpace') {
             // For empty space, we want to replace the whitespace with the value or a placeholder
             if (value) return `<span style="${filledStyle}">${value}</span>`;
             else return `<span style="${emptyStyle}">&nbsp;</span>`; 
        } else if (type === 'handlebars') {
             // Replace {{...}} entirely
             if (value) return `<span style="${filledStyle}">${value}</span>`;
             else return `<span style="${emptyStyle}">${field.label}</span>`;
        } else {
          // e.g. "_____" -> "[Value]"
          if (value) return `<span style="${filledStyle}">${value}</span>`;
          else return `<span style="${emptyStyle}">&nbsp;</span>`; // Show simplified empty state
        }
      }
      return match;
    };

    // Replace in same order as extraction
    content = content.replace(/{{[\w\s\-_]+}}/g, (m) => replaceMatch(m, 'handlebars'));
    content = content.replace(/_{3,}/g, (m) => replaceMatch(m, 'underscore'));
    content = content.replace(/(?:\.{3,}|…+)/g, (m) => replaceMatch(m, 'dot'));
    content = content.replace(/[ \t\u00A0]{3,}/g, (m) => replaceMatch(m, 'emptySpace'));
    content = content.replace(/\b(Dated?|Place|Signed|Witness|Address|Ref(?:\.|)\s*No|From|To|Between|And)\s*:\s*(?=(?:<|&nbsp;|\s|$))/gi, (m) => replaceMatch(m, 'implicit'));
    
    return content;
  }, [template.content, placeholders, values]);

  const currentContent = manualContent !== null ? manualContent : autoFilledContent;

  const handleProceedToEdit = () => {
    setIsManualEditing(true);
    setManualContent(autoFilledContent);
  };

  const handleBackToForm = () => {
    if (confirm('Going back will discard your manual edits. Continue?')) {
      setIsManualEditing(false);
      setManualContent(null);
    }
  };

  const handleExportPDF = () => {
    const contentToExport = manualContent !== null ? manualContent : autoFilledContent;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const tempDiv = document.createElement('div'); tempDiv.innerHTML = contentToExport;
    const titleText = template.title.trim().toLowerCase();
    const headers = tempDiv.querySelectorAll('h1, h2, h3, h4, strong, b, p');
    for (let i = 0; i < Math.min(headers.length, 3); i++) {
        const el = headers[i];
        const elText = el.textContent?.trim().toLowerCase() || '';
        if (elText.length > 5 && (elText.includes(titleText) || titleText.includes(elText))) { el.remove(); break; }
    }
    
    const doc = iframe.contentWindow?.document;
    if (!doc) { alert('Print blocked'); return; }
    
    // Page Dimensions
    const pageSize = isLegalFormat ? 'Legal' : 'A4';
    
    // CSS for Paged Media
    // Legal Format: 
    // - Page 1: 90mm Top Margin (for Stamp)
    // - Page 2+: 25mm Top Margin
    // - All Pages: 40mm Left (Gutter), 25mm Right/Bottom
    
    // CSS for Paged Media
    // Legal Format: 
    // - Page 1: 90mm Top Margin (for Stamp)
    // - Page 2+: 25mm Top Margin
    // - All Pages: 40mm Left (Gutter for Binding), 25mm Right/Bottom
    // Standard A4:
    // - All Pages: 25mm Symmetric Margins (approx 1 inch)
    
    const pageMargins = isLegalFormat 
      ? `
        @page { size: ${pageSize}; margin: 25mm 25mm 25mm 40mm; }
        @page :first { margin-top: 90mm; }
      `
      : `@page { size: ${pageSize}; margin: 25mm; }`; 

    // We intentionally leave <title> empty to prevent the browser from printing the document title in the header
    // The Date/URL headers must be disabled by the user in the Print Dialog (Headers & Footers: None)
    
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>&nbsp;</title><style>
       ${pageMargins}
       body { 
         font-family: 'Times New Roman', serif; 
         font-size: 12pt; 
         line-height: 1.6; 
         color: #000; 
         background: #fff; 
         margin: 0; 
         padding: 0;
       }
       h1.main-title { text-align: center; margin-bottom: 2em; text-transform: uppercase; font-weight: bold; }
       h1, h2, h3, h4 { text-align: center; margin-bottom: 1em; } 
       p { margin-bottom: 1em; text-align: justify; hyphens: auto; }
       .center { text-align: center; } .right { text-align: right; } strong { font-weight: bold; }
       table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
       td, th { border: 1px solid #000; padding: 4px 8px; text-align: left; }
       </style></head><body>${isLegalFormat ? '' : `<h1 class="main-title">${template.title}</h1>`}<div class="content-body">${tempDiv.innerHTML}</div></body></html>`);
    doc.close();
    
    // Alert user about headers
    alert("For the best result, please uncheck 'Headers and footers' in the Print Destination settings.");

    iframe.contentWindow?.focus();
    setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 2000); }, 500);
  };

  const handleSaveAndClose = () => { onClose(currentContent); };

  if (placeholders.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex justify-center mb-4 text-green-600 bg-green-50 w-16 h-16 rounded-full items-center mx-auto">
             <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Ready to Edit</h3>
          <h4 className="text-sm font-medium text-gray-500 text-center mb-6">{template.title}</h4>
          
          <p className="text-gray-600 mb-8 text-center">
            This template doesn&apos;t require any initial field filling. You can proceed directly to the editor.
          </p>
          
          <div className="flex flex-col gap-3">
             <button onClick={() => onClose(template.content)} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-lg shadow-lg shadow-teal-700/20 transition-all hover:-translate-y-0.5">
               Open in Editor
             </button>
             <button onClick={() => onClose()} className="w-full py-3 text-gray-400 hover:text-gray-600 font-medium">
               Cancel
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-gray-200 rounded-xl max-w-[95vw] w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header - Compact */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex justify-between items-center z-10 shadow-sm">
           <div className="flex items-center gap-6">
              {/* Stepper */}
             <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${!isManualEditing ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>1</div>
                {!isManualEditing && <div className="text-gray-900 font-bold text-sm">Fill Details</div>}
             </div>
             <div className="h-px w-6 bg-gray-200"></div>
             <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${isManualEditing ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>2</div>
                {isManualEditing && <div className="text-gray-900 font-bold text-sm">Review & Edit</div>}
             </div>
           </div>
          
           <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                 <button 
                   onClick={() => setIsLegalFormat(false)}
                   className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${!isLegalFormat ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                   Standard A4
                 </button>
                 <button 
                   onClick={() => setIsLegalFormat(true)}
                   className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${isLegalFormat ? 'bg-white text-green-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                   Legal Bond
                 </button>
              </div>

               <button
                  onClick={() => onClose()}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
               </button>
           </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex bg-gray-50">
           {/* Sidebar: Fields */}
           {!isManualEditing && (
             <div className="w-80 border-r border-gray-200 bg-white p-5 overflow-y-auto shrink-0 z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
               <div className="mb-6">
                 <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1" title={template.title}>{template.title}</h3>
                 <p className="text-xs text-gray-500">Fill in the fields below to populate.</p>
               </div>
               
               <div className="space-y-4 pb-20">
                 {placeholders.map((field, idx) => (
                   <div key={field.id} className="group animate-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}>
                     <label className="text-xs font-semibold text-gray-600 block mb-1.5 uppercase tracking-wide group-focus-within:text-teal-600 transition-colors">
                       {field.label}
                     </label>
                     <input
                       type="text"
                       value={values[field.id] || ''}
                       onChange={(e) => setValues({ ...values, [field.id]: e.target.value })}
                       className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:bg-white focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all shadow-sm"
                       placeholder={`...`}
                     />
                   </div>
                 ))}
               </div>
             </div>
           )}

          {/* Preview Panel */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
             <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-gray-100/50">
                <div 
                   className={`
                     bg-white shadow-xl shadow-gray-200 transition-all duration-300 relative
                     ${isLegalFormat 
                        ? 'w-[216mm] min-h-[356mm] pt-[90mm] pl-[40mm] pr-[25mm] pb-[25mm] border-t-0' 
                        : 'w-[210mm] min-h-[297mm] p-12'}
                   `}
                >
                  {isLegalFormat && (
                     <div className="absolute top-0 left-0 w-full h-[90mm] bg-green-50/10 border-b border-dashed border-green-200/50 flex items-center justify-center pointer-events-none">
                       <span className="text-green-600/20 text-xs font-bold uppercase tracking-widest select-none bg-white/50 px-2 py-1 rounded">Stamp Paper Header Zone (90mm)</span>
                     </div>
                  )}
                  
                  {isManualEditing ? (
                     <DocumentEditor 
                       content={manualContent || ''} 
                       onUpdate={(newContent) => setManualContent(newContent)}
                       editable={true}
                       isLegalFormat={isLegalFormat}
                     />
                  ) : (
                    <div 
                      className="prose prose-sm max-w-none prose-p:text-justify prose-headings:text-center font-serif text-black"
                      dangerouslySetInnerHTML={{ __html: autoFilledContent }}
                    />
                  )}
                </div>
             </div>
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="p-3 border-t border-gray-200 bg-white flex justify-between items-center z-20">
          {isManualEditing ? (
            <>
               <button
                onClick={handleBackToForm}
                className="px-4 py-2 hover:bg-gray-100 text-gray-600 font-medium rounded-lg text-sm transition-colors"
              >
                ← Back
              </button>
              <div className="flex gap-3">
                 <button
                  onClick={handleExportPDF}
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition-colors"
                >
                  <Download className="h-4 w-4" />
                  PDF Preview
                </button>
                <button
                  onClick={handleSaveAndClose}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm font-semibold shadow-md shadow-green-600/20 transition-all hover:translate-y-[-1px]"
                >
                  <FileText className="h-4 w-4" />
                  Finalize Draft
                </button>
              </div>
            </>
          ) : (
            <>
               <button
                onClick={() => onClose()}
                className="px-4 py-2 hover:bg-gray-100 text-gray-500 font-medium rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-3 items-center">
                 <span className="text-xs text-gray-400 mr-2">Preview looks good?</span>
                 <button
                  onClick={handleProceedToEdit}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg shadow-teal-600/20 transition-all hover:-translate-y-0.5"
                >
                  Next: Final Review <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
