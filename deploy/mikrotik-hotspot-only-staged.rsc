# CCR2004 current LAN: 192.168.0.0/22, bridge, gateway 192.168.0.1.
# HOTSPOT ONLY. Does not configure DHCP, pools, IPs, DNS, interfaces, PPPoE or firewall.
# The server MUST remain disabled until SSID classification and FastTrack are resolved.
# A broad bypass preserves direct access but does not enforce marketing authentication.
:if ([:len [/ip hotspot find where name="wmk-marketing"]] > 0) do={ :error "wmk-marketing already exists; inspect it before changing anything" }
:if ([:len [/ip hotspot profile find where name="wmk-hsprof"]] > 0) do={ :error "wmk-hsprof already exists; inspect it before changing anything" }
:if ([:len [/ip hotspot user profile find where name="wmk-trial"]] > 0) do={ :error "wmk-trial already exists; inspect it before changing anything" }
/ip hotspot user profile add name=wmk-trial address-pool=none idle-timeout=30m keepalive-timeout=5m shared-users=5
/ip hotspot profile add name=wmk-hsprof hotspot-address=192.168.0.1 dns-name="" html-directory=hotspot login-by=cookie,http-chap,http-pap,trial trial-uptime-limit=4h trial-user-profile=wmk-trial
/ip hotspot add name=wmk-marketing interface=bridge address-pool=none profile=wmk-hsprof disabled=yes
/ip hotspot ip-binding add server=wmk-marketing address=0.0.0.0/0 type=bypassed comment="WMK: default direct access - not campaign enforcement"
/ip hotspot walled-garden add server=wmk-marketing action=allow dst-host=solutionai.com.vn comment="WMK: portal HTTP"
/ip hotspot walled-garden ip add server=wmk-marketing action=accept protocol=tcp dst-host=solutionai.com.vn dst-port=443 comment="WMK: portal HTTPS"
