# 2026-09-08 10:26:38 by RouterOS 7.21
# software id = JAUG-HGCP
#
/interface ethernet
set [ find default-name=ether1 ] disable-running-check=no
set [ find default-name=ether2 ] disable-running-check=no
/interface list
add name=WAN
add name=LAN
/ip hotspot profile
set [ find default=yes ] dns-name=hotspot.wifi hotspot-address=10.10.20.1 \
    login-by=cookie,http-chap,http-pap,trial
/ip pool
add name=dhcp ranges=10.10.20.2-10.10.20.254
add name=dhcp_pool1 ranges=10.10.20.2-10.10.23.254
add name=dhcp_pool2 ranges=10.10.20.2-10.10.20.254
/ip dhcp-server
add address-pool=dhcp_pool1 interface=ether2 name=dhcp1
/ip hotspot user profile
set [ find default=yes ] address-pool=dhcp
add address-pool=dhcp idle-timeout=30m keepalive-timeout=5m name=uprof1 \
    shared-users=3
/ip hotspot profile
add dns-name=hotspot.wifi hotspot-address=10.10.20.1 login-by=\
    cookie,http-chap,trial name=hsprof1 trial-uptime-limit=4h \
    trial-user-profile=uprof1
/ip hotspot
add address-pool=dhcp_pool1 disabled=no interface=ether2 name=server1 \
    profile=hsprof1
/interface list member
add interface=ether1 list=WAN
add interface=ether2 list=LAN
/ip address
add address=192.168.1.200/24 interface=ether1 network=192.168.1.0
add address=10.10.20.1/22 interface=ether2 network=10.10.20.0
/ip dhcp-client
add disabled=yes interface=ether1
/ip dhcp-server network
add address=10.10.20.0/22 dns-server=8.8.8.8,8.8.4.4 gateway=10.10.20.1
/ip dns
set allow-remote-requests=yes servers=8.8.8.8,8.8.4.4
/ip firewall filter
add action=passthrough chain=unused-hs-chain comment=\
    "place hotspot rules here" disabled=yes
/ip firewall nat
add action=passthrough chain=unused-hs-chain comment=\
    "place hotspot rules here" disabled=yes
add action=masquerade chain=srcnat out-interface=ether1 src-address=\
    192.168.1.0/24
add action=masquerade chain=srcnat comment="masquerade hotspot network" \
    out-interface=ether1 src-address=10.10.20.0/22
add action=dst-nat chain=dstnat comment=Unifi-OS-WebUI-11443 dst-address=\
    192.168.1.200 dst-port=11443 protocol=tcp to-addresses=10.10.23.70 \
    to-ports=11443
add action=dst-nat chain=dstnat comment=Unifi-OS-WebUI-8443 dst-address=\
    192.168.1.200 dst-port=8443 protocol=tcp to-addresses=10.10.23.70 \
    to-ports=11443
add action=dst-nat chain=dstnat comment=Unifi-OS-Inform-8080 dst-address=\
    192.168.1.200 dst-port=8080 protocol=tcp to-addresses=10.10.23.70 \
    to-ports=8080
add action=dst-nat chain=dstnat comment=\
    "Redirect old controller IP 10.10.1.70 to 10.10.23.70" dst-address=\
    10.10.1.70 to-addresses=10.10.23.70
add action=masquerade chain=srcnat comment="hairpin nat for controller" \
    dst-address=10.10.23.70 out-interface=ether2 src-address=10.10.20.0/22
/ip hotspot ip-binding
add address=10.10.23.70 comment=Unifi-OS-VM mac-address=BC:24:11:39:EB:78 \
    type=bypassed
add address=10.10.23.254 comment=UniFi-AP mac-address=70:A7:41:E8:A2:33 type=\
    bypassed
/ip hotspot user
add name=admin
/ip hotspot walled-garden
add comment="place hotspot rules here" disabled=yes
add comment=portal-domain dst-host=wifi.jtsc.vn
add comment=portal-domain dst-host=www.wifi.jtsc.vn
add comment=minio-media dst-host=jtscminio.duckdns.org
add comment=stbook-media dst-host=*.stbook.vn
add comment=stbook-media dst-host=stbook.vn
add comment=minio-media dst-host=*.jtscminio.duckdns.org
add comment=nxbctqg-media dst-host=*.nxbctqg.org.vn
add comment=demo-media dst-host=demo.jtsc.vn
/ip hotspot walled-garden ip
add action=accept comment=portal-server disabled=no dst-address=192.168.1.56
add action=accept comment=public-ip-minio disabled=no dst-address=117.5.215.6
add action=accept comment=portal-proxy disabled=no dst-address=192.168.1.92
add action=accept comment=local-gateway disabled=no dst-address=10.10.20.1
add action=accept comment=allow-lan-192.168.1.0/24 disabled=no dst-address=\
    192.168.1.0/24
add action=accept comment=cf-wifi-jtsc-vn disabled=no dst-address=\
    104.21.17.181
add action=accept comment=cf-wifi-jtsc-vn disabled=no dst-address=\
    172.67.177.193
/ip route
add disabled=no dst-address=0.0.0.0/0 gateway=192.168.1.1
/tool sniffer
set file-name=sniff.pcap filter-ip-address=10.10.20.10/32
