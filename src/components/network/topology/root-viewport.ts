import {networkNodeSize} from "./node-dimensions";
type RootNode = {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
  data: { device?: { type?: string; meta?: Record<string, any> } };
};
/** Keep the actual gateway under the fixed sign, even when minimum zoom clips a large tree. */
export function rootViewport<T extends { x: number; y: number; zoom: number }>(
  nodes: RootNode[], viewport: T, width: number,
): T {
  if (!nodes.length || width <= 0) return viewport;
  const physical = nodes.filter(n => !n.data.device?.meta?.layoutOnly);
  const gateways = physical.filter(n => n.data.device?.type === 'gateway');
  const candidates = gateways.length ? gateways : physical.length ? physical : nodes;
  const root = [...candidates].sort((a,b) =>
    Number(!!b.data.device?.meta?.inferredFromGatewayMac) - Number(!!a.data.device?.meta?.inferredFromGatewayMac) || a.position.y - b.position.y || a.id.localeCompare(b.id)
  )[0];
  return {
    ...viewport,
    x: width / 2 - (root.position.x + (root.measured?.width || networkNodeSize(root.data.device).width) / 2) * viewport.zoom,
    y: 20 - root.position.y * viewport.zoom,
  };
}

/** Fit all descendants while retaining the gateway under the centered sign. */
export function fitRootViewport<T extends {x:number;y:number;zoom:number}>(nodes:RootNode[], viewport:T, width:number, height:number):T {
  if (!nodes.length || width<=0 || height<=0) return viewport;
  const anchor=rootViewport(nodes,{...viewport,x:0,y:0,zoom:1},width);
  const center=width/2-anchor.x, top=20-anchor.y;
  const left=Math.min(...nodes.map(n=>n.position.x));
  const right=Math.max(...nodes.map(n=>n.position.x+(n.measured?.width||networkNodeSize(n.data.device).width)));
  const bottom=Math.max(...nodes.map(n=>n.position.y+(n.measured?.height||networkNodeSize(n.data.device).height)));
  const zoom=Math.max(0.08,Math.min(1,(width-64)/(2*Math.max(center-left,right-center,130)),(height-48)/Math.max(bottom-top,148)));
  return rootViewport(nodes,{...viewport,zoom},width);
}
