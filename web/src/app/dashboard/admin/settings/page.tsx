'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Settings, Save, Eye, EyeOff, AlertCircle, Trash2, Plus } from 'lucide-react';

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  description: string | null;
  is_encrypted: boolean;
  updated_at?: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [editedDescriptions, setEditedDescriptions] = useState<Record<string, string>>({});
  
  // New Setting Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const supabase = createClient();

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('setting_key');

      if (error) throw error;
      setSettings(data || []);
      
      const initialValues: Record<string, string> = {};
      const initialDescs: Record<string, string> = {};
      data?.forEach(s => {
        initialValues[s.setting_key] = s.setting_value || '';
        initialDescs[s.setting_key] = s.description || '';
      });
      setEditedValues(initialValues);
      setEditedDescriptions(initialDescs);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (settingKey: string) => {
    setSaving(settingKey);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('system_settings')
        .update({ 
          setting_value: editedValues[settingKey] || null,
          description: editedDescriptions[settingKey] || null,
          updated_by: user.id 
        })
        .eq('setting_key', settingKey);

      if (error) throw error;

      setEditingKey(null);
      await fetchSettings();
    } catch (error: unknown) {
      console.error('Failed to save setting:', error);
    } finally {
      setSaving(null);
    }
  };

  const handleAddSetting = async () => {
    if (!newKey) return;
    setIsAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('system_settings')
        .insert({
          setting_key: newKey,
          setting_value: newValue,
          description: newDesc,
          updated_by: user?.id
        });

      if (error) throw error;
      
      setNewKey('');
      setNewValue('');
      setNewDesc('');
      setShowAddForm(false);
      await fetchSettings();
    } catch (error) {
      console.error('Failed to add setting:', error);
      alert('Failed to add setting');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSetting = async (settingKey: string) => {
    if (!confirm(`Are you sure you want to delete "${settingKey}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('system_settings')
        .delete()
        .eq('setting_key', settingKey);

      if (error) throw error;
      await fetchSettings();
    } catch (error) {
      console.error('Failed to delete setting:', error);
      alert('Failed to delete setting');
    }
  };

  const toggleShowValue = (key: string) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-gray-600 mt-4 font-medium">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header Section - No redundant button */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-white opacity-80" />
          <div>
            <h1 className="text-xl font-bold text-white">System Settings</h1>
          </div>
        </div>
      </div>



      {/* Instructions Section - Detailed & Collapsible */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden shadow-sm">
        <button 
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between p-4 text-amber-900 font-bold text-sm hover:bg-amber-100/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Detailed News Feed Configuration Guide</span>
          </div>
          <span className="text-xs bg-amber-200/50 px-2 py-1 rounded border border-amber-300">
            {showInstructions ? 'Hide Instructions' : 'Show Instructions'}
          </span>
        </button>

        {showInstructions && (
          <div className="p-4 pt-0 border-t border-amber-100 text-xs animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-amber-900">
              <div className="space-y-3">
                <h3 className="font-black uppercase tracking-widest text-[10px] text-amber-700">1. Naming & Logic</h3>
                <ul className="space-y-2">
                  <li className="flex gap-2">
                    <span className="font-bold">Key Format:</span>
                    <span>Must start with <code className="bg-amber-200 px-1 rounded font-mono">news_rss_url_</code> (e.g., <code className="bg-amber-200 px-1 rounded">news_rss_url_chennai</code>).</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">Automatic Merging:</span>
                    <span>The system finds ALL keys with this prefix and combines them into one live feed for advocates.</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="font-black uppercase tracking-widest text-[10px] text-amber-700">2. Generating the URL</h3>
                <ol className="space-y-2">
                  <li>
                    <span className="font-bold">Step 1:</span> Start with this base: <br/>
                    <code className="block mt-1 p-2 bg-amber-200/50 rounded font-mono text-[10px] border border-amber-200">https://news.google.com/rss/search?q=</code>
                  </li>
                  <li>
                    <span className="font-bold">Step 2:</span> Type your search (e.g., <code className="font-bold italic">Mumbai+Courts</code>) after the <code className="font-bold">=</code>.
                  </li>
                  <li>
                    <span className="font-bold">Step 3:</span> Add <code className="bg-amber-200 px-1 rounded text-[10px]">hl=en-IN&gl=IN&ceid=IN:en</code> to force English-India results.
                  </li>
                  <li className="pt-1 italic text-amber-700 border-t border-amber-200 mt-2">
                    Final Result Example: <code className="break-all opacity-80">...search?q=Chennai+Law&hl=en-IN...</code>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add New Setting Action / Form - Consolidated Placement */}
      <div className="space-y-4">
        {showAddForm ? (
          <div className="bg-white border-2 border-teal-100 rounded-lg p-6 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-800">Create New System Setting</h2>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
               <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Setting Key</label>
                  <input 
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSetting()}
                    placeholder="e.g. news_rss_url_mumbai"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Initial Value</label>
                  <input 
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSetting()}
                    placeholder="Enter value..."
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                  />
               </div>
               <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                  <input 
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSetting()}
                    placeholder="What is this setting for?"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                  />
               </div>
            </div>

            <div className="bg-amber-100 border-l-8 border-amber-600 p-6 mb-8 rounded-r-xl shadow-md border-y border-r border-amber-200">
              <div className="flex items-start gap-5">
                <div className="bg-amber-600 p-2 rounded-full shadow-lg">
                  <AlertCircle className="h-8 w-8 text-white flex-shrink-0" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-black text-amber-900 uppercase tracking-[0.2em]">⚠️ CRITICAL: BEFORE YOU SAVE</p>
                  <p className="text-lg text-amber-900 leading-tight font-black">
                    To automate the news feed, your Key <span className="underline decoration-4 decoration-amber-600 underline-offset-4 italic">MUST</span> start with <span className="bg-white/80 px-2 py-0.5 rounded-md border border-amber-300 font-mono text-amber-900">news_rss_url_</span>.
                  </p>
                  <p className="text-base text-amber-800 font-bold leading-relaxed">
                    Scroll down to the <span className="text-amber-600 underline underline-offset-4">Detailed Guide</span> for exact 3-step help on creating the URL.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
               <button 
                 onClick={handleAddSetting}
                 disabled={isAdding || !newKey}
                 className="bg-teal-600 hover:bg-teal-700 text-white px-10 py-3 rounded-lg font-bold shadow-md transition-all disabled:opacity-50 transform active:scale-95"
               >
                 {isAdding ? 'Creating...' : 'Create Setting Now'}
               </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <button 
              onClick={() => setShowAddForm(true)}
              className="group items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg hover:shadow-teal-200 transition-all transform hover:-translate-y-0.5 flex"
            >
              <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
              Add New System Setting
            </button>
          </div>
        )}
      </div>

      {/* Settings Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Key</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Value / Description</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {settings.map((setting) => {
                const isEditing = editingKey === setting.setting_key;
                const hasChanges = editedValues[setting.setting_key] !== (setting.setting_value || '') || 
                                 editedDescriptions[setting.setting_key] !== (setting.description || '');

                return (
                  <tr key={setting.id} className={`hover:bg-gray-50 transition-colors ${isEditing ? 'bg-teal-50/30' : ''}`}>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-gray-800 font-mono">{setting.setting_key}</span>
                        {setting.is_encrypted && (
                          <span className="w-fit bg-purple-100 text-purple-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase border border-purple-200">
                            Encrypted
                          </span>
                        )}
                        {hasChanges && !isEditing && (
                          <span className="w-fit text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Unsaved
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="relative">
                            <input
                              type={setting.is_encrypted && !showValues[setting.setting_key] ? 'password' : 'text'}
                              value={editedValues[setting.setting_key] || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, [setting.setting_key]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && handleSave(setting.setting_key)}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                            />
                            {setting.is_encrypted && (
                              <button
                                onClick={() => toggleShowValue(setting.setting_key)}
                                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                              >
                                {showValues[setting.setting_key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={editedDescriptions[setting.setting_key] || ''}
                            onChange={(e) => setEditedDescriptions(prev => ({ ...prev, [setting.setting_key]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave(setting.setting_key)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 text-sm italic"
                            placeholder="Description..."
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-sm text-gray-700 font-mono break-all">
                            {setting.is_encrypted && !showValues[setting.setting_key] 
                              ? '••••••••••••••••' 
                              : (setting.setting_value || <span className="text-gray-400 italic">No value</span>)}
                            {setting.is_encrypted && (
                              <button onClick={() => toggleShowValue(setting.setting_key)} className="ml-2 text-gray-400 hover:text-gray-600">
                                {showValues[setting.setting_key] ? <EyeOff className="h-3 w-3 inline" /> : <Eye className="h-3 w-3 inline" />}
                              </button>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{setting.description || <span className="italic">No description</span>}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right align-top">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSave(setting.setting_key)}
                              disabled={saving === setting.setting_key}
                              className="p-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:opacity-50"
                              title="Save Changes"
                            >
                              {saving === setting.setting_key ? <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> : <Save className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => {
                                setEditingKey(null);
                                setEditedValues(prev => ({ ...prev, [setting.setting_key]: setting.setting_value || '' }));
                                setEditedDescriptions(prev => ({ ...prev, [setting.setting_key]: setting.description || '' }));
                              }}
                              className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                              title="Cancel"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingKey(setting.setting_key)}
                              className="text-[10px] font-bold uppercase tracking-wider text-teal-600 hover:text-teal-700 bg-teal-50 px-2.5 py-1 rounded border border-teal-100 transition-all"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteSetting(setting.setting_key)}
                              className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {settings.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No settings configured</p>
        </div>
      )}
    </div>
  );
}
