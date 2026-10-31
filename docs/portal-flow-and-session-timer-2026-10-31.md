# Luồng xác thực và timer phiên UniFi — 31/10/2026

Đã triển khai lúc **12:33 giờ Việt Nam**, image `wifimarketing:portal-flow-timer-20261031`, ID `sha256:d5b97e7cc8ef08931c3b380540a878d51660b81f05c3be959f4c726d276cac99`.

## Lỗi được sửa

Bản trước gọi đọc lại quyền tối đa tám lần trong cùng HTTP request. Mỗi lần còn đọc controller và SSH vào AP, nên request có thể kéo dài nhiều giây rồi báo lỗi dù lệnh cấp quyền đã được UniFi nhận. Khi quá trình xác nhận thất bại, sổ phiên vẫn `pending`; tác vụ hết hạn trước đây có thể thu hồi ngay phiên này. Đây là hai lỗi phối hợp có thể tái hiện bằng test.

Bản mới chỉ kiểm tra xác nhận một lần trong mỗi request. Nếu UniFi đã nhận hoặc kết quả lệnh chưa rõ vì timeout, lưu ý định bền vững với cửa sổ xác nhận tối đa 45 giây và trả trang chờ HTTP 202. Trang tự kiểm tra tiếp, không yêu cầu bấm lại; các request sau tiếp tục cùng lần cấp quyền, không gửi lệnh mới và không kéo dài thời hạn. Sau khi có bằng chứng quyền truy cập, HTTP 302 trực tiếp tới URL chiến dịch.

Tác vụ hết hạn không thu hồi một phiên đang trong cửa sổ xác nhận. Nếu trình duyệt đóng trước khi ghi nhận thành công, tác vụ đối chiếu quyền thực tế và hoàn tất sổ phiên khi quyền đã mở; nếu không mở được, tác vụ vẫn thu hồi ý định không chắc chắn sau thời gian chờ. Reset cưỡng bức và yêu cầu ngắt phiên với `expiresAt=0` bỏ qua cửa sổ này.

Trang chờ có giới hạn thời gian và số lượt. Lỗi controller thực sự có trang khôi phục với nút thử lại, thay vì JSON lỗi hoặc tự quay vòng về mẫu. Cấp quyền bị từ chối vẫn được phân biệt với đang chờ; chưa xác nhận quyền thì không chuyển tới URL thành công. POST login báo `pending`/HTTP 202 khi đang cấp quyền. Lỗi chữ ký, ownership, sai SSID/AP/WLAN và gate chưa hoàn tất vẫn bị chặn.

Phiên đã active được xác minh từ controller theo đúng MAC/AP/SSID/WLAN, giảm đọc SSH lặp lại. Sau một lần cấp quyền mới, vẫn yêu cầu đọc xác nhận trên AP khi có thể. Không dùng riêng ACK của lệnh native hoặc DHCP để báo kết nối thành công.

## Timer và menu ba chấm

- **Thời hạn phiên WiFi** lưu từ 1 đến 1440 phút; preset 30 phút/1 giờ tương ứng 30/60 phút trong lệnh native UniFi. Thời hạn tính theo lần cấp quyền và bị giới hạn bởi thời điểm kết thúc chiến dịch.
- Lưu thời hạn áp dụng cho lần đăng nhập tiếp theo. Ô **Ngắt các phiên hiện tại để áp dụng ngay** gửi yêu cầu riêng, chỉ đưa các phiên thông thường của đúng chiến dịch vào hàng đợi yêu cầu đăng nhập lại.
- Phiên đang active hoặc pending xác nhận không được gia hạn khi bấm lại/reconnect. Hết hạn thì thu hồi native grant, dọn cache MAC và kick khi thiết bị vẫn ở WLAN chiến dịch.
- Dọn cache ưu tiên AP đang giữ thiết bị, kể cả thiết bị đã roaming từ AP lúc đăng nhập. Lượt đầu xử lý AP này; các AP khác được lưu để xử lý tiếp, tối đa ba AP mỗi lần. Một AP lỗi không ngăn hoàn tất các thao tác đã bắt đầu trên AP khác; lỗi giữ nguyên trong danh sách chờ.
- Tác vụ ưu tiên phiên cần thu hồi trước việc bảo trì cache của phiên đã thu hồi, giới hạn bảo trì ba phiên mỗi tick. Không chờ dọn mọi AP trước khi ngắt thiết bị hiện tại.
- Thiết bị miễn xác thực giữ chính sách riêng. Reset WiFi cưỡng bức vẫn yêu cầu cả MAC miễn xác thực bấm kết nối lại như trước. Dialog đã nêu rõ ngoại lệ này.

Đối chiếu production trước triển khai: chiến dịch `WIFI MARKETING` đặt **240 phút**, bốn sổ phiên active và bốn native grant đều có khoảng thời gian **240 phút**. Deadline giữa controller và sổ phiên lệch khoảng 2–3 giây, không phải nhiều phút. Không đổi cấu hình 240 phút hoặc ngắt các thiết bị đang sử dụng để thử nghiệm.

## Kiểm chứng và phạm vi

- **189/189** test logic trong 20 suite đạt, gồm 30/60 phút, quyền quản trị, xác nhận chậm qua nhiều request, không gửi lại lệnh/không kéo dài timer, khởi động lại và khôi phục xác nhận, Reset bỏ qua thời gian chờ, roaming và AP lỗi.
- Build production và typecheck đạt. **11/11** test trình duyệt đạt trên bản production: bấm một lần, cấp quyền chậm rồi tự chuyển hướng, chuyển hướng khi tắt JavaScript, chờ có giới hạn, lưu timer ở menu ba chấm, chỉ chọn đúng chiến dịch và báo reset một phần.
- Domain production: phiên đã active trả HTTP 302 tới `https://www.nxbctqg.org.vn/` trong **569 ms**; không thay deadline. Thời gian xử lý nội bộ được log là 382 ms. Request thiếu phiên ký vẫn HTTP 403.
- Trình duyệt qua domain thật: mẫu hiện, một nút kết nối, không gate phụ, không lỗi JavaScript. Hotspot/session/exemption worker healthy. Worker có thêm số đếm `authorizing`; log connect có `pending`/`authorized`/`unavailable` và thời gian, không ghi token hoặc MAC.
- Mười file nguồn thay đổi khớp hash với container production. Chỉ tạo lại backend/frontend; `.env` chỉ đổi `APP_IMAGE`. WLAN và guest portal UniFi giữ nguyên cấu hình. Không thay PPPoE/interface/bridge/DHCP/MikroTik, không migration/seed hoặc reboot AP.

**Giới hạn:** 569 ms là phép đo trên phiên đã active. Luồng cấp quyền chậm và timer 30/60 phút đã được kiểm tra bằng mô phỏng có kiểm soát; chưa có xác nhận từ một lượt xác thực mới hoặc chờ hết hạn trên điện thoại thật sau bản cập nhật này. Đã yêu cầu người dùng thử lại; không dùng phép đo phiên active làm thời gian cấp quyền mới.

Image quay lui: `wifimarketing:portal-auth-ap-20261031`. Log và snapshot riêng ở `.tmp/portal-flow-20261031/`, không commit dữ liệu vận hành này.
