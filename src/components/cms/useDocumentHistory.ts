'use client';
import { useCallback, useRef, useState } from 'react';
import { clone, type TemplateDocumentV2 } from '@/lib/template-document';
export function useDocumentHistory(initial: TemplateDocumentV2) {
  const [document, setDocument] = useState(initial);
  const current = useRef(initial); const past = useRef<TemplateDocumentV2[]>([]); const future = useRef<TemplateDocumentV2[]>([]);
  const commit = useCallback((change: TemplateDocumentV2 | ((draft:TemplateDocumentV2)=>void)) => {
    const next = typeof change === 'function' ? clone(current.current) : change;
    if (typeof change === 'function') change(next);
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    past.current = [...past.current.slice(-99), current.current]; future.current=[]; current.current=next; setDocument(next);
  }, []);
  const undo = useCallback(() => { const previous = past.current.pop(); if (previous) { future.current.push(current.current); current.current=previous; setDocument(previous); } }, []);
  const redo = useCallback(() => { const next = future.current.pop(); if(next) { past.current.push(current.current); current.current=next; setDocument(next); } }, []);
  return { document, current, commit, undo, redo, canUndo:past.current.length>0,canRedo:future.current.length>0 };
}
