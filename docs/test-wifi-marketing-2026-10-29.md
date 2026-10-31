# SSID thử WiFi Marketing — 29/10/2026

Đã tạo SSID **TEST WIFI MARKETING**, không mật khẩu, 2.4/5 GHz trên nhóm AP mặc định của site `m5npy6bn`. Controller đã báo 8 AP có VAP đang up và guest policy bật tại lần đọc kiểm tra.

- WLAN ID: `6ae2aeb173bb6723280949cf`.
- Chiến dịch: `91a2b21b-20fb-443c-9a40-e3a6281a0c82` — TEST WIFI MARKETING - 29/10/2026.
- Mẫu: Mẫu 4 đã xuất bản (`9b98e5ed-9532-4904-9e55-b4125b1824af`).
- Chiến dịch thử kết thúc: **09:25 ngày 30/10/2026 giờ Việt Nam**. Hết chiến dịch, worker khôi phục SSID về truy cập trực tiếp theo chính sách chung; không tự xóa/tắt SSID.
- Tạo SSID ban đầu disabled/không guest, tạo chiến dịch qua API ứng dụng rồi enable SSID. Worker tự lấy ownership và bật riêng `is_guest`; không bật guest thủ công ngoài worker.
- Bộ đồng bộ đọc lại healthy, 1 campaign, không có site chưa sẵn sàng hoặc mục tiêu trùng.
- SSID dùng network Default không VLAN như hai SSID cũ; không sửa DHCP/PPPoE/interface/bridge/router.
- Đối chiếu hai WLAN cũ, network và portal site: giữ nguyên so với snapshot trước tạo.
- SSH chỉ đọc AP7.1 xác nhận `redirector.status=enabled` và cả hai redirect URL trỏ tới `http://192.168.1.253:80/guest/s/m5npy6bn/`; entry HTTP302 và public health hoạt động.

Chưa tuyên bố hoàn tất đăng nhập WiFi thực: người vận hành sẽ kết nối điện thoại để thử nhận IP, mở portal, hoàn tất điều kiện và truy cập Internet. Không giả lập/authorize MAC của khách để thay cho phép thử.

Snapshot và readback trong `.tmp/test-wifi-marketing-20261029/`; thông tin SSH tạm đã xóa sau kiểm tra.

Nếu muốn dừng thử ngay: tắt chiến dịch trên ứng dụng để worker khôi phục guest policy, sau đó disable/xóa riêng SSID thử. Giữ nguyên hai SSID cũ.
