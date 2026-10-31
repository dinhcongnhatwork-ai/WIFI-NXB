# Thời hạn phiên WiFi theo chiến dịch

Bản production triển khai ngày 29/10/2026 khoảng 11:51 giờ Việt Nam: `wifimarketing:campaign-sessions-20261029`, image `sha256:d3d48acfcc514f09153ec95446b33c456338e19cd33a10751f97564c254583a5`. Ảnh trước giữ tại `wifimarketing:before-campaign-sessions-20261029`.

## Vận hành

Vào **Chiến dịch → ⋮ → Thời hạn phiên WiFi**. Có lựa chọn 30 phút, 1 giờ, 2 giờ, 4 giờ và số phút tùy chỉnh từ 1 đến 1440. Thời hạn tính từ lúc xác thực thành công, giới hạn thêm bởi thời điểm kết thúc chiến dịch. Ngắt WiFi, Forget hoặc bấm kết nối lặp lại không đặt lại hạn của phiên đang còn hiệu lực.

Forget trên máy khách không thu hồi bản ghi cấp quyền theo MAC trên UniFi. Vì vậy, kết nối lại trước hạn vẫn có thể sử dụng quyền đã được cấp. Cơ chế mới thu hồi quyền và gửi lệnh ngắt khi hết hạn; sau đó khách phải đi qua portal để cấp một phiên mới.

Lưu thời hạn áp dụng cho lần đăng nhập tiếp theo. Quản trị viên có thể chọn **Ngắt các phiên hiện tại để áp dụng ngay**: lưu thời hạn, rồi xếp lịch ngắt các thiết bị đang kết nối và các phiên đã được hệ thống theo dõi của đúng chiến dịch. Các phiên cũ giữ nguyên khi không chọn mục này. Mặc định 240 phút được giữ lại khi chưa có cấu hình riêng; không tự chọn 30/60 phút cho chiến dịch TEST trong lúc triển khai.

Nút Reset WiFi trên menu chiến dịch nay dùng API ngắt phiên theo chiến dịch UniFi, thay cho lệnh xóa toàn bộ phiên MikroTik trước đây.

## API

Các endpoint yêu cầu đăng nhập quản trị bằng bearer token hoặc phiên hiện có:

| Phương thức | Đường dẫn | Quyền | Chức năng |
| --- | --- | --- | --- |
| GET | `/api/campaigns/{id}/session-policy` | read | Đọc `sessionMinutes`, `minMinutes`, `maxMinutes` |
| PUT | `/api/campaigns/{id}/session-policy` | operate | Lưu `{ "sessionMinutes": 30 }` hoặc số phút hợp lệ khác |
| POST | `/api/campaigns/{id}/session-policy` | admin | Body `{}`; xếp lịch yêu cầu đăng nhập lại cho chiến dịch |

POST trả HTTP202 với `data.queued`; đây là số yêu cầu đã lưu, không phải xác nhận thiết bị đã ngắt. Thay đổi thời hạn được ghi audit trong cùng transaction với cấu hình. Yêu cầu ngắt có audit riêng. Giá trị không hợp lệ trả HTTP400; thiếu đăng nhập trả HTTP401.

## Cơ chế và phạm vi

- Cấu hình và bản ghi phiên được lưu bền vững trong bảng `system_settings` hiện có, không cần migration/seed. Mỗi phiên gắn connection, site, WLAN, SSID và MAC. Lưu ý định trước khi gọi authorize; các lỗi timeout chưa rõ kết quả vẫn được giữ để xử lý lại.
- UniFi nhận thời hạn native theo phút khi cấp quyền. Backend có worker kiểm tra mỗi chu kỳ 5 giây, thu hồi quyền và kick thiết bị quá hạn, rồi đọc lại trạng thái. Chu kỳ xử lý và thời gian cập nhật AP có thể trễ theo tải/kết nối controller; không cam kết chính xác từng giây khi controller hoặc backend gián đoạn.
- Phiên hết hạn lúc thiết bị offline được giữ chờ để xử lý khi thiết bị xuất hiện lại. Các lần cấp lại do controller mất trạng thái vẫn giữ deadline ban đầu; giới hạn native làm tròn theo phút, còn ledger giữ mốc thời gian gốc.
- Khóa Redis có gia hạn theo connection/site/MAC bảo vệ thao tác cấp và thu hồi. Kiểm tra lại MAC duy nhất và SSID trước khi kick; không kick thiết bị đã chuyển sang SSID khác hoặc thiết bị wired. Khóa mất hiệu lực thì dừng mutation và để worker thử lại.
- Chỉ xử lý WLAN mở, guest, có ownership của ứng dụng. Khi chiến dịch kết thúc và guest policy được gỡ có xác nhận, bản ghi phiên được đánh dấu `released`, không tiếp tục ngắt mạng đã trở lại chế độ truy cập trực tiếp. Khi portal tạm lỗi, giữ các guest flag đang sở hữu của chiến dịch còn hiệu lực và không bật thêm flag mới.
- Giữ luồng chuyển thẳng HTTP302 đến URL đích sau khi UniFi xác nhận cấp quyền. Không sửa PPPoE, bridge, DHCP, VLAN, radio hoặc cấu hình hai SSID dùng mật khẩu.

Heartbeat nội bộ: Redis `campaign-session:status`, gồm `lastRunAt`, `revoked`, `released`, `waiting`, `blocked`, `failed`; không chứa token hoặc thông tin xác thực controller.

## Kiểm chứng

- 134/134 kiểm thử backend và 10/10 kiểm thử trình duyệt đạt. Các ca bổ sung bao gồm reconnect chưa được controller báo authorized, giữ hạn cũ, MAC trùng trong lúc revoke, chuyển sang SSID mật khẩu trước kick, lease loss, timeout, offline retry, cleanup ownership và portal outage.
- Rà soát mã độc lập không còn phát hiện quan trọng trong phạm vi các sửa đổi.
- Build production và TypeScript đạt; hash 10 file runtime trên cả hai container khớp bản đã kiểm tra.
- Qua tên miền production, mở được hộp cấu hình bằng phiên quản trị thật, đọc đúng mặc định 240 phút, không có lỗi JavaScript. PUT với 0 phút bị HTTP400, đọc ẩn danh bị HTTP401. Không lưu thời hạn mới hoặc yêu cầu ngắt thiết bị thật trong bước smoke test.
- Worker session và worker guest policy có heartbeat healthy sau triển khai. Guest settings, WLAN và network trên UniFi không đổi; chỉ tạo lại backend/frontend. Database, Redis, MinIO, controller và entry giữ nguyên container. `.env` chỉ đổi `APP_IMAGE`.
- Chưa quan sát một lượt hết hạn 30/60 phút trên thiết bị WiFi thật với bản này; các kiểm thử deadline/thu hồi dùng controller giả lập. Không dùng kiểm thử trình duyệt để khẳng định AP đã chặn lưu lượng thật.

Snapshot riêng, log build/test và ảnh production nằm tại `.tmp/campaign-sessions-20261029/`.


## Bổ sung miễn xác thực theo MAC

Bản production ngày 29/10/2026 lúc 12:58 (UTC+7) thêm [Thiết bị UniFi miễn xác thực](unifi-device-exemptions-2026-10-29.md). MAC đã duyệt được loại khỏi tác vụ hết hạn/ngắt phiên chiến dịch và tự gia hạn quyền; khi bỏ duyệt sẽ quay lại luồng xác thực bình thường.
