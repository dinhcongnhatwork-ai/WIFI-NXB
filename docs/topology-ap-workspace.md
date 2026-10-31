# Topology theo AP, nhận diện thiết bị và toàn màn hình

Cập nhật 24/10/2026 theo phản hồi cần nhìn rõ thiết bị nào đang nối vào AP nào và đầy đủ thông số.

## Cách sử dụng

Mở `/admin/unifi/topology`. Chế độ mặc định là **thiết bị theo AP**; AP có nhiều máy khách nhất được chọn lúc đầu. Chọn AP khác trong danh sách để xem các máy khách đang được controller gắn với AP đó. Quan hệ lấy từ cạnh quan sát `AP → client`, không ghép theo tên hoặc SSID. Các máy cùng SSID trên hai AP không bị trộn.

Sơ đồ hiển thị trực tiếp mọi máy khách của AP đang chọn, không giấu trong cụm và không cắt ở 30 thiết bị. Thẻ có tên, IP, MAC, SSID, AP đang nối, tín hiệu và tốc độ hai chiều. Kích thước ban đầu ưu tiên đọc tên và thông số; kéo sơ đồ để di chuyển, dùng Vừa khung để xem toàn bộ, hoặc 100% để trở lại kích thước rõ. Chọn **Toàn mạng** để trở lại sơ đồ cây tổng quan; URL `?view=network` mở trực tiếp chế độ đó.

**Danh sách thông số** hiển thị bảng không bị thu nhỏ theo zoom sơ đồ. Tìm theo tên, IP, MAC, SSID hoặc hãng. Bật **Tất cả AP trong site** để xem toàn bộ máy khách cùng cột AP tương ứng trên từng dòng. Bấm tên thiết bị để mở bảng chi tiết.

**Toàn màn hình** mở cả AP selector, sơ đồ/danh sách và bảng chi tiết. Thoát bằng nút Thoát toàn màn hình; nếu trình duyệt không hỗ trợ Fullscreen API, dùng lớp toàn cửa sổ, Escape để đóng. Giữ AP đang chọn, phục hồi focus và thanh cuộn khi thoát.

## Nhận diện và thông số

Tên ưu tiên alias/tên do quản trị đặt, sau đó hostname thực. Nếu không có hostname, dùng model hoặc hãng nếu có và phần cuối MAC để nhận diện; không coi hãng sản xuất là hostname. Giữ nguyên các tên controller báo cáo, không tự đặt tên chủ thiết bị. Icon điện thoại/laptop/AP dùng đúng các PNG người vận hành cung cấp; hỗ trợ nhận dạng iPhone/Android/Windows/macOS và các model Galaxy phone/Book theo thông tin tên rõ ràng.

API Topology bổ sung tên AP từ quan hệ MAC đã quan sát, ngay cả khi controller không gửi `ap_name`. Giữ thêm alias, vendor, OS/model có tên, protocol, noise, RSSI, retry/packet counts, thời gian kết nối, first/last seen, authorized/guest và version/serial của thiết bị hạ tầng. Uptime chỉ dùng duration nguồn, không lấy epoch của `assoc_time` làm uptime. Các cờ authorized/guest không có từ nguồn được giữ ở trạng thái chưa rõ.

Bảng chi tiết gồm tên/hostname, hãng/model/OS, IP/MAC, AP/SSID, uptime, quyền mạng, băng tần/kênh, tín hiệu/noise/SNR, chuẩn WiFi, số gói và retries; AP có firmware, uptime, CPU/RAM và bảng radio/cổng nếu controller cung cấp. Không tạo OS/model hoặc đơn vị PHY khi nguồn chưa có hợp đồng rõ. PHY Mbps chỉ dùng các trường Mbps tường minh; không tự quy đổi legacy `tx_rate`/`rx_rate` khi chưa xác nhận đơn vị và hướng. Dấu `—` nghĩa là chưa có thông số được xác nhận.

Đọc controller để kiểm tra ghi nhận 37 AP / 76 máy khách tại thời điểm khảo sát: 76/76 máy khách có tên AP sau ánh xạ, 60 có hostname thực; controller không cung cấp tên OS trong mẫu này. Số lượng có thể thay đổi theo kết nối thực. Đây là giới hạn dữ liệu nguồn, không bỏ qua thiết bị trên giao diện.

## Lưu lượng

- Xanh: AP → thiết bị / tải xuống; slate: thiết bị → AP / tải lên, theo hợp đồng `downloadBps` / `uploadBps` của backend hiện có.
- Hai nét riêng với mũi tên, stroke giữ độ rõ khi zoom, nhãn tốc độ luôn hiện. Hạt Canvas chạy trên đường riêng của từng chiều, lấy mẫu đường và cache hữu hạn.
- Tổng trên AP selector và thẻ gốc được cộng từ máy khách của AP, không giả là tổng cổng uplink. Thông số AP trong drawer vẫn dùng bộ đếm AP của nguồn.
- Kết nối/nhận diện đọc 15 giây; lưu lượng 5 giây. Chọn mẫu mới nhất giữa topology và feed lưu lượng. Không kéo zoom về ban đầu khi cập nhật tốc độ.
- Mẫu đầu chờ đo, giá trị chưa biết không biến thành 0. Mẫu quá 30 giây giữ số gần nhất, gắn nhãn cũ và dừng hạt; clock riêng vẫn chạy khi cả hai API bị lỗi. Dừng khi tab ẩn hoặc hệ điều hành yêu cầu giảm chuyển động.

## Kiểm chứng và triển khai

Unit: **288 đạt, 7 bỏ qua** do cần DB kiểm thử riêng. Typecheck, kiểm tra bảng màu và whitespace đạt. Kiểm thử UI mới bao gồm chọn đúng AP dù trùng SSID, thẻ đọc được/tên/icon/tốc độ, thông số đầy đủ, bảng toàn site, fullscreen thật và fallback/Escape/focus, giữ zoom, và mất cả hai feed quá 30 giây. Lỗi mẫu cũ tiếp tục chạy đã được tái hiện trước sửa và kiểm tra đạt sau sửa. Rà soát độc lập xác nhận đã xử lý lỗi này.

Ảnh kiểm tra bằng dữ liệu controller: `.tmp/topology-rich/live-ap-diagram.png`, `live-fullscreen.png`, `live-device-table.png`. Khi kiểm tra AP đông nhất, 11 máy khách đều có thẻ và dòng bảng tương ứng. UI kiểm thử dùng fixture xác thực và bản dữ liệu đọc từ controller, không tạo phiên quản trị hoặc sửa thiết bị mạng.

Kết quả build, kiểm thử image và triển khai được cập nhật sau nghiệm thu.
