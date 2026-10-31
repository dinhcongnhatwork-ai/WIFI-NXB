import {it,expect,vi} from 'vitest';
vi.mock('@/lib/redis',()=>({redis:{get:async()=>{throw Error('No cache');}}}));
vi.mock('@/lib/network/connections',()=>({resolveConnection:async()=>({id:'controller',name:'Controller',baseUrl:'https://controller.test',config:{site:'office'}})}));
vi.mock('@/lib/settings',()=>({getUnifiClientFromRequest:async()=>({login:async()=>{},getTopology:async()=>({nodes:[{id:'gateway:aa',type:'gateway',name:'Gateway',mac:'aa:bb:cc:dd:ee:ff',ip:'192.168.1.1',meta:{inferredFromGatewayMac:true}}],links:[],warnings:[],observedAt:'2026-10-29T06:00:00Z'})})}));
vi.mock('@/lib/network/gateway-address',()=>({observedGatewayAddresses:async()=>new Map([['aa:bb:cc:dd:ee:ff',{ip:'192.168.0.1',connectionId:'router',observedAt:'2026-10-29T06:00:00Z',model:'CCR2004'}]])}));
import {getSampledTopology} from '@/lib/network/traffic-service';
it('uses the matched RouterOS LAN address instead of stale AP configuration in the served UniFi snapshot',async()=>{
 const graph=await getSampledTopology('UNIFI',new Request('https://app/api/unifi/topology?connectionId=controller&siteId=office'));
 expect(graph.nodes[0]).toMatchObject({ip:'192.168.0.1',status:'online',meta:{controllerGatewayIp:'192.168.1.1',gatewayConnectionId:'router',gatewayAddressSource:'RouterOS /ip/address · matched interface MAC',model:'CCR2004'}});
});
