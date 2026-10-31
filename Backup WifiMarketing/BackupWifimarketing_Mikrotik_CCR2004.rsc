# 2026-10-25 11:22:03 by RouterOS 7.24.5
# software id = 7RIL-5U17
#
# model = CCR2004-16G-2S+
# serial number = HMM0B2H5QEN
/interface bridge
add admin-mac=D0:EA:11:CC:55:E9 auto-mac=no comment=defconf name=bridge-wifi
/ip hotspot profile
set [ find default=yes ] dns-name=hotspot.wifi hotspot-address=10.10.1.2 \
    html-directory=hotspot_default login-by=cookie,http-chap,http-pap,trial
/ip hotspot user profile
set [ find default=yes ] idle-timeout=30m keepalive-timeout=5m shared-users=5
add idle-timeout=30m keepalive-timeout=5m name=uprof1 shared-users=5
/ip hotspot profile
add dns-name=hotspot.wifi hotspot-address=10.10.1.2 login-by=\
    cookie,http-chap,http-pap,trial name=hsprof1 trial-uptime-limit=4h \
    trial-user-profile=uprof1
/ip pool
add name=dhcp_pool0 ranges=10.10.1.10-10.10.1.240
add name=pool-lan ranges=10.10.1.100-10.10.1.250
/ip dhcp-server
add address-pool=dhcp_pool0 interface=bridge-wifi name=dhcp1
/interface bridge port
add bridge=bridge-wifi comment=defconf interface=ether15
add bridge=bridge-wifi interface=ether2
add bridge=bridge-wifi interface=ether4
add bridge=bridge-wifi interface=ether5
add bridge=bridge-wifi interface=ether6
add bridge=bridge-wifi interface=ether3
add bridge=bridge-wifi interface=ether7
add bridge=bridge-wifi interface=ether8
add bridge=bridge-wifi interface=ether9
add bridge=bridge-wifi interface=ether10
add bridge=bridge-wifi interface=ether11
add bridge=bridge-wifi interface=ether12
add bridge=bridge-wifi interface=ether13
add bridge=bridge-wifi interface=ether14
add bridge=bridge-wifi interface=ether16
/ip address
add address=192.168.1.200/24 comment=defconf interface=ether1 network=\
    192.168.1.0
add address=10.10.1.2/24 interface=bridge-wifi network=10.10.1.0
/ip dhcp-server lease
add address=10.10.1.1 client-id=1:74:fa:29:5f:71:93 mac-address=\
    74:FA:29:5F:71:93 server=dhcp1
add address=10.10.1.253 client-id=1:d0:ea:11:d8:52:2c mac-address=\
    D0:EA:11:D8:52:2C server=dhcp1
/ip dhcp-server network
add address=10.10.1.0/24 dns-server=10.10.1.2,8.8.8.8 gateway=10.10.1.2
/ip dns
set allow-remote-requests=yes servers=8.8.8.8,1.1.1.1
/ip dns static
add address=10.10.1.2 comment="Hotspot DNS" name=hotspot.wifi type=A
/ip firewall filter
add action=passthrough chain=unused-hs-chain comment=\
    "place hotspot rules here" disabled=yes
/ip firewall nat
add action=passthrough chain=unused-hs-chain comment=\
    "place hotspot rules here" disabled=yes
add action=masquerade chain=srcnat comment="NAT LAN 10.10.1.0/24 to Internet" \
    out-interface=ether1 src-address=10.10.1.0/24
add action=masquerade chain=srcnat out-interface=ether1
/ip hotspot
add disabled=no interface=bridge-wifi name=server1 profile=hsprof1
/ip hotspot ip-binding
add address=10.10.1.253 comment=CRS328-Switch mac-address=D0:EA:11:D8:52:2C \
    type=bypassed
add address=10.10.1.1 comment=WIFI-AP mac-address=74:FA:29:5F:71:93 type=\
    bypassed
/ip hotspot user
add comment="Admin default user" name=admin profile=uprof1
/ip hotspot walled-garden
add comment="place hotspot rules here" disabled=yes
add comment=portal-domain dst-host=solutionai.com.vn
add comment=portal-domain dst-host=www.solutionai.com.vn
add comment=portal-domain dst-host=*.solutionai.com.vn
add comment=stbook-media dst-host=stbook.vn
add comment=stbook-media dst-host=*.stbook.vn
add comment=nxbctqg-media dst-host=nxbctqg.org.vn
add comment=nxbctqg-media dst-host=*.nxbctqg.org.vn
add comment=google-fonts dst-host=fonts.googleapis.com
add comment=google-fonts dst-host=fonts.gstatic.com
add comment=cdnjs dst-host=cdnjs.cloudflare.com
/ip hotspot walled-garden ip
add action=accept comment=portal-server-local disabled=no dst-address=\
    192.168.1.253
add action=accept comment=allow-lan-192.168.1.0/24 disabled=no dst-address=\
    192.168.1.0/24
add action=accept comment=local-gateway disabled=no dst-address=10.10.1.2
add action=accept comment=cf-solutionai-1 disabled=no dst-address=\
    104.21.51.90
add action=accept comment=cf-solutionai-2 disabled=no dst-address=\
    172.67.177.252
add action=accept comment=cf-subnet-104 disabled=no dst-address=104.16.0.0/12
add action=accept comment=cf-subnet-172 disabled=no dst-address=172.64.0.0/13
/ip route
add dst-address=0.0.0.0/0 gateway=192.168.1.1
/ip service
set ssh available-from=192.168.1.0/24,10.10.1.0/24
/ip ssh
set password-authentication=yes
/system clock
set time-zone-name=Asia/Bangkok
/system routerboard settings
set enter-setup-on=delete-key
/tool sniffer
set filter-ip-address=10.10.1.224/32
