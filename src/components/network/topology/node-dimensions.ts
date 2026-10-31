/** Shared card geometry: layout, handles and camera use the same dimensions. */
export const INFRA_NODE_SIZE = { width: 260, height: 148 } as const;
export const CLIENT_NODE_SIZE = { width: 176, height: 132 } as const;
export function networkNodeSize(device?: { type?: string }) {
  return device?.type === 'client' ? CLIENT_NODE_SIZE : INFRA_NODE_SIZE;
}

import {Position, type NodeHandle} from '@xyflow/react';
/** Fixed monitor cards must retain endpoints when React Flow adopts fresh data objects. */
export function networkNodeHandles(device:{type?:string},source:Position,target:Position):NodeHandle[] {
  const size=networkNodeSize(device);
  const make=(type:'source'|'target',position:Position):NodeHandle=>({
    type,position,width:8,height:8,
    x:position===Position.Left?-4:position===Position.Right?size.width-4:size.width/2-4,
    y:position===Position.Top?-4:position===Position.Bottom?size.height-4:size.height/2-4,
  });
  return [make('source',source),make('target',target)];
}
