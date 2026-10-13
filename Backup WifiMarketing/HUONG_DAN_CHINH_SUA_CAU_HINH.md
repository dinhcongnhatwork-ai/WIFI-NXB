# HƯỚNG DẪN CHỈNH SỬA CẤU HÌNH HỆ THỐNG WIFI MARKETING

Tài liệu này tổng hợp toàn bộ các tình huống cần thay đổi cấu hình sau này, giải thích rõ **cần sửa ở file nào, sửa trên thiết bị nào và dùng lệnh gì**.

---

## 📌 BẢNG TRA CỨU NHANH CÁC THÀNH PHẦN

| Nhu cầu thay đổi | Vị trí cần sửa đổi | File hoặc Menu liên quan |
| :--- | :--- | :--- |
| **Đổi Domain trang chào (Portal)** | 1. MikroTik Walled Garden<br>2. MikroTik `login.html`<br>3. Server `.env` | `BackupWifimarketing_LoginHTML`<br>`.env`<br>WinBox: `IP > Hotspot > Walled Garden` |
| **Thêm Web/App cho truy cập trước đăng nhập** | MikroTik Walled Garden | WinBox: `IP > Hotspot > Walled Garden` |
| **Miễn đăng nhập cho thiết bị (Bypass AP, máy sếp, camera)** | MikroTik IP Bindings | WinBox: `IP > Hotspot > IP Bindings` |
| **Đổi thời gian ngắt kết nối / thời hạn phiên** | MikroTik Hotspot Profile | WinBox: `IP > Hotspot > Server Profiles` |
| **Đổi IP WAN hoặc mật khẩu Router MikroTik** | 1. MikroTik RouterOS<br>2. Server Portal `.env` | `.env`<br>Terminal RouterOS: `/user set admin ...` |
| **Đổi thông tin UniFi Controller** | Server Portal `.env` | `/home/jtsc/wifimarketing/.env` |
| **Đổi mật khẩu tài khoản Admin quản trị Portal** | Database PostgreSQL | Web UI hoặc lệnh Node CLI trên Server |

---

## 1. Khi đổi Tên Miền (Domain) của trang Portal

Ví dụ: Đổi từ `wifi.jtsc.vn` sang `portal.tencongty.vn`.

