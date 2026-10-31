# HƯỚNG DẪN ÁP DỤNG & KHÔI PHỤC CẤU HÌNH WIFI MARKETING NXB

Tài liệu này hướng dẫn cách áp dụng hoặc khôi phục toàn bộ cấu hình WiFi Marketing (MikroTik Hotspot + Portal Server + Database) từ các file sao lưu trong thư mục này.

---

## 📦 DANH MỤC CÁC FILE SAO LƯU

1. **`BackupWifimarketing_CCR2004.backup`**: File backup nhị phân toàn diện của MikroTik CCR2004-16G-2S+ (khôi phục 1 chạm: tài khoản, mật khẩu, bridge, hotspot, IP, firewall, script).
2. **`BackupWifimarketing_Mikrotik.rsc`** (và `BackupWifimarketing_Mikrotik_CCR2004.rsc`): Script cấu hình dạng text, có thể đọc và import vào bất kỳ dòng router MikroTik nào.
3. **`BackupWifimarketing_LoginHTML`** (và `login.html`): File chuyển hướng Hotspot tự động bung popup (CNA) trên iPhone / Android theo chuẩn HTTP 302 về `https://solutionai.com.vn/portal`.
4. **`alogin.html`**: Trang phản hồi sau khi hoàn tất xác thực Hotspot.
5. **`BackupWifimarketing_Database.sql`**: Toàn bộ cơ sở dữ liệu PostgreSQL (chiến dịch, mẫu giao diện, tài khoản, nhật ký kết nối).
6. **`BackupWifimarketing_Portal_Env`**: Toàn bộ biến môi trường `.env` chuẩn của máy chủ WiFi Marketing.

---

## 🛠️ PHẦN 1: Sơ đồ mạng & Đấu nối phần cứng

- **WAN (ether1)**:
  - Địa chỉ IP: `192.168.1.200/24`
  - Gateway: `192.168.1.1`
  - DNS: `8.8.8.8`, `1.1.1.1`
- **LAN / Hotspot (bridge-wifi gồm ether2 đến ether16)**:
  - Địa chỉ IP Router: `10.10.1.2/24`
  - DNS Name: `hotspot.wifi` -> `10.10.1.2`
  - DHCP Server cấp phát: `10.10.1.10` - `10.10.1.240`
  - Thiết bị hạ tầng cố định (được Bypass Hotspot):
    - **UniFi AP**: IP `10.10.1.1` (MAC: `74:FA:29:5F:71:93`)
    - **Switch CRS328**: IP `10.10.1.253` (MAC: `D0:EA:11:D8:52:2C`)
- **Máy chủ Portal**:
  - IP nội bộ: `192.168.1.253` (hoặc truy cập qua domain công cộng `solutionai.com.vn`)

---

## 🚀 PHẦN 2: Khôi phục cấu hình Router MikroTik

### Cách 1: Khôi phục bằng File Binary (Nhanh nhất & Đầy đủ nhất)
1. Kết nối WinBox tới Router qua MAC hoặc IP `192.168.1.200`.
2. Mở menu **Files**, kéo thả file `BackupWifimarketing_CCR2004.backup` vào Files list.
3. Chọn file `BackupWifimarketing_CCR2004.backup` và bấm **Restore**. Router sẽ tự khởi động lại và chạy đúng 100% cấu hình.

### Cách 2: Khôi phục bằng File Script `.rsc`
1. Đẩy file `BackupWifimarketing_Mikrotik.rsc` lên thư mục gốc của Router qua SFTP hoặc WinBox.
2. Mở Terminal RouterOS, chạy:
   ```routeros
   /import file-name=BackupWifimarketing_Mikrotik.rsc
   ```
3. Nạp lại file `login.html` và `alogin.html` vào thư mục `hotspot/` trên router:
   ```bash
   scp login.html alogin.html admin@192.168.1.200:/hotspot/
   ```

---

## 💾 PHẦN 3: Khôi phục Cơ sở dữ liệu (Database)

Nếu cần khôi phục lại dữ liệu chiến dịch, mẫu quảng cáo trên máy chủ:
```bash
# Đẩy file BackupWifimarketing_Database.sql vào container PostgreSQL
docker exec -i wifi-marketing-db psql -U postgres -d wifimarketing < "Backup WifiMarketing/BackupWifimarketing_Database.sql"
```

---

## ⚙️ PHẦN 4: Khôi phục cấu hình máy chủ Web Portal

1. Sao chép file biến môi trường vào dự án:
   ```bash
   cp "Backup WifiMarketing/BackupWifimarketing_Portal_Env" /home/nxb/wifimarketing/.env
   ```
2. Khởi động lại các dịch vụ:
   ```bash
   cd /home/nxb/wifimarketing
   docker compose restart backend frontend
   ```

---

## 🧪 PHẦN 5: Kiểm tra xác thực End-to-End

1. Kết nối điện thoại/laptop vào sóng WiFi **WIFI KHACH NXB** (hoặc cắm dây LAN vào các cổng `ether2` - `ether16`).
2. Thiết bị tự động nhận IP trong dải `10.10.1.X`.
3. Màn hình Captive Portal tự động popup hiển thị chiến dịch của `solutionai.com.vn`.
4. Người dùng bấm **"Kết nối WiFi & Khám phá Sách"** -> Router MikroTik cấp quyền vào mạng Internet (`Authorized`).
