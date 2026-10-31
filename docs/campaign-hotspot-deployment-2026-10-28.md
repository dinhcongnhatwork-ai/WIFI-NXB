> **Cập nhật:** người vận hành đã chọn triển khai UniFi External Portal. Tài liệu này ghi lại giai đoạn staging MikroTik trước đó. Trạng thái hiện hành ở `docs/unifi-portal-production-2026-10-28.md`.

# Hotspot MikroTik — trạng thái ngày 28/10/2026

## Trạng thái hiện tại

**Đã nạp cấu hình chỉ gồm Hotspot lên MikroTik, nhưng server `wmk-marketing` vẫn tắt (`disabled=true`). Chưa có xác thực WiFi Marketing thực tế.**

Người vận hành xác nhận Hotspot phải nằm trên MikroTik; UniFi chỉ quản lý SSID. Hướng xác thực guest qua UniFi trước đó đã dừng: các trường site portal đã được hoàn lại, dịch vụ HTTP cổng 80 thử nghiệm đã dừng và xóa, mã ứng dụng thử nghiệm đã được lưu riêng rồi khôi phục từ snapshot. Hai container ứng dụng đang chạy vẫn là bản cũ; không triển khai bản UniFi.

## Cấu hình đã nạp

Script: `deploy/mikrotik-hotspot-only-staged.rsc`. Đã kiểm tra cú pháp bằng `import ... verbose=yes dry-run` trên RouterOS thực trước khi import.

- Server: `wmk-marketing`, interface có sẵn `bridge`, **disabled**.
- Hotspot address: địa chỉ gateway có sẵn `192.168.0.1`.
- Hotspot address pool: `none`; không thêm hoặc sửa pool/DHCP.
- Profile riêng `wmk-hsprof`, user profile riêng `wmk-trial`; không sửa profile mặc định.
- Dùng thư mục HTML `hotspot` đã có; `login.html` hiện hướng tới `https://solutionai.com.vn/portal`.
- Walled garden chỉ cho domain portal: HTTP và TCP 443.
- Một binding bypass mặc định, chỉ thuộc server mới. Rule này không có tác dụng khi server còn tắt, và không phải cơ chế xác thực chiến dịch.

Không import nguyên bản `BackupWifimarketing_Mikrotik_CCR2004.rsc`, vì bản đó chứa thay đổi bridge/DHCP/IP và dùng mạng `10.10.1.0/24` cũ.

## Đối chiếu cấu hình

Đã đọc `/export` trước và sau. Chỉ sáu nhóm `/ip hotspot...` khác nhau; **mọi nhóm cấu hình ngoài Hotspot giống nguyên bản**. PPPoE `pppoe-out1` vẫn chạy. DHCP vẫn là:

| Mục | Giá trị giữ nguyên |
| --- | --- |
| Server/interface | `dhcp-lan` / `bridge` |
| Pool | `pool-lan` |
| Dải cấp phát | `192.168.0.20–192.168.0.255`, `192.168.1.2–192.168.3.254` |
| Gateway/DNS DHCP | `192.168.0.1` |
| Mạng / lease | `/22` / 8 giờ |

SSID `NXBCTQGST` và `WIFI_PHÒNG HỌP` vẫn dùng WPA PSK. Không đổi mật khẩu, guest policy, VLAN hay cấu hình network của các SSID.

## Vì sao chưa bật

Toàn bộ LAN và các SSID dùng chung bridge, không có VLAN/interface riêng cho chiến dịch. MikroTik không nhận được tên SSID từ các gói Ethernet của UniFi. Chỉ thêm Hotspot trên bridge sẽ không tự tạo được điều kiện “SSID thuộc chiến dịch”.

Phương án đọc MAC–SSID từ controller rồi cập nhật binding Hotspot có độ trễ và có thể cho khách vào Internet trước khi nhận diện. Ngoài ra FastTrack hiện tại có thể tiếp tục bỏ qua xử lý Hotspot cho kết nối đang tồn tại. Vì người vận hành yêu cầu giữ nguyên các cấu hình mạng khác, chưa tự sửa FastTrack, xóa connection tracking hoặc bật Hotspot cho cả LAN.

Cần quyết định rõ cơ chế nhận diện và phạm vi ngoại lệ trước khi kích hoạt. Không coi trạng thái đã nạp là xác thực đã hoạt động. Tài liệu: [HotSpot và IP binding](https://manual.mikrotik.com/docs/authentication-authorization-accounting/hotspot-captive-portal/), [FastTrack và Hotspot](https://help.mikrotik.com/docs/spaces/ROS/pages/130220087/Connection+tracking).

## Kiểm tra mẫu trắng

Đã kiểm tra trình duyệt thật qua `solutionai.com.vn`: danh sách mẫu, cài đặt mẫu, trình thiết kế Mẫu 4, xem trước Mẫu 1/Mẫu 4, cả năm popup mẫu có sẵn, portal máy tính và portal khổ điện thoại. Các trang đều hiển thị nội dung; không tái hiện màn trắng hay lỗi JavaScript trong các luồng này. Chưa sửa mã hoặc dữ liệu mẫu khi chưa xác định được nguyên nhân.

Ảnh kiểm tra: `.tmp/hotspot-white-screen/m4mobile.png`, `portal-mobile.png`, `gallery-1.png` đến `gallery-5.png`. Cần URL/tên mẫu và thao tác cụ thể gây trắng ở trình duyệt người vận hành để tiếp tục chẩn đoán.

## Hồ sơ kiểm tra

Snapshot router trước/sau và kết quả import lưu tại `.tmp/hotspot-audit-20261028/`. Thử nghiệm UniFi đã dừng được lưu riêng trong `.tmp/hotspot-unifi-abandoned/`; không đưa các snapshot chứa thông tin kết nối lên Git. Không tạo campaign hoặc SSID thử nghiệm.


## Cập nhật vận hành ngày 29/10/2026

Đã bổ sung [thời hạn phiên theo chiến dịch](campaign-session-expiry-2026-10-29.md) và [danh sách thiết bị miễn xác thực theo MAC](unifi-device-exemptions-2026-10-29.md). Bản ứng dụng production hiện tại: `wifimarketing:unifi-exempt-20261029`. Xem tài liệu mới để biết API, quy tắc cấp/thu hồi quyền, kết quả kiểm thử và rollback.


## Sửa portal ngày 30/10/2026

Đã sửa [ngoại lệ IP portal trước xác thực](portal-walled-garden-fix-2026-10-30.md). Người dùng xác nhận TEST WIFI MARKETING mở portal và có Internet. Bản production hiện tại: `wifimarketing:portal-walled-garden-20261030`; tác vụ duy trì quản lý đầy đủ IPv4 của tên miền portal.
