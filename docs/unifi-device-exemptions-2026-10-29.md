# Thiết bị UniFi miễn xác thực WiFi

## Sử dụng

Mở **UniFi → Thiết bị miễn xác thực**, chọn controller/site đang quản lý portal.

- **Thêm thiết bị:** nhập tên người dùng, tên/loại thiết bị và MAC WiFi, bấm **Lưu và miễn xác thực**.
- **Nhập danh sách:** mỗi dòng gồm `Tên;Thiết bị;MAC`, hoặc dán ba cột từ Excel. CSV có dấu ngoặc kép được hỗ trợ. Tối đa 100 dòng/lần; MAC trùng hoặc dòng sai làm từ chối toàn bộ lần nhập.
- **Chỉnh sửa:** thay đổi thông tin hoặc trạng thái miễn xác thực. MAC là định danh cố định; muốn đổi MAC thì thêm máy mới và xóa bản ghi cũ.
- **Tắt/Xóa:** thu hồi ngoại lệ, thiết bị quay lại luồng portal chiến dịch. Khi thiết bị đang kết nối trên WiFi chiến dịch được quản lý, tác vụ nền thu hồi quyền và ngắt thiết bị để yêu cầu đăng nhập lại.

Nhập MAC thực tế thiết bị sử dụng trên SSID, bao gồm MAC riêng tư nếu thiết bị đang sử dụng. Bản ghi chỉ được duyệt bởi quản trị viên; tài khoản vận hành/chỉ xem được đọc danh sách. Danh sách lưu theo controller/site, dùng chung cho các WiFi chiến dịch được hệ thống quản lý trong site đó. Không có bản ghi mẫu nào được duyệt tự động.

## Luồng vận hành

1. Lưu phê duyệt vào PostgreSQL `SystemSetting`, cùng nhật ký kiểm toán trong một giao dịch. Chuẩn hóa MAC dạng `aa:bb:cc:dd:ee:ff`, chặn MAC nhóm/toàn số 0 và kiểm tra tên.
2. Backend kiểm tra kết nối khoảng mỗi 3 giây. Chỉ thiết bị duy nhất, không dây, MAC/AP/SSID khớp, trên WLAN mở đang thuộc chiến dịch hiệu lực và được hệ thống sở hữu mới được cấp quyền.
3. UniFi cấp quyền bằng API `authorize-guest`, không sửa SSID hay bật bộ lọc MAC. Cửa sổ quyền native 1.440 phút được gia hạn khi thiết bị trực tuyến và còn được duyệt; tác vụ không gọi cấp quyền lặp lại cho phiên hợp lệ. Quyền native của UniFi áp dụng theo site/MAC, không phải riêng từng WLAN.
4. Nếu cửa sổ captive portal mở trước khi tác vụ nền kịp nhận diện, API portal kiểm tra kết nối thực tế và phê duyệt dưới cùng khóa MAC, cấp quyền rồi chuyển thẳng đến URL chiến dịch. Không hiển thị mẫu hoặc yêu cầu bấm kết nối đối với thiết bị được duyệt. Query `bypass=true` không cấp quyền.
5. Phiên được miễn không bị ngắt bởi chính sách 30/60 phút hoặc thao tác ngắt phiên chiến dịch. Khi bỏ phê duyệt, tác vụ hết hạn khoảng mỗi 5 giây thu hồi quyền, xác minh trạng thái rồi ngắt kết nối trong phạm vi WiFi chiến dịch. Độ trễ còn phụ thuộc controller/AP.
6. Nếu thiết bị chuyển sang WiFi chiến dịch khác, hệ thống đối chiếu lại WLAN hiện tại trước khi thu hồi. Bản ghi ngoại lệ đã được giải phóng khi chiến dịch cũ kết thúc vẫn được theo dõi để thu hồi khi máy xuất hiện trên một WiFi chiến dịch được quản lý. Thiết bị trên mạng có mật khẩu, có dây hoặc ngoài phạm vi được giữ chờ, không bị ngắt bởi tác vụ này.

