# Sơ đồ mạng và quản lý thiết bị — 30/10/2026

Thời gian báo cáo theo Việt Nam (Asia/Bangkok). Phạm vi: sơ đồ UniFi/MikroTik, quản lý kết nối/thiết bị và menu thao tác chiến dịch.

## Thay đổi giao diện

- UniFi chia các nhánh AP thành nhiều hàng, mặc định 6 AP/hàng; có thể chọn 4 hoặc 8. Mỗi nhánh dành chỗ cho các máy khách khi mở, tránh đè lên hàng kế tiếp. Tên thiết bị giữ thứ tự ổn định, không đổi vị trí theo lưu lượng.
- Máy khách được thu gọn sẵn trong tổng quan; số khách vẫn hiện trên AP. Tìm tên/IP/MAC mở đúng tổ tiên và đưa thiết bị vào vùng nhìn thấy. Xem riêng AP giữ đầy đủ máy khách và nhánh mesh.
- MikroTik chỉ giữ hạ tầng trực tuyến. Bố cục chọn các quan hệ đã quan sát để tạo nhánh hiển thị chính; các quan sát ngược chiều, song song và chéo vẫn còn trong dữ liệu/chi tiết, có nút hiện đầy đủ. Chọn thiết bị hiện thêm quan hệ liên quan và không vẽ lặp cáp ngược chiều ở chế độ gọn. Đây là bố cục hiển thị, không phải phát hiện thêm đường cáp vật lý.
- Line vuông góc bo góc; làn nhận xanh dương, làn gửi xanh ngọc. RX/TX theo interface được đổi từ hợp đồng API cũ đúng một lần. Không tạo lưu lượng khi thiếu mẫu, mẫu bằng 0 hoặc quá hạn.
- Banner nằm trong vùng giám sát. Fullscreen giữ banner, sơ đồ, bảng chi tiết và một nút thoát; ẩn bộ lọc, chú giải, minimap và các nút dưới. Gateway giữ ở giữa bên dưới banner. “Vừa khung” tính cả chiều cao và độ lệch hai bên gateway để chứa hàng AP cuối.
- Bảng thiết bị UniFi có chế độ bảng/thẻ, tìm kiếm và lọc; số khách không cộng trùng. Bảng chi tiết giới hạn theo viewport và giữ quyền thao tác.
- Quản lý MikroTik/kết nối dùng bảng gọn, bộ đếm, lọc vai trò/trạng thái và biểu mẫu có giới hạn cuộn. Giữ cách lưu thông tin xác thực khi để trống. Vai trò router/core/access và model lấy từ cấu hình/quan sát hiện có; không tự gán từ tên thiết bị.
- Menu chiến dịch đo kích thước thực, chọn phía mở, giới hạn theo viewport và cuộn khi cần. Hộp thoại phiên WiFi/Reset luôn có phần nội dung cuộn; Reset dùng portal để tránh tổ tiên có transform. Giữ thao tác bàn phím và trả focus.

## Nguyên nhân và lỗi đã phát hiện

- Bố cục cũ đặt toàn bộ AP vào một hàng. Cụm MikroTik có quan hệ hai chiều bị gộp thành một cột với toàn bộ đường chéo.
- Lấy cố định 97 điểm trên đường dài làm nội suy cắt góc, lệch tới 16,09 px trong ca tái hiện. Bộ lấy mẫu mới phân tích đường M/L/Q/C bằng JavaScript, chia nhỏ đoạn cong và nội suy theo chiều dài, có giới hạn bộ nhớ; không gọi SVG native cho từng điểm trên đường đã sinh.
- Trong kiểm thử tích hợp, phát hiện nhãn stale còn tham chiếu biến đã tách sang helper; đã sửa và kiểm tra lại trước triển khai.
- Tìm kiếm có thể được mở lại khi đóng bảng chi tiết và focus trả về ô tìm kiếm. Xóa truy vấn sau khi chọn kết quả để không che nút “Vừa khung”.
- Cảnh báo nền khi build: Browserslist/caniuse-lite cũ. Không đổi dependency trong đợt sửa này.

## Kiểm chứng mã