### Bước 1: Sửa file chuyển hướng `login.html`
- Mở file [BackupWifimarketing_LoginHTML](file:///home/jtsc/wifimarketing/Backup%20WifiMarketing/BackupWifimarketing_LoginHTML):
  Sửa dòng:
  ```javascript
  var url = 'https://wifi.jtsc.vn/portal';
  ```
  Thành:
  ```javascript
  var url = 'https://portal.tencongty.vn/portal';
  ```
  *(Sửa cả dòng `<noscript>` bên dưới).*
- Đẩy đè file này vào thư mục `hotspot/login.html` trên MikroTik.

### Bước 2: Thêm tên miền mới vào Walled Garden trên MikroTik
Chạy lệnh trong Terminal của MikroTik:
```routeros
/ip hotspot walled-garden add dst-host=portal.tencongty.vn comment="portal-new-domain"
/ip hotspot walled-garden add dst-host=www.portal.tencongty.vn comment="portal-new-domain"
```

### Bước 3: Cập nhật biến môi trường trên Portal Server
Mở file `.env` tại `/home/jtsc/wifimarketing/.env`:
```env
APP_DOMAIN=portal.tencongty.vn
NEXT_PUBLIC_APP_URL=https://portal.tencongty.vn
NEXT_PUBLIC_API_URL=https://portal.tencongty.vn
```
Sau đó restart container:
```bash
docker compose restart backend frontend
```

---

## 2. Cho phép thiết bị truy cập trước website khác (Walled Garden)

Ví dụ: Cho phép khách xem website cơ quan (`nxbctqg.org.vn`), logo trên Cloud, hoặc nghe nhạc/video trước khi ấn "Kết nối".

### Lệnh thêm trên MikroTik:
```routeros
# Cho phép theo tên miền (khuyên dùng, hỗ trợ cả subdomain *):
/ip hotspot walled-garden add dst-host=*.nxbctqg.org.vn comment="trang-chu-co-quan"

# Cho phép theo địa chỉ IP máy chủ cụ thể:
/ip hotspot walled-garden ip add dst-address=192.168.1.100 action=accept comment="may-chu-noi-bo"
```

---

## 3. Miễn xác thực cho thiết bị (Bypass không cần xem quảng cáo)

Dùng cho: Các bộ phát WiFi UniFi AP, máy chủ, máy chấm công, máy in, hoặc thiết bị của lãnh đạo.

### Cách thêm trên MikroTik:
Vào WinBox: **IP > Hotspot > IP Bindings > dấu (+)**:
- **MAC Address**: Điền địa chỉ MAC của thiết bị (VD: `70:A7:41:E8:A2:33`).
- **Address**: Điền IP cố định (nếu có).
- **Type**: Chọn **bypassed**.
- **Comment**: Ghi chú tên thiết bị (VD: `UniFi-AP-Tang-1`).

**Hoặc chạy lệnh Terminal:**
```routeros
/ip hotspot ip-binding add mac-address=AA:BB:CC:DD:EE:FF type=bypassed comment="May-in-Phong-KT"
```

---

## 4. Chỉnh thời gian phiên kết nối WiFi (Uptime, Timeout)

Ví dụ: Sau 4 tiếng muốn người dùng phải xem lại quảng cáo để kết nối tiếp.

### Lệnh điều chỉnh trên MikroTik:
```routeros
# Chỉnh thời gian dùng miễn phí mỗi phiên (VD: 4h = 4 tiếng, 8h = 8 tiếng):
/ip hotspot profile set [find name=hsprof1] trial-uptime-limit=4h

# Chỉnh thời gian tự động reset bộ đếm (VD: 1d = sau 1 ngày được dùng lại từ đầu):
/ip hotspot profile set [find name=hsprof1] trial-uptime-reset=1d

# Chỉnh thời gian ngắt kết nối khi thiết bị không hoạt động (idle timeout):
/ip hotspot user profile set [find name=uprof1] idle-timeout=30m keepalive-timeout=5m
```

---

## 5. Khi đổi mật khẩu hoặc IP Router MikroTik

Nếu bạn đổi IP hoặc mật khẩu admin của MikroTik:
1. Đổi trên MikroTik:
   ```routeros
   /user set admin password=MatKhauMoiCuaBan
   ```
2. Mở file `.env` trên Server Portal (`/home/jtsc/wifimarketing/.env`), sửa:
   ```env
   MIKROTIK_HOST=192.168.1.200        # IP mới của MikroTik (nếu có đổi)
   MIKROTIK_PASSWORD=MatKhauMoiCuaBan # Mật khẩu mới
   ```
3. Khởi động lại backend để kết nối:
   ```bash
   cd /home/jtsc/wifimarketing
   docker compose restart backend
   ```

---

## 6. Khi thay đổi UniFi Controller

Nếu cơ quan đổi Controller hoặc chuyển server quản lý AP:
1. Mở file `.env` trên Server Portal (`/home/jtsc/wifimarketing/.env`), cập nhật 4 dòng:
   ```env
   UNIFI_CONTROLLER_URL=https://diachi-controller:8443
   UNIFI_USERNAME=ten-tai-khoan
   UNIFI_PASSWORD=mat-khau
   UNIFI_SITE=ten-site-hoac-default
   ```
2. Khởi động lại backend:
   ```bash
   docker compose restart backend
   ```

---

## 7. Quản lý tài khoản Admin đăng nhập Web Portal

Trang quản trị: `https://wifi.jtsc.vn/admin`

- **Đổi mật khẩu từ giao diện**: Đăng nhập vào web > Vào mục **Cài đặt** (Settings) > Đổi mật khẩu.
- **Tạo/Reset mật khẩu khẩn cấp qua dòng lệnh Terminal**:
  Nếu quên mật khẩu admin, chạy lệnh sau trực tiếp trên server:
  ```bash
  docker exec wifi-marketing-backend node -e '
  const { PrismaClient } = require("@prisma/client");
  const bcrypt = require("bcryptjs");
  const prisma = new PrismaClient();
  bcrypt.hash("MatKhauMoi123", 10).then(hash => {
    return prisma.admin.upsert({
      where: { username: "admin" },
      update: { password: hash },
      create: { username: "admin", password: hash }
    });
  }).then(() => console.log("Done")).finally(() => prisma.$disconnect());
  '
  ```
