# HƯỚNG DẪN CHỈNH SỬA CẤU HÌNH HỆ THỐNG WIFI MARKETING NXB

Tài liệu này tổng hợp toàn bộ các tình huống cần thay đổi cấu hình sau này, giải thích rõ **cần sửa ở file nào, sửa trên thiết bị nào và dùng lệnh gì**.

---

## 📌 BẢNG TRA CỨU NHANH CÁC THÀNH PHẦN

| Nhu cầu thay đổi | Vị trí cần sửa đổi | File hoặc Menu liên quan |
| :--- | :--- | :--- |
| **Đổi Domain trang chào (Portal)** | 1. MikroTik Walled Garden<br>2. MikroTik `login.html`<br>3. Server `.env` | `login.html`<br>`.env`<br>WinBox: `IP > Hotspot > Walled Garden` |
| **Thêm Web/App cho truy cập trước đăng nhập** | MikroTik Walled Garden | WinBox: `IP > Hotspot > Walled Garden` |
| **Miễn đăng nhập cho thiết bị (Bypass AP, switch, máy in)** | MikroTik IP Bindings | WinBox: `IP > Hotspot > IP Bindings` |
| **Đổi thời gian ngắt kết nối / thời hạn phiên** | MikroTik Hotspot Profile | WinBox: `IP > Hotspot > Server Profiles` |
| **Đổi IP WAN hoặc mật khẩu Router MikroTik** | 1. MikroTik RouterOS<br>2. Server Portal `.env` | `.env`<br>Terminal RouterOS: `/user set admin ...` |
| **Đổi thông tin UniFi Controller** | Server Portal `.env` | `/home/nxb/wifimarketing/.env` |
| **Đổi mật khẩu tài khoản Admin quản trị Portal** | Database PostgreSQL | Web UI hoặc lệnh Node CLI trên Server |

---

## 1. Khi đổi Tên Miền (Domain) của trang Portal

Ví dụ: Đổi từ `solutionai.com.vn` sang `wifi.nxbctqg.org.vn`.

### Bước 1: Sửa file chuyển hướng `login.html`
- Mở file [login.html](file:///home/nxb/wifimarketing/Backup%20WifiMarketing/login.html):
  Sửa dòng URL chuyển hướng:
  ```html
  $(if http-header == "Location")https://wifi.nxbctqg.org.vn/portal?mac=$(mac-esc)&ip=$(ip)...$(endif)
  ```
  *(và dòng `<meta http-equiv="refresh" content="0; url=https://wifi.nxbctqg.org.vn/portal?...">`)*
- Nạp file vào MikroTik:
  ```bash
  scp login.html admin@192.168.1.200:/hotspot/login.html
  ```

### Bước 2: Thêm tên miền mới vào Walled Garden trên MikroTik
Chạy lệnh trong Terminal của MikroTik:
```routeros
/ip hotspot walled-garden add dst-host=wifi.nxbctqg.org.vn comment="portal-domain"
/ip hotspot walled-garden add dst-host=*.wifi.nxbctqg.org.vn comment="portal-domain"
```

### Bước 3: Cập nhật biến môi trường trên Portal Server
Mở file `.env` tại `/home/nxb/wifimarketing/.env`:
```env
APP_DOMAIN=wifi.nxbctqg.org.vn
NEXT_PUBLIC_APP_URL=https://wifi.nxbctqg.org.vn
NEXT_PUBLIC_API_URL=https://wifi.nxbctqg.org.vn
```
Sau đó restart container:
```bash
docker compose restart backend frontend
```

---

## 2. Cho phép thiết bị truy cập trước website khác (Walled Garden)

Ví dụ: Cho phép khách xem website cơ quan (`nxbctqg.org.vn`, `stbook.vn`), logo trên Cloud, hoặc tài liệu trước khi ấn "Kết nối".

### Lệnh thêm trên MikroTik:
```routeros
# Cho phép theo tên miền (khuyên dùng, hỗ trợ cả subdomain *):
/ip hotspot walled-garden add dst-host=*.nxbctqg.org.vn comment="trang-chu-co-quan"
/ip hotspot walled-garden add dst-host=*.stbook.vn comment="nha-sach-su-that"

# Cho phép theo địa chỉ IP máy chủ cụ thể:
/ip hotspot walled-garden ip add dst-address=192.168.1.253 action=accept comment="may-chu-portal"
```

---

## 3. Miễn xác thực cho thiết bị (Bypass không cần xem quảng cáo)

Dùng cho: Các bộ phát WiFi UniFi AP, switch mạng, máy in, máy chấm công, hoặc thiết bị của ban giám đốc.

### Cách thêm trên MikroTik:
Vào WinBox: **IP > Hotspot > IP Bindings > dấu (+)**:
- **MAC Address**: Điền địa chỉ MAC của thiết bị (VD: `74:FA:29:5F:71:93`).
- **Address**: Điền IP cố định (nếu có, VD: `10.10.1.1`).
- **Type**: Chọn **bypassed**.
- **Comment**: Ghi chú tên thiết bị (VD: `UniFi-AP-Tang-1`).

**Hoặc chạy lệnh Terminal RouterOS:**
```routeros
/ip hotspot ip-binding add mac-address=AA:BB:CC:DD:EE:FF type=bypassed comment="May-in-Phong-KT"
```

---

## 4. Chỉnh thời gian phiên kết nối WiFi (Uptime, Timeout)

Ví dụ: Sau 4 tiếng hoặc 8 tiếng muốn người dùng phải xem lại quảng cáo để kết nối tiếp.

### Lệnh điều chỉnh trên MikroTik:
```routeros
# Chỉnh thời gian dùng miễn phí mỗi phiên (VD: 4h = 4 tiếng, 8h = 8 tiếng, 1d = 1 ngày):
/ip hotspot profile set [find name=hsprof1] trial-uptime-limit=4h

# Chỉnh thời gian hết hạn thiết bị rảnh không dùng mạng (idle-timeout):
/ip hotspot user profile set [find name=default] idle-timeout=30m
```

---

## 5. Xuất bản và cập nhật chiến dịch quảng cáo trên CMS

1. Đăng nhập trang quản trị: `https://solutionai.com.vn/admin`
2. Vào mục **Mẫu giao diện** -> Chỉnh sửa nội dung, banner, video.
3. **Bắt buộc:** Sau khi chỉnh sửa, bấm nút **Xuất bản (Publish)** để template tạo phiên bản phát hành mới.
4. Vào mục **Chiến dịch** -> Chọn mẫu đã xuất bản gán vào SSID **WIFI KHACH NXB** và bấm Lưu.
