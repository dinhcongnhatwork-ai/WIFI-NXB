# Điểm danh họp: rà soát luồng và cải thiện vận hành

## Hiện trạng xác minh chỉ đọc

- API đang chạy trả HTTP 200 cho danh sách điểm danh, 36 AP UniFi và 2 SSID.
- Có 5 buổi họp, đều đã kết thúc; không buổi nào đang liên kết mẫu trực tiếp hoặc chiến dịch.
- Có 2 mẫu. Một mẫu đã xuất bản nhưng chưa sẵn sàng cho điểm danh; mẫu còn lại chưa xuất bản.
- Giao diện cũ ẩn nút sửa trên buổi đã kết thúc và ẩn xóa khi có đại biểu. Vì vậy người vận hành không có đường thao tác mặc dù API quản lý buổi họp đã tồn tại.

## Giao diện và quản lý buổi họp

Danh sách dùng bảng, nhóm theo tháng bắt đầu buổi họp theo giờ Việt Nam. Có bộ lọc tháng/trạng thái, tìm theo tên/địa điểm/SSID và phân trang máy chủ. Mốc tháng được quy đổi từ Asia/Ho_Chi_Minh sang UTC trước truy vấn, kể cả tháng 1 và giao năm. Bộ lọc sai trả 400 thay vì lỗi Prisma.

Thao tác xem, sửa, Excel, bắt đầu/kết thúc và xóa có nhãn rõ, trạng thái đang xử lý và thông báo lỗi. Xóa yêu cầu xác nhận số đại biểu/lịch sử liên quan. API chỉ cho xóa khi buổi họp không còn ACTIVE và khóa cùng hàng với worker/đăng ký/kết thúc.

Buổi đã kết thúc cho sửa mô tả/tên/địa điểm. Mạng, thời gian, ngưỡng và cấu hình điểm danh đã chốt được giữ nguyên. Biểu mẫu giữ nguyên timestamp gốc khi sửa metadata, tránh làm mất giây vì ô datetime-local. Tất cả nút lưu kiểm tra trường bắt buộc trước khi gửi API.

Chọn site sẽ tải đúng danh sách SSID/AP của site đó, giữ tên/lịch/mẫu đang nhập và xóa lựa chọn mạng/AP thuộc site cũ. Không còn tải lại toàn bộ form mỗi lần thay site. Danh sách AP có vùng cuộn, chỉ lấy AP thay vì toàn bộ thiết bị UniFi.

## Liên kết mẫu và quy trình kích hoạt

1. Chọn mẫu trực tiếp hoặc kế thừa mẫu từ chiến dịch.
2. Từ form, mở đúng CMS `?screen=attendance_gate` trong tab riêng để giữ nội dung buổi họp đang nhập.
3. Bật màn hình điểm danh và xuất bản. Endpoint lựa chọn mẫu chỉ trả metadata và cờ sẵn sàng, không gửi JSON bản xuất bản xuống form.
4. Khi quay lại form, trạng thái sẵn sàng được cập nhật. Mẫu V2 phải có controller bật và khối chức năng nhìn thấy trên cả Mobile, Tablet, PC. Kiểm tra cũng phát hiện section điểm danh bị ẩn.
5. Chọn SSID, site, AP, lịch; lưu nháp/sẵn sàng hoặc kích hoạt. Nếu có chiến dịch, mạng của buổi họp phải khớp chiến dịch.
6. Đại biểu vào đúng WiFi, hoàn tất biểu mẫu và đi qua quy trình cấp quyền Hotspot hiện có. Bộ kiểm thử portal tiếp tục kiểm tra token, MAC, luồng bắt buộc và xác nhận cấp quyền UniFi.

Dữ liệu cũ chưa gán mẫu không được tự ý đổi hoặc xuất bản. Các buổi cũ đã kết thúc được giữ là hồ sơ lịch sử; buổi mới cần chọn mẫu sẵn sàng trước khi kích hoạt.

## Theo dõi UniFi

- Worker backend có nhịp mục tiêu 3 giây, không chồng chu kỳ. Các lời gọi đồng thời trong cùng module dùng chung một chu kỳ đang chạy. Mỗi site lấy một snapshot client/AP cho một chu kỳ; client HTTP dùng no-store.
- Khi một snapshot hợp lệ xác nhận không còn thiết bị trên SSID/AP của buổi họp, trạng thái đổi sang Mất kết nối ngay từ lần quan sát đó, thay cho giữ PRESENT tối thiểu 25 giây. Chỉ đăng ký mới chưa có AP xác nhận được chờ lan truyền cấp quyền tối đa 6 giây.
- Độ trễ phát hiện thật vẫn phụ thuộc AP/Controller nhận ra mất kết nối. Chu kỳ 3 giây không phải cam kết nhận biết vị trí vật lý tức thì. Tắt WiFi hoặc đổi sang AP ngoài phạm vi cũng được coi là mất kết nối của buổi họp.
- Controller/AP lỗi hoặc thiếu dữ liệu để xác nhận AP/SSID chuyển sang Chưa xác định, không gán thành vắng. Các khoảng PRESENT/ABSENT/UNKNOWN được lưu riêng; thống kê lấy thời gian thực của các khoảng, không cộng cứng 10 giây mỗi vòng và không tính thời gian UNKNOWN là vắng.
- Quay lại đúng AP/SSID mở khoảng hiện diện mới; chuyển AP trong phạm vi vẫn là hiện diện. Cảnh báo dùng đúng ngưỡng phút của buổi họp và giữ lịch sử cảnh báo.
- Worker khóa hàng buổi họp, đọc lại trạng thái trước khi ghi. Nếu END thắng khóa, scan không cập nhật lại hồ sơ đã chốt. Hết giờ theo lịch sẽ tự kết thúc và đóng các khoảng theo dõi tại giờ kết thúc.
- Một buổi lỗi lưu không chặn các buổi còn lại. Redis lỗi không chặn vô hạn việc quét; UI có mốc đồng bộ và cảnh báo dữ liệu quá 15 giây.
- Ghi nhận rời WiFi không thu hồi DHCP, xóa Hotspot session hay gọi MikroTik.

