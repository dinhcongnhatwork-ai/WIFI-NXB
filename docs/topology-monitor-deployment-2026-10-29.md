# Sơ đồ giám sát — triển khai ngày 29/10/2026

Đã cập nhật frontend/backend trên `https://solutionai.com.vn` lúc khoảng **13:53, UTC+7**. Image: `wifimarketing:topology-monitor-20261029`, ID `sha256:331b2fd3fb239392d5dd951c2fce2a89fd172fed7c7ad9e42422f566ab4a4a36`.

## Giao diện

- Banner gốc `public/device-icons/Banner Monitor.png` nằm **trong khung canvas**, phía trên vùng cây, cho cả UniFi và MikroTik. Giữ nguyên tỷ lệ hình; không vẽ đè lên thẻ thiết bị. Danh sách không có banner phủ các hàng.
- Fullscreen chỉ giữ khung sơ đồ, banner, chú giải và các nút điều khiển nhỏ. Ẩn tiêu đề, thống kê, tìm kiếm, bộ lọc và bảng chi tiết. Hỗ trợ Fullscreen API, chế độ dự phòng, Escape và khôi phục focus sau khi hiện lại tiêu đề.
- Thay hạt có quầng sáng bằng vệt line xanh dương/xanh lá trên một canvas chung, tối đa 3 vệt mỗi chiều trên mỗi liên kết. Dừng khi pause, giảm chuyển động, tab ẩn hoặc mẫu quá hạn. Với liên kết được RouterOS xác nhận theo interface: RX chạy về nguồn interface, TX chạy ra thiết bị bên kia. Không biến lưu lượng interface thành Download/Upload của người dùng.
- Banner nằm trong vùng xuất PNG; API và phân quyền hiện có được giữ.

## MikroTik chỉ hạ tầng online

Đã đưa bản sửa local trước đó lên production: chỉ các thiết bị MikroTik online xuất hiện trong cây, danh sách và tìm kiếm. Không thu thập ARP, DHCP, bảng MAC bridge, hotspot active hoặc UniFi cho sơ đồ MikroTik. Cổng nằm trong chi tiết; đường nối giữ tên cổng và bằng chứng. Chỉ cập nhật mỗi 15 giây, bỏ lượt thu thập fleet trùng mỗi 5 giây.

Số liệu kiểm tra thật, cùng fleet đã lưu:

| | Trước | Sau |
| --- | ---: | ---: |
| Phần tử | 1.161 | 5 |
| Máy khách | 984 | 0 |
| Dung lượng JSON | 1.120.472 byte | 62.178 byte |
| Thời gian của lượt kiểm tra | 9.825 ms | 478 ms |

Đây là các lần đo đơn lẻ, không phải benchmark tải hoặc cam kết độ trễ. Cả 5 thiết bị sau cập nhật được xác nhận online; số lượng không được tạo cứng theo yêu cầu 7 thiết bị.

## Gateway 192.168.0.1

Đọc RouterOS xác nhận bridge có địa chỉ `192.168.0.1` và MAC trùng gateway mà các AP online báo. Nguồn UniFi vẫn có AP/network config cũ ghi `192.168.1.1`; không thay cấu hình AP/controller trong đợt này.

Sửa adapter để ưu tiên danh tính gateway từ AP online, bỏ IP dự phòng `192.168.1.1`, rồi đối chiếu MAC với IP interface của MikroTik online đã lưu. Nếu đối chiếu được, hiển thị IP bridge thật, giữ IP controller cũ và nguồn đối chiếu trong metadata. MAC/IP mâu thuẫn không được ghép tùy ý. Cache metadata địa chỉ 60 giây để không đọc fleet trên mỗi lượt traffic UniFi. Thẻ MikroTik ưu tiên địa chỉ bridge hợp lệ thay vì địa chỉ WAN đứng đầu danh sách.

Không sửa route, gateway, IP, bridge, DHCP hoặc WiFi trên thiết bị.

## Kiểm chứng và bảo toàn

- 68 unit test liên quan đạt; typecheck và Docker production build đạt.
- 21 trường hợp trình duyệt trên image đóng gói đạt: banner trong canvas, fullscreen native/dự phòng, khôi phục focus, hướng line RX/TX, pause/reduced motion, dữ liệu thiếu/0/quá hạn/mất API, xuất PNG, thêm thiết bị và lọc online với fixture 976 máy khách.
- Kiểm tra có đăng nhập với dữ liệu thật ở bản chạy thử và domain production: banner và sơ đồ cùng hiện trong fullscreen; gateway `192.168.0.1` có nguồn RouterOS; không lỗi JavaScript/API, không request ghi trong lượt kiểm tra, không có lượt traffic riêng của MikroTik.
- 14 tệp runtime/tài nguyên ở cả hai container production khớp SHA256 workspace. Image được dựng bằng cách phủ đúng các tệp sơ đồ lên image production trước đó; không đóng gói các thay đổi phân hệ khác trong workspace.
- Chỉ tái tạo backend/frontend. Database, Redis, MinIO, HTTP entry, UniFi application/database giữ nguyên ID và thời điểm khởi động. Không migration/seed. Hai worker miễn xác thực/phiên chiến dịch báo healthy sau chuyển.
- `.env` chỉ đổi `APP_IMAGE`. Container chạy thử và các tệp token/môi trường tạm đã được dọn.

Ảnh, manifest, báo cáo API và log: `.tmp/topology-monitor-20261029/`. Ảnh dữ liệu thật: `production-unifi-fullscreen.png`, `production-mikrotik-fullscreen.png`. Các ảnh dùng tên Root/Child là fixture kiểm thử, không phải sơ đồ thiết bị thật.