Các tác vụ cấp/thu hồi và thay đổi danh sách sử dụng chung khóa MAC có gia hạn trong Redis. Ý định cấp quyền được lưu trước lệnh UniFi; lỗi controller/đọc lại được thử lại. Khi backend hoặc controller không hoạt động, việc cấp mới/gia hạn/thu hồi có thể chậm; quyền native đã cấp có hạn 24 giờ. Lần kết nối đầu có thể mất vài giây và hệ điều hành có thể mở cửa sổ captive trước khi quyền cập nhật.

Không thay đổi PPPoE, bridge, DHCP, dải IP, VLAN hoặc cấu hình các SSID. Các thiết bị không có tên trong danh sách tiếp tục xác thực qua chiến dịch bình thường.

## API

Tất cả API quản trị yêu cầu phiên đăng nhập, theo `connectionId` và `siteId` trong query. Chỉ controller mặc định và site cấu hình portal được hỗ trợ.

| Method | Endpoint | Quyền | Chức năng |
| --- | --- | --- | --- |
| GET | `/api/unifi/exempt-devices` | read | Danh sách theo controller/site |
| POST | `/api/unifi/exempt-devices` | admin | Duyệt một/nhiều máy, body `{devices:[{ownerName,deviceName,mac,enabled}]}` |
| PUT | `/api/unifi/exempt-devices/{mac}` | admin | Sửa tên/thiết bị/trạng thái; body cùng các trường của một thiết bị |
| DELETE | `/api/unifi/exempt-devices/{mac}` | admin | Xóa phê duyệt, lên lịch thu hồi quyền qua sổ phiên |

Thông tin người duyệt, thời gian duyệt và controller/site lấy từ phía máy chủ. Người gọi không thể tự gán các giá trị đó. Trạng thái tác vụ nền lưu tại Redis `unifi-exempt:status`; tác vụ thu hồi dùng `campaign-session:status`.

## Kiểm chứng và triển khai

Đã triển khai ngày 29/10/2026 lúc 12:58 (UTC+7), image `wifimarketing:unifi-exempt-20261029`, image ID `sha256:11f3d074f3f31bb836c7cc46d1e6dcdffa5aa4ecbd2a6dba1235d3be3568aab8`.

- 172/172 unit/regression tests qua 16 bộ; 14/14 kiểm tra trình duyệt qua, gồm tạo/sửa/tắt/xóa, nhập nhiều máy, vai trò chỉ đọc, portal bypass, redirect, CMS và chính sách phiên.
- Bản đóng gói production build/typecheck thành công. Hash của 15 tệp runtime trùng mã nguồn đã kiểm tra.
- Kiểm tra có đăng nhập thật trên bản chạy thử và `https://solutionai.com.vn`: trang/hộp thoại thêm thiết bị mở bình thường, không có lỗi JavaScript; GET danh sách trả 200; MAC sai 400; site ngoài phạm vi 400; chưa đăng nhập 401.
- Hai tác vụ `unifi-exempt:status` và `campaign-session:status` báo `healthy`, lỗi 0. Danh sách thực tế vẫn 0 bản ghi, không có MAC mẫu được duyệt.
- Đối chiếu đầy đủ guest settings, 3 WLAN và network UniFi trước–sau: không đổi. Chỉ backend/frontend được tái tạo; HTTP entry, controller, cơ sở dữ liệu, Redis và MinIO giữ nguyên container. Không chạy lệnh sửa MikroTik.
- Rà soát độc lập đã kiểm tra và xác nhận bản sửa thu hồi quyền sau roaming/kết thúc chiến dịch cũ.

Kiểm thử cấp quyền và thu hồi trên thiết bị vật lý vẫn cần MAC thật do người dùng nhập và máy kết nối WiFi. Kiểm thử tự động xác nhận nhánh xử lý API/controller, không thay thế bằng chứng kết nối vật lý.

Rollback ứng dụng: đổi `APP_IMAGE=wifimarketing:before-unifi-exempt-20261029` trong `.env`, chạy `docker compose up -d --no-build --no-deps --force-recreate backend frontend`. Không cần migration. Nếu đã có máy được duyệt và cấp quyền, cần thu hồi miễn xác thực trước khi rollback vì bản cũ không quản lý ngoại lệ này.
