# HƯỚNG DẪN ÁP DỤNG CẤU HÌNH CHO ROUTER MIKROTIK MỚI

Tài liệu này hướng dẫn cách khôi phục hoặc áp dụng cấu hình WiFi Marketing (Hotspot Active Session) lên thiết bị MikroTik từ các file sao lưu trong thư mục này.

---

## 🛠️ PHẦN 1: Chuẩn bị phần cứng và kết nối mạng
Đảm bảo sơ đồ đấu nối vật lý trên Router mới:
1. **Cổng ether1 (WAN)**: Cắm vào mạng Internet cấp dưới hoặc modem nhà mạng (Router cấu hình IP tĩnh là `192.168.1.200/24`, gateway `192.168.1.1`).
2. **Cổng ether2 (LAN/Hotspot)**: Cắm xuống Switch chia mạng hoặc các bộ phát WiFi Access Point (AP). Cổng này sẽ cấp dải IP Hotspot `10.10.20.0/22` (cấp phát từ `10.10.20.2` đến `10.10.23.254`).

---

## 🚀 PHẦN 2: Các bước cấu hình Router MikroTik

### Bước 2.1: Đăng nhập Router
- **IP**: `192.168.1.200`
- **Tài khoản**: `admin`
- **Mật khẩu**: `10122002` (hoặc mật khẩu mặc định nếu router mới reset trắng)

---

### Bước 2.2: Nạp cấu hình script vào Router
1. Mở WinBox hoặc dùng SFTP/SCP đẩy file `BackupWifimarketing_Mikrotik.rsc` lên thư mục gốc của Router.
2. Trong Terminal của RouterOS, chạy lệnh:
   ```routeros
   /import file-name=BackupWifimarketing_Mikrotik.rsc
   ```
3. Kiểm tra xem có thông báo `Script file loaded and executed successfully`.

---

### Bước 2.3: Nạp file giao diện chuyển hướng `login.html`
Khi người dùng kết nối WiFi, Router cần file này để tự động chuyển hướng họ sang trang Portal `https://wifi.jtsc.vn/portal`.
1. Đổi tên file `BackupWifimarketing_LoginHTML` thành **`login.html`**.
2. Đẩy file `login.html` vào thư mục **`hotspot/`** trên Router (thay thế file `login.html` mặc định).
3. Nếu trên Router chưa có thư mục `hotspot`, tạo nhanh bằng lệnh:
   ```routeros
   /ip hotspot reset-html numbers=[find name=hsprof1]
   ```
   Sau đó ghi đè `login.html` vào thư mục `hotspot/`.

---

## 💻 PHẦN 3: Cấu hình Portal Server

1. File `.env` dự án Portal tại `/home/jtsc/wifimarketing/.env` (đã được lưu tại `BackupWifimarketing_Portal_Env`):
   ```env
   # Thông tin kết nối MikroTik API
   MIKROTIK_HOST=192.168.1.200
   MIKROTIK_USERNAME=admin
   MIKROTIK_PASSWORD=10122002
   HOTSPOT_DNS_NAME=hotspot.wifi

   # Thông tin kết nối UniFi Controller
   UNIFI_CONTROLLER_URL=https://viettuans.synology.me:8443
   UNIFI_USERNAME=itnxb
   UNIFI_PASSWORD=123456
   UNIFI_SITE=m5npy6bn
   ```
2. Tài khoản quản trị Web Portal (`https://wifi.jtsc.vn/admin`):
   - **Tài khoản 1**: `admin` / `10122002`
   - **Tài khoản 2**: `itnxb` / `123456`
3. Khởi động lại các container Portal:
   ```bash
   cd /home/jtsc/wifimarketing
   docker compose restart backend
   ```

---

## 🧪 PHẦN 4: Kiểm tra hoạt động hệ thống

1. **Kết nối thiết bị test (điện thoại/máy tính)** vào WiFi phát ra từ cổng `ether2`.
2. Thiết bị nhận IP nằm trong dải `10.10.20.X - 10.10.23.X` và Gateway/DNS là `10.10.20.1`.
3. Trình duyệt tự động bung trang Portal `https://wifi.jtsc.vn/portal`.
4. Xem hết quảng cáo/video và ấn nút **Kết nối ngay**.
5. Thiết bị được cấp Internet bình thường và kiểm tra:
   - Trên MikroTik: Tab **IP > Hotspot > Active** xuất hiện phiên của client.
   - Tab **IP > Hotspot > IP Bindings**: Chỉ chứa các thiết bị hạ tầng được Bypass (như Access Point `10.10.23.254`, máy chủ nội bộ).
