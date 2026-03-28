"use client";

import { useState } from "react";
import { Edit2, Check, X, Loader2 } from "lucide-react";
import { updateCaseTitleAction } from "@/app/actions/cases";
import { useRouter } from "next/navigation";

interface EditableTitleProps {
  caseId: string;
  initialTitle: string;
}

export default function EditableTitle({ caseId, initialTitle }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle === initialTitle.trim()) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      const result = await updateCaseTitleAction(caseId, trimmedTitle);
      if (result.success) {
        setIsEditing(false);
        router.refresh();
      } else {
        alert(result.error || "Failed to update title");
      }
    } catch {
      alert("An error occurred while updating the title");
    } finally {
      setLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 group">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add custom case name..."
          className="text-3xl font-bold text-gray-900 border-b-2 border-teal-500 focus:outline-none bg-transparent w-full"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setIsEditing(false);
          }}
        />
        <button
          onClick={handleSave}
          disabled={loading}
          className="p-1 hover:bg-green-50 text-green-600 rounded-md transition-colors"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
        </button>
        <button
          onClick={() => {
            setIsEditing(false);
            setTitle(initialTitle);
          }}
          disabled={loading}
          className="p-1 hover:bg-red-50 text-red-600 rounded-md transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 group bg-transparent hover:bg-teal-50/30 p-2 -ml-2 rounded-xl transition-colors">
      <h1 className={`text-3xl font-bold ${title ? 'text-gray-900' : 'text-gray-400 italic'}`}>
        {title || "Add custom case name..."}
      </h1>
      <button
        onClick={() => setIsEditing(true)}
        className="p-2 bg-white border border-teal-100 shadow-sm text-teal-600 hover:bg-teal-600 hover:text-white rounded-lg transition-all flex items-center gap-1.5 shrink-0"
        title="Edit Custom Case Name"
      >
        <Edit2 className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Edit</span>
      </button>
    </div>
  );
}
