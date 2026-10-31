# Sửa portal TEST WIFI MARKETING ngày 30/10/2026

## Hiện tượng và bằng chứng

SSID có mật khẩu `NXBCTQGST` truy cập Internet bình thường; SSID chiến dịch `TEST WIFI MARKETING` mở captive nhưng treo/chờ hoặc không hoàn tất xác thực.

Kiểm tra trực tiếp controller và AP3.1 (`192.168.2.63`) cho thấy AP vẫn Connected, WiFi TEST là guest/open, thiết bị nhận IP từ DHCP hiện tại. API portal với thông tin thiết bị đúng trả HTTP 200 trong khoảng 0,4 giây nội bộ, 0,9 giây qua tên miền; trình duyệt kiểm tra hiển thị mẫu trong 1,6 giây. Hai lần xác thực trước đó đã được controller chuyển xuống `guest_authorized_mac` trên AP. Chưa có bằng chứng lỗi đường WAN/PPPoE/DHCP.

`solutionai.com.vn` có hai bản ghi A: `104.21.51.90` và `172.67.177.252`. AP chỉ có địa chỉ thứ hai trong `guest_pre_allow`. Kiểm tra `ipset test guest_pre_allow 104.21.51.90` thất bại. Quy tắc guest chuyển hướng/chặn HTTPS tới địa chỉ chưa được phép trước khi cho khách truy cập. Chỉ cho phép tên miền qua DNS proxy AP chưa bao phủ thiết bị dùng địa chỉ DNS đã lưu.

## Bản sửa đã áp dụng trên controller

Chỉ bổ sung hai trường trong `guest_access`:

- `allowed_subnet_3=104.21.51.90/32`
- `allowed_subnet_4=172.67.177.252/32`

Đọc lại toàn bộ guest settings: mọi trường cũ giữ nguyên. Đối chiếu 3 WLAN và network trước–sau trùng khớp. AP nhận đủ hai địa chỉ trong `guest_pre_allow`. Không sửa PPPoE, bridge, DHCP, VLAN, mật khẩu hay cấu hình SSID.

**Người dùng đã thử lại và xác nhận: “Portal mở và có Internet”.**

## Duy trì vận hành

Tác vụ hotspot kiểm tra toàn bộ IPv4 của tên miền portal khoảng mỗi 5 phút. Chỉ áp dụng cho controller/site portal đã cấu hình, portal external đang sẵn sàng và tên miền đã được quản trị cho phép.

Phạm vi thay đổi chỉ là các trường preauthorization `/32` do tác vụ sở hữu. Sổ sở hữu bền vững nằm tại `SystemSetting` với prefix `campaignHotspot:portalAddresses:`. Khi DNS đổi, tái sử dụng/xóa địa chỉ cũ do tác vụ sở hữu; giữ nguyên các ngoại lệ và chỉnh sửa thủ công. Lưu ý định trước lệnh controller và đọc lại sau lệnh để phục hồi sau timeout/khởi động lại. Bản sửa hai IP ban đầu đã ghi nhận sở hữu và AuditLog.

Nếu DNS, khóa xử lý hoặc cập nhật IP lỗi, tác vụ báo `portalDnsFailures`, không bật guest cho WLAN mới. Các WLAN guest đang được quản lý vẫn giữ yêu cầu xác thực, không mở Internet để che lỗi. Không tự cấp quyền cho máy chưa bấm kết nối hoặc không thuộc danh sách miễn xác thực.

## Kiểm chứng triển khai

Đã triển khai ngày 30/10/2026 lúc 12:11 (UTC+7), image `wifimarketing:portal-walled-garden-20261030`.

- 182/182 kiểm tra tự động qua 18 bộ, gồm DNS đủ nhiều IP, xoay IP/thu hồi quyền sở hữu cũ, bảo toàn ngoại lệ thủ công, restart/timeout, mất khóa, và chặn kích hoạt guest mới nếu DNS lỗi.
- Rà soát độc lập đã kiểm tra và xác nhận bản sửa quản lý IP cũ và nhánh thất bại.
- Production build/typecheck thành công; hash 3 tệp runtime trùng mã nguồn đã kiểm tra. Bản chạy thử đọc API portal thật HTTP 200, đúng Mẫu 4.
- Kiểm tra trực tiếp AP3.1 và AP5.2: cả hai IP portal đều nằm trong `guest_pre_allow`.
- Người dùng xác nhận portal mở và truy cập Internet. Controller ghi nhận thiết bị TEST được cấp quyền; không cấp quyền hộ thiết bị trong quá trình kiểm tra.
- Ngay sau rollout, tác vụ hotspot/session/miễn xác thực đều `healthy`; `portalDnsFailures=0`. Sau đó lúc 12:11 quản trị viên gửi hai lệnh `campaign.sessions.disconnect` (AuditLog accepted); tác vụ phiên chuyển sang chờ thu hồi các máy ngoại tuyến và bỏ qua một máy đã sang `NXBCTQGST` (`needs-attention`, không có lỗi controller), đúng giới hạn không ngắt mạng chính. Tác vụ hotspot và miễn xác thực vẫn healthy. Guest settings, WLAN và network giữ nguyên so với bản sửa cấu hình đã được xác nhận; các container hạ tầng không khởi động lại.

Ứng dụng hiện dùng cùng bản đóng gói cho frontend/backend, giữ các cập nhật giao diện topology đã chạy trước đó. Rollback có hai tag theo dịch vụ: `wifimarketing:before-portal-dns-frontend-20261030` và `wifimarketing:before-portal-dns-backend-20261030`. Rollback ứng dụng vẫn giữ hai ngoại lệ IP portal đã sửa, tránh đưa lỗi truy cập trước xác thực trở lại.


Kiểm tra trình duyệt production sau rollout: API 200, đúng mẫu, hiển thị trong khoảng 2,8 giây, không có lỗi JavaScript.