## Truyền dữ liệu và hiệu chỉnh đại biểu

Luồng SSE dùng fetch có Bearer hiện tại, hỗ trợ HTTP/LAN không có secure cookie. GET stream chỉ đọc dữ liệu; không khởi động worker hoặc gọi tick. Redis pub/sub đẩy cập nhật; stream có đọc dự phòng 5 giây. Khi kết nối lỗi, client kết nối lại và đọc GET dự phòng, không POST quét liên tục từ mỗi màn hình. Subscriber/timer được thu hồi khi ngắt kết nối.

Người chỉ xem vẫn nhận dữ liệu, không có nút thay đổi hay POST quét. Người vận hành có thể sửa họ tên, xem lịch sử gần nhất và đổi thiết bị có lý do. Đổi MAC kiểm tra trùng trong buổi họp, dùng transaction/khóa hàng, đóng khoảng cũ, ghi lịch sử bằng danh tính tài khoản xác thực và chờ Controller xác nhận MAC mới. Buổi đã chốt không đổi thiết bị.

## Báo cáo

Excel tải qua request xác thực rồi tạo file download, thay liên kết tải trực tiếp phụ thuộc cookie. Giữ 3 sheet, thêm cột thời gian Không xác định, dùng ngưỡng cảnh báo thực tế và nhãn Đồng bộ/Điều chỉnh hệ thống. Mốc ra gần nhất lấy từ khoảng PRESENT đã đóng, không nhầm thời điểm kết thúc khoảng ABSENT/UNKNOWN.

Trang danh sách không còn import ExcelJS vào bundle client. First Load JS trong build giảm từ khoảng 371 kB xuống 108 kB; đây là số liệu bundle, không phải phép đo thời gian tải trên thiết bị thực.

## Xác minh

- 115 kiểm thử logic trong 12 suite đạt, gồm trạng thái, monitor, tranh chấp đăng ký/kết thúc, CRUD/khóa dữ liệu đã chốt, sửa thiết bị, SSE chỉ đọc, lọc tháng và báo cáo; kèm hồi quy Hotspot/portal.
- 8 kiểm thử trình duyệt dev đạt: CRUD, lọc/tìm kiếm, giữ form khi đổi site, cập nhật trực tiếp/liên kết mẫu, hiệu chỉnh đại biểu, quyền chỉ xem, Excel và xem trước attendance/video.
- 25/25 kiểm thử trình duyệt đạt lại trên bản production đóng gói, múi giờ Asia/Ho_Chi_Minh, gồm 8 kiểm tra trên và 17 hồi quy CMS.
- Build production đạt. Kiểm tra TypeScript đạt.
- Trên bản build cục bộ, dùng API thật chỉ đọc: lọc tháng 09/2026 trả 5 buổi và metadata phân trang; tháng sai trả 400; đọc chi tiết trả đúng hồ sơ; tải Excel trả 200/10.426 byte; stream trả 200 và frame attendance_update.
- Ảnh giao diện: `.tmp/attendance-review-list.png`, `.tmp/attendance-review-live.png`.
- Không chạy migration/seed; không tạo, sửa, xóa buổi họp thật, không xuất bản mẫu hoặc thay cấu hình Controller/router. Chưa triển khai bản sửa lên dịch vụ đang chạy, chưa thử đi ra khỏi vùng WiFi bằng điện thoại thật.

Tham chiếu tích hợp: [External Hotspot API — Ubiquiti](https://help.ui.com/hc/en-us/articles/31228198640023-External-Hotspot-API-for-Authorization-Clients), [Official UniFi API — Ubiquiti](https://help.ui.com/hc/en-us/articles/30076656117655-Getting-Started-with-the-Official-UniFi-API). Ứng dụng tiếp tục dùng adapter tương thích với cấu hình Controller hiện có; không giả định có sự kiện push upstream nếu Controller chưa cung cấp.

Đã dừng hai server kiểm tra cục bộ và bỏ các đường dẫn type tạm do Next.js tự thêm. Bản build kiểm tra giữ trong `.tmp/attendance-review-build/` để có thể xem lại.
