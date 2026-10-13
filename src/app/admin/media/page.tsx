'use client';
import { useState } from 'react';
import { MediaLibrary, MediaUploadField } from '@/components/media';
export default function MediaPage() {
  const [latest,setLatest] = useState(''); const [refresh,setRefresh] = useState(0);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-slate-900">Media library</h1><p className="mt-1 text-sm text-slate-500">Upload and reuse images and videos. Media used by drafts or published revisions is protected from deletion.</p></div><MediaUploadField label="Upload media · maximum 50MB" value={latest} onChange={url=>{setLatest(url);setRefresh(value=>value+1);}} /><MediaLibrary refresh={refresh} allowDelete /></div>;
}