Rollback: đặt `APP_IMAGE=wifimarketing:before-topology-monitor-20261029`, chạy `docker compose up -d --no-build --no-deps --force-recreate backend frontend`. Không phục hồi database hoặc cấu hình thiết bị.

## Hiệu chỉnh banner và gateway lúc 14:23, UTC+7

Đã cập nhật riêng frontend bằng image `wifimarketing:banner-anchor-20261029`, ID `sha256:688e47b05a31c1fa4116ef195f65b603c928c27f4dae5c582755faf414d91c6d`. Backend tiếp tục chạy image của đợt triển khai phía trên; không tái tạo backend hoặc các dịch vụ hạ tầng.

Bỏ khung trắng rộng cố định quanh banner. Khung mới ôm sát tỷ lệ ảnh 3:1, nền trong, không border/padding và cố định giữa canvas. Vùng cây nằm riêng bên dưới và bị cắt theo biên vùng cây, không vẽ đè vào banner.

Lỗi gateway bị khuất đến từ `fitView` căn giữa toàn bộ cây khi cây lớn hơn vùng nhìn ở mức zoom tối thiểu. Sau phép fit, tọa độ được căn theo gateway thực để gateway nằm dưới tâm banner. Áp dụng khi mở scope, bấm Vừa khung, về 100%, thay đổi kích thước canvas và vào/thoát fullscreen; không thay đổi mức zoom trong thao tác đổi kích thước. Các mẫu lưu lượng mới không kích hoạt việc tính lại vị trí.

Kiểm chứng: 15 unit test liên quan, 15 Playwright trên image đóng gói, typecheck và production build đạt. Kiểm thử gồm cây lớn 111 máy khách và hai độ phân giải 1366×768, 1920×1080. Kiểm tra dữ liệu thật ở bản chạy thử và `solutionai.com.vn` xác nhận banner không thừa chiều rộng, nằm chính giữa; gateway UniFi có khoảng cách 40 px dưới banner trong chế độ thường/100%/Vừa khung/fullscreen/thoát fullscreen. Không lỗi JavaScript, API hoặc request ghi trong phép kiểm tra. Bốn tệp runtime frontend khớp hash nguồn đã kiểm chứng; mọi container ngoài frontend giữ nguyên ID và thời điểm khởi động.

Ảnh và log: `.tmp/banner-anchor-20261029/production-unifi.png`, `production-unifi-fullscreen.png`, `production-mikrotik-fullscreen.png`, `production-live.log`, `candidate-browser.log`, `build.log`.

Rollback riêng giao diện: đặt `APP_IMAGE=wifimarketing:before-banner-anchor-20261029` rồi chạy `docker compose up -d --no-build --no-deps --force-recreate frontend`.

## Fullscreen tối giản và bảng thông tin lúc 14:49, UTC+7

Đã cập nhật riêng frontend bằng image `wifimarketing:fullscreen-details-20261029`, ID `sha256:f8f600e2ea390b4fba4de337ad7e15203eb0840e2776a1b4c1083b224d1fa7a5`. Backend và tất cả container hạ tầng giữ nguyên.

Trong fullscreen, ẩn thanh zoom, minimap, chú giải và các nút Vừa khung/tạm dừng phía dưới. Chỉ còn nút thoát biểu tượng 32 px tại góc trên bên phải; Escape tiếp tục thoát fullscreen. Ngoài fullscreen, các điều khiển hiện như cũ.

Bỏ quy tắc ẩn bảng chi tiết khi fullscreen. Chọn thiết bị, máy khách hoặc đường nối mở bảng nổi bên phải, trong chính phần tử fullscreen; không chiếm cột của canvas, không thay đổi viewport và không che banner. Bảng có giới hạn theo chiều cao màn hình và cuộn nội dung. X đóng bảng thông tin mà không thoát fullscreen; các tab Tổng quan/Kết nối/Lưu lượng/Liên quan vẫn sử dụng được. Bảng đã mở trước khi vào fullscreen được giữ lại.

Kiểm chứng: 19 Playwright trên bản đóng gói, 15 unit test liên quan, typecheck và production build đạt. Bao gồm native/dự phòng, 1366×768 và 1920×1080, chọn trước/sau fullscreen, mở thông tin thiết bị và liên kết, đổi tab, khôi phục điều khiển khi thoát. Kiểm tra dữ liệu thật ở bản chạy thử và `solutionai.com.vn` xác nhận cả hai nhà cung cấp mở được chi tiết; có kiểm tra thêm máy khách WiFi thực tế, không lỗi JavaScript/API và không request ghi. Viewport trước/sau mở/đóng bảng chi tiết giống nhau.

Hai tệp runtime frontend khớp SHA256 nguồn đã kiểm tra. Bản build xác minh lại dùng cùng image config digest với bản được kiểm thử (khác manifest chứng thực); không có thay đổi ứng dụng giữa hai bản. Chỉ `.env APP_IMAGE` đổi; không đổi database hoặc cấu hình thiết bị.

Ảnh và log: `.tmp/fullscreen-details-20261029/production-unifi-client.png`, `production-unifi-link.png`, `production-mikrotik-device.png`, `production-mikrotik-link.png`, `production-live.log`, `candidate-browser.log`, `build-verified.log`.

Rollback riêng frontend: đặt `APP_IMAGE=wifimarketing:before-fullscreen-details-20261029`, chạy `docker compose up -d --no-build --no-deps --force-recreate frontend`.