- 109 unit test liên quan đạt; kiểm tra TypeScript có `--incremental false` đạt.
- Ca dữ liệu 36/60 AP, 120 máy khách: số hàng/cột, không chồng thẻ, mở/đóng nhánh, AP scope, tìm máy khách ẩn, giữ zoom khi cập nhật và vừa khung chứa cả hàng cuối.
- Ca MikroTik: chu trình, liên kết đảo chiều, 976 máy khách trộn trong nguồn, chỉ giữ hạ tầng online, thêm thiết bị và phục hồi offline/online.
- Kiểm thử trình duyệt tại 1366×768 và 1920×1080; fullscreen native/fallback, resize, banner, chọn thiết bị/liên kết, RX-only đúng màu, dừng chuyển động, dữ liệu cũ/thiếu/0, API gián đoạn/khôi phục và xuất PNG.
- Menu chiến dịch kiểm tra màn hình thấp/landscape, resize/scroll, bàn phím và các hộp thoại; các thao tác ghi trong kiểm thử đều dùng API giả lập.

## Gói phát hành

Gói overlay chỉ chứa 19 tệp runtime cần sửa, dựng trên image frontend đang chạy; không đóng gói toàn bộ các thay đổi khác trong workspace. Manifest và log nằm trong `.tmp/network-operations-20261030/`.

Ảnh trước/sau và ảnh bộ dữ liệu 60 AP được lưu cùng thư mục trên. Dữ liệu thực trước/sau được đọc ở hai thời điểm; các ca giả lập dùng cùng dữ liệu cố định để so sánh bố cục.

Rollback frontend: đặt `APP_IMAGE=wifimarketing:before-operational-layout-20261030` trong `.env`, sau đó chạy `docker compose up -d --no-build --no-deps --force-recreate frontend`.

## Kết quả triển khai production

- Đã cập nhật frontend lúc 30/10/2026 00:49:50 (giờ Việt Nam) trên `solutionai.com.vn`. Image: `wifimarketing:operational-layout-20261030`; ID: `sha256:3fa32d6fc8a25097d468f32ee3abb5eefae4e307282b319b19b0852e13618286`.
- 19 tệp runtime trong container khớp manifest; chỉ container frontend được tạo lại. Bảy container còn lại, gồm backend, database, UniFi và hotspot entry, giữ nguyên ID. `.env` chỉ đổi `APP_IMAGE`. Không migration và không thay đổi cấu hình thiết bị/chiến dịch.
- Kiểm tra công khai có xác thực: UniFi 37 nút (gateway + 36 AP), 6 hàng AP, 36 uplink; MikroTik 5 thiết bị online, 4 đường chính. Gateway `192.168.0.1`; banner, bảng chi tiết thiết bị/liên kết và nút thoát fullscreen hoạt động. Menu chiến dịch trong viewport 1366×768; trang thiết bị UniFi, MikroTik và kết nối tải được. Không lỗi JavaScript/API và không yêu cầu ghi trong smoke test.
- 55 ca Playwright liên quan đã đạt qua các lần chạy cuối: 48 ca ngoài bộ traffic và 7 ca traffic. Lần chạy gộp ban đầu có 1 lỗi bộ đo hình học trong test (tham chiếu màu stale và gọi SVG quá nhiều); đã sửa oracle sang `Path2D` theo từng frame rồi chạy lại toàn bộ 7 ca traffic trên đúng image, bao gồm hover/chọn line quá hạn.
- Production build và kiểm tra TypeScript không dùng incremental đạt; 109 unit test đạt. Các cảnh báo Browserslist nêu trên không chặn build.
- Ảnh thực tế sau triển khai: [UniFi fullscreen](../.tmp/network-operations-20261030/production-unifi-fullscreen.png), [MikroTik fullscreen](../.tmp/network-operations-20261030/production-mikrotik-fullscreen.png), [menu chiến dịch](../.tmp/network-operations-20261030/production-campaign-menu.png). Ảnh thông tin liên kết có hậu tố `-link-info.png`.
- Đã dừng preview/dev server của đợt sửa và xóa tệp phiên/token, env tạm sau kiểm tra.
