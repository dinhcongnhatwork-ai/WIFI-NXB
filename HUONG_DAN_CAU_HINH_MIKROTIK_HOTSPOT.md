# Hướng Dẫn Cấu Hình MikroTik Hotspot - Captive Portal WiFi Marketing

> **Cập nhật 24/10/2026:** Domain hiện tại là `https://solutionai.com.vn`, qua Cloudflare Tunnel do người vận hành quản lý. Dùng [hướng dẫn domain mới](docs/solutionai-domain-deployment.md), file `login.html` và `deploy/mikrotik-solutionai.rsc`. Các địa chỉ `wifi.jtsc.vn`, proxy và IP bên dưới là cấu hình lịch sử; không áp dụng DNS static cũ cho domain mới.


> **Cập nhật:** 16/04/2026  
> **Hệ thống:** WiFi Marketing Platform + MikroTik RouterOS

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Sơ đồ mạng](#2-sơ-đồ-mạng)
3. [Thông tin đăng nhập](#3-thông-tin-đăng-nhập)
4. [Luồng hoạt động Captive Portal](#4-luồng-hoạt-động-captive-portal)
5. [Cấu hình MikroTik](#5-cấu-hình-mikrotik)
6. [Cấu hình Server Portal](#6-cấu-hình-server-portal)
7. [File HTML trên MikroTik](#7-file-html-trên-mikrotik)
8. [Xử lý sự cố](#8-xử-lý-sự-cố)
9. [Lệnh kiểm tra nhanh](#9-lệnh-kiểm-tra-nhanh)

---

## 1. Tổng quan hệ thống

Hệ thống gồm 3 thành phần chính:

| Thành phần | Vai trò | IP / URL |
|---|---|---|
| **MikroTik Router** | Hotspot gateway, chặn & redirect client | `192.168.1.200` |
| **Portal Server** | Next.js app hiển thị trang captive portal | `192.168.1.56:3000` |
| **Domain** | Tên miền portal | `wifi.jtsc.vn` |

**Nguyên lý:** Khi thiết bị kết nối WiFi, MikroTik chặn truy cập internet, hiển thị popup captive portal. Người dùng click "Kết nối ngay" → được cấp quyền truy cập internet.

---

## 2. Sơ đồ mạng

```
Internet
    │
    ▼
┌──────────────────────┐
│    MikroTik Router   │
│    192.168.1.200       │
│                      │
│  ether1 ─── WAN      │  ← Kết nối Internet (192.168.1.0/24)
│  ether2 ─── Hotspot  │  ← Mạng WiFi Guest (10.10.20.0/22)
└──────────────────────┘
    │ ether1                    │ ether2
    │                           │
    ▼                           ▼
┌──────────────┐        ┌──────────────────┐
│ Portal Server│        │  Access Point    │
│ 192.168.1.56 │        │  (WiFi Guest)    │
│ Port 3000    │        │  10.10.20.254    │
│ (Next.js)    │        │                  │
└──────────────┘        └──────────────────┘
                                │
                                ▼
                        ┌──────────────┐
                        │  WiFi Client │
                        │  10.10.20.x  │
                        └──────────────┘
```

**Dải mạng:**
- **WAN (ether1):** `192.168.1.0/24` — Mạng nội bộ chính, kết nối internet
- **Hotspot (ether2):** `10.10.20.0/22` (10.10.20.1 - 10.10.23.254) — Mạng WiFi Guest
- **DHCP Pool:** `10.10.20.2 - 10.10.23.254` (1021 địa chỉ)
- **Gateway hotspot:** `10.10.20.1`

---

## 3. Thông tin đăng nhập

### MikroTik Router
```
Host:     192.168.1.200
Username: admin
Password: 123456
SSH Port: 22
```

### SSH vào MikroTik
```bash
sshpass -p '123456' ssh -o StrictHostKeyChecking=no admin@192.168.1.200
```

### MikroTik REST API
```bash
# HTTP (khuyến nghị cho mạng nội bộ)
curl -u admin:123456 http://192.168.1.200/rest/system/identity

# HTTPS (nếu có cert)
curl -sk -u admin:123456 https://192.168.1.200/rest/system/identity
```

---

## 4. Luồng hoạt động Captive Portal

```
1. Client kết nối WiFi
   └─→ DHCP cấp IP 10.10.20.x, DNS = 10.10.20.1

2. Client truy cập bất kỳ website nào (HTTP)
   └─→ MikroTik chặn, redirect tới http://hotspot.wifi/login

3. MikroTik serve file login.html
   └─→ login.html chứa meta-refresh redirect tới portal

4. Browser redirect tới http://wifi.jtsc.vn/portal?mac=...&trial=...
   └─→ DNS: wifi.jtsc.vn → 192.168.1.56 (static DNS trên MikroTik)
   └─→ Port 80 → redirect tới port 3000 (iptables trên server)

5. Next.js Portal hiển thị trang marketing
   └─→ Hiện video, hình ảnh quảng cáo, nút "Kết nối ngay"

6. User click "Kết nối ngay"
   └─→ POST /api/login (gửi mac, ip, trial URL)
   └─→ API trả về trial URL cho client-side redirect

7. Browser redirect tới MikroTik trial login URL
   └─→ MikroTik xác thực client, cấp internet
   └─→ Redirect về wifi.jtsc.vn/portal (hoặc URL campaign)
```

---

## 5. Cấu hình MikroTik

### 5.1. Hotspot Profile

```routeros
/ip hotspot profile set hsprof1 \
    dns-name="hotspot.wifi" \
    login-by=cookie,http-chap,trial \
    http-cookie-lifetime=1d \
    trial-uptime-limit=30m \
    trial-uptime-reset=1d \
    trial-user-profile=default \
    html-directory=hotspot
```

**Giải thích:**
- `dns-name`: Domain mà MikroTik dùng để redirect client (khác với domain portal)
- `login-by`: Cho phép đăng nhập bằng cookie (tự động), HTTP-CHAP, và trial (dùng thử)
- `trial-uptime-limit`: Thời gian dùng thử tối đa (30 phút)
- `trial-uptime-reset`: Reset thời gian dùng thử sau 1 ngày
- `http-cookie-lifetime`: Cookie lưu 1 ngày (không hỏi lại trong ngày)

### 5.2. Hotspot Server

```routeros
/ip hotspot set server1 \
    interface=ether2 \
    address-pool=dhcp_pool0 \
    profile=hsprof1 \
    idle-timeout=5m \
    addresses-per-mac=2
```

> **Lưu ý:** Nếu chưa có hotspot server, tạo mới bằng:
> ```routeros
> /ip hotspot setup
> # Chọn interface: ether2
> # Chọn address pool: dhcp_pool0
> ```

### 5.3. DHCP Server

```routeros
/ip pool add name=dhcp_pool0 ranges=10.10.20.2-10.10.23.254

/ip dhcp-server add name=dhcp1 interface=ether2 \
    address-pool=dhcp_pool0 lease-time=30m

/ip dhcp-server network add address=10.10.20.0/22 \
    gateway=10.10.20.1 dns-server=10.10.20.1
```

### 5.4. IP Address

```routeros
/ip address add address=10.10.20.1/22 interface=ether2
```

### 5.5. DNS Configuration

```routeros
# Bật DNS server cho client
/ip dns set allow-remote-requests=yes servers=8.8.8.8,8.8.4.4

# Static DNS: wifi.jtsc.vn trỏ về Proxy OpenResty (xử lý HTTPS)
/ip dns static add name=wifi.jtsc.vn address=192.168.1.92 ttl=5m \
    comment="portal-server"
```

> **QUAN TRỌNG:** MikroTik tự tạo dynamic DNS entry cho `hotspot.wifi → 10.10.20.1`.  
> Static entry `wifi.jtsc.vn → 192.168.1.92` cho phép client truy cập portal qua domain.

### 5.6. NAT (Masquerade)

```routeros
# Cho phép client truy cập internet qua ether1
/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade
```

### 5.7. Walled Garden (Domain-based)

Cho phép truy cập các domain **trước khi xác thực** (để portal hiển thị đầy đủ):

```routeros
# Domain portal
/ip hotspot walled-garden add dst-host=wifi.jtsc.vn action=allow \
    comment="portal-domain"
/ip hotspot walled-garden add dst-host=www.wifi.jtsc.vn action=allow \
    comment="portal-domain"

# MinIO (lưu trữ media)
/ip hotspot walled-garden add dst-host=jtscminio.duckdns.org action=allow \
    comment="minio-media"
/ip hotspot walled-garden add dst-host="*.jtscminio.duckdns.org" action=allow \
    comment="minio-media"

# Các domain media khác (tùy template)
/ip hotspot walled-garden add dst-host=stbook.vn action=allow \
    comment="stbook-media"
/ip hotspot walled-garden add dst-host="*.stbook.vn" action=allow \
    comment="stbook-media"
/ip hotspot walled-garden add dst-host=demo.jtsc.vn action=allow \
    comment="demo-media"
/ip hotspot walled-garden add dst-host="*.nxbctqg.org.vn" action=allow \
    comment="nxbctqg-media"
```

### 5.8. Walled Garden (IP-based)

Cho phép truy cập IP cụ thể **trước khi xác thực**:

```routeros
# Portal Server (mạng nội bộ)
/ip hotspot walled-garden ip add dst-address=192.168.1.56 action=accept \
    comment="portal-server"

# Proxy OpenResty (Xử lý HTTPS cho Portal)
/ip hotspot walled-garden ip add dst-address=192.168.1.92 action=accept \
    comment="portal-proxy"

# Public IP (nếu portal/media qua public IP)
/ip hotspot walled-garden ip add dst-address=117.5.215.6 action=accept \
    comment="public-ip-minio-resources"
```

> **Lưu ý:** Public IP có thể thay đổi. Cập nhật khi IP thay đổi hoặc dùng domain-based walled-garden thay thế.

---

## 6. Cấu hình Server Portal

### 6.1. Server (192.168.1.56)

**Redirect port 80 → 3000 (iptables):**

```bash
# Thêm rule redirect
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000

# Kiểm tra
sudo iptables -t nat -L PREROUTING -n --line-numbers
```

**Persist qua reboot (systemd service):**

```bash
sudo tee /etc/systemd/system/portal-redirect.service << 'EOF'
[Unit]
Description=Redirect port 80 to 3000 for WiFi Portal
After=network.target docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/sbin/iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
ExecStop=/sbin/iptables -t nat -D PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable portal-redirect.service
```

### 6.2. Docker Compose

Frontend và Backend chạy với `network_mode: host`:
- **Frontend:** port 3000 (Next.js)
- **Backend:** port 3001 (API server)

```bash
# Khởi động
cd /home/jtsc/wifimarketing
docker compose up -d

# Rebuild khi thay đổi code
docker compose build frontend --no-cache
docker compose up -d frontend
```

### 6.3. Environment Variables (.env)

```env
# MikroTik
MIKROTIK_HOST=192.168.1.200
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=123456
MIKROTIK_TIMEOUT_MS=12000
MIKROTIK_ALLOW_INSECURE=true
MIKROTIK_IP=192.168.1.200

# Portal URL
NEXT_PUBLIC_APP_URL=https://wifi.jtsc.vn
NEXT_PUBLIC_API_URL=https://wifi.jtsc.vn
```

---

## 7. File HTML trên MikroTik

### 7.1. login.html

File chính được MikroTik serve khi client chưa xác thực. Redirect tới portal.

**Đường dẫn:** `/hotspot/login.html`

```html
<html>
<head>
<meta http-equiv="refresh" content="0;url=http://wifi.jtsc.vn/portal?mac=$(mac-esc)&ip=$(ip)&link-login=$(link-login-esc)&link-orig=$(link-orig-esc)&trial=$(trial)&ssid=$(ssid)" />
</head>
<body></body>
</html>
```

**Biến MikroTik:**
| Biến | Mô tả |
|---|---|
| `$(mac-esc)` | MAC address của client (URL-encoded) |
| `$(ip)` | IP address của client |
| `$(link-login-esc)` | URL đăng nhập MikroTik (URL-encoded) |
| `$(link-orig-esc)` | URL ban đầu client muốn truy cập (URL-encoded) |
| `$(trial)` | URL trial login (cho phép dùng thử) |
| `$(ssid)` | Tên mạng WiFi (nếu có) |

### 7.2. alogin.html

File được serve **sau khi** client đã xác thực. Redirect về trang đích.

**Đường dẫn:** `/hotspot/alogin.html`

```html
<html>
<head>
<meta http-equiv="refresh" content="0;url=$(link-redirect)" />
</head>
<body><p>Connected! Redirecting...</p></body>
</html>
```

### 7.3. Upload file lên MikroTik

```bash
# Upload qua SCP
sshpass -p '123456' scp -O -o StrictHostKeyChecking=no \
    login.html admin@192.168.1.200:hotspot/login.html

sshpass -p '123456' scp -O -o StrictHostKeyChecking=no \
    alogin.html admin@192.168.1.200:hotspot/alogin.html

# Kiểm tra file đã upload
sshpass -p '123456' ssh admin@192.168.1.200 \
    '/file print where name~"hotspot"'

# Xem nội dung file
sshpass -p '123456' ssh admin@192.168.1.200 \
    ':put [/file get hotspot/login.html contents]'
```

---

## 8. Xử lý sự cố

### 8.1. Client không thấy popup captive portal

**Kiểm tra:**
```routeros
# Hotspot đang chạy?
/ip hotspot print

# Client có nhận DHCP?
/ip dhcp-server lease print where server=dhcp1

# Client có trong hotspot host list?
/ip hotspot host print
```

**Nguyên nhân phổ biến:**
- Client dùng DNS khác (không phải MikroTik) → Đảm bảo DHCP cấp DNS = 10.10.20.1
- Client đã có cookie xác thực → Xóa cookie hoặc đợi hết hạn
- Client bị bypass (ip-binding) → Kiểm tra `/ip hotspot ip-binding print`

### 8.2. Portal hiển thị nhưng không tải hình/video

**Kiểm tra walled-garden:**
```routeros
/ip hotspot walled-garden print
/ip hotspot walled-garden ip print
```

**Thêm domain mới:**
```routeros
/ip hotspot walled-garden add dst-host="newdomain.com" action=allow \
    comment="description"
```

### 8.3. Click "Kết nối" nhưng không được cấp internet

**Kiểm tra:**
```bash
# Test API login
curl -s -X POST http://192.168.1.56:3000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"mac":"AA:BB:CC:DD:EE:FF","ip":"10.10.20.100","trial":"http://10.10.20.1/login?dst=test"}' \
  | python3 -m json.tool
```

**Nguyên nhân:**
- Trial URL không được truyền từ MikroTik → Kiểm tra login.html có `$(trial)`
- Portal server không thể kết nối MikroTik REST API → Kiểm tra kết nối

### 8.4. DNS wifi.jtsc.vn không resolve đúng

```routeros
# Kiểm tra DNS static
/ip dns static print

# Nếu thiếu, thêm lại
/ip dns static add name=wifi.jtsc.vn address=192.168.1.92 ttl=5m \
    comment="portal-server"

# Flush DNS cache
/ip dns cache flush
```

### 8.5. Port 80 không hoạt động trên server

```bash
# Kiểm tra iptables rule
sudo iptables -t nat -L PREROUTING -n | grep "dpt:80"

# Nếu thiếu, thêm lại
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000

# Kiểm tra service
sudo systemctl status portal-redirect.service
```

---

## 9. Lệnh kiểm tra nhanh

### Từ Terminal Server (192.168.1.56)

```bash
# ===== Kiểm tra MikroTik =====
# SSH nhanh vào MikroTik
alias mt='sshpass -p 123456 ssh -o StrictHostKeyChecking=no admin@192.168.1.200'

# Trạng thái hotspot
mt '/ip hotspot print'
mt '/ip hotspot profile print'
mt '/ip hotspot host print'
mt '/ip hotspot active print'

# DNS
mt '/ip dns static print'
mt ':put [:resolve wifi.jtsc.vn]'

# Walled garden
mt '/ip hotspot walled-garden print'
mt '/ip hotspot walled-garden ip print'

# DHCP leases
mt '/ip dhcp-server lease print where server=dhcp1'

# Hotspot files
mt '/file print where name~"hotspot"'
mt ':put [/file get hotspot/login.html contents]'

# ===== Kiểm tra Portal Server =====
# Portal page
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://192.168.1.56:80/portal

# Portal API
curl -s http://192.168.1.56/api/portal | python3 -m json.tool | head -20

# Login API
curl -s -X POST http://192.168.1.56/api/login \
  -H 'Content-Type: application/json' \
  -d '{"mac":"test","ip":"test","trial":"http://10.10.20.1/test"}' \
  | python3 -m json.tool

# iptables
sudo iptables -t nat -L PREROUTING -n --line-numbers
```

### Từ MikroTik CLI

```routeros
# Tổng quan nhanh
/ip hotspot print
/ip hotspot active print count-only
/ip hotspot host print count-only
/ip dhcp-server lease print count-only

# Reset client cụ thể (buộc re-auth)
/ip hotspot active remove [find where mac-address="AA:BB:CC:DD:EE:FF"]

# Reset tất cả client
/ip hotspot active remove [find]

# Xóa cookie tất cả
/ip hotspot cookie remove [find]
```

---

## Phụ lục: Cấu hình đầy đủ (Export)

Để export toàn bộ cấu hình MikroTik hiện tại:

```routeros
/export compact
```

Để export chỉ phần hotspot:

```routeros
/ip hotspot export compact
/ip hotspot profile export compact
/ip hotspot walled-garden export compact
/ip hotspot walled-garden ip export compact
/ip dns static export compact
```

---

## Tóm tắt cấu hình hiện tại

| Mục | Giá trị |
|---|---|
| MikroTik IP | 192.168.1.200 |
| Hotspot Interface | ether2 |
| Hotspot Network | 10.10.20.0/22 |
| Hotspot Gateway | 10.10.20.1 |
| Hotspot DNS Name | hotspot.wifi |
| Hotspot Profile | hsprof1 |
| Login Method | cookie + http-chap + trial |
| Trial Limit | 30 phút / reset 1 ngày |
| Cookie Lifetime | 1 ngày |
| Portal Server | 192.168.1.56 |
| Portal Port | 3000 (redirect từ 80) |
| Portal Domain | wifi.jtsc.vn |
| Portal URL | http://wifi.jtsc.vn/portal |
| DNS wifi.jtsc.vn | → 192.168.1.92 (static) |
| DNS hotspot.wifi | → 10.10.20.1 (dynamic) |
