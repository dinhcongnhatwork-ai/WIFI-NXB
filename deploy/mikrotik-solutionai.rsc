# Allow the external portal before Hotspot login. Safe to import repeatedly.
# Upload ../login.html to the active Hotspot HTML directory separately.
# Domain DNS must resolve to Cloudflare; no LAN DNS override is needed for Tunnel.
:if ([:len [/ip hotspot walled-garden find where comment="solutionai-portal-http"]] = 0) do={
    /ip hotspot walled-garden add action=allow dst-host="solutionai.com.vn" disabled=no comment="solutionai-portal-http"
} else={
    /ip hotspot walled-garden set [find where comment="solutionai-portal-http"] action=allow dst-host="solutionai.com.vn" disabled=no
}
:if ([:len [/ip hotspot walled-garden ip find where comment="solutionai-portal-https"]] = 0) do={
    /ip hotspot walled-garden ip add action=accept protocol=tcp dst-host="solutionai.com.vn" dst-port=443 disabled=no comment="solutionai-portal-https"
} else={
    /ip hotspot walled-garden ip set [find where comment="solutionai-portal-https"] action=accept protocol=tcp dst-host="solutionai.com.vn" dst-port=443 disabled=no
}
