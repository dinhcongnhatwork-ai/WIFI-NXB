# Line kết nối và thẻ giám sát gọn — 30/10/2026

## Phạm vi

Chỉ sửa các thành phần sơ đồ dùng chung của UniFi và MikroTik. Không thay đổi API, cấu hình RouterOS/UniFi, cơ sở dữ liệu hoặc chiến dịch.

## Nguyên nhân và bản sửa

1. Các node được điều khiển từ React được tạo lại khi số liệu hoặc đồng hồ cập nhật. React Flow xóa thông tin đầu nối nếu node mới không có `measured` hoặc `handles`; thẻ không đổi kích thước nên ResizeObserver không đo lại. Hệ quả là các thẻ vẫn hiện nhưng toàn bộ edge không render. Kiểm thử đã tái hiện 60 đường nối về 0 khi mẫu lưu lượng chuyển từ 0 sang thiếu. Bản sửa khai báo `handles` cố định theo kích thước và hướng thẻ, không phụ thuộc đo DOM sau mỗi cập nhật số liệu. Có unit test gọi chính `adoptUserNodes`/`getEdgePosition` và ca Playwright kiểm tra cập nhật số liệu, đổi scope, fullscreen.
2. Phép offset làn RX/TX ở góc gần quay ngược có thể chia cho 0 và tạo `NaN`/`Infinity`. Bản sửa loại điểm gần trùng/thẳng hàng theo sai số nhỏ, giới hạn phép nối góc và làm sạch các điểm trước khi bo góc. Hai ca hồi quy hình học đã được kiểm tra thất bại trước, đạt sau khi sửa.
3. Đường xuống các hàng dưới trước đây chỉ dùng bus bên trái. Bố cục mới chia các AP ở nửa trái/phải của mỗi hàng qua hai bus ngoài tương ứng. Đây là tuyến vẽ của cùng các liên kết được quan sát, không tạo thêm uplink hay giả định kết nối dự phòng vật lý.
4. Tách đường nền SVG luôn hiện khỏi chuyển động lưu lượng. Khi số liệu thiếu/0/quá hạn, chuyển động dừng theo nguồn; đường nền vẫn hiển thị. Tăng độ rõ đường offline, giữ nét đứt cho quan hệ logic.

## Kích thước

- Thẻ hạ tầng/AP: 260×148 px, trước 300×174 px.
- Thẻ máy khách: 176×132 px, biểu tượng 36 px; hình gần vuông, giữ tên/IP/trạng thái/RX-TX.
- Bố trí, endpoint và camera dùng chung `node-dimensions.ts`; hàng nhánh dự trữ đúng kích thước client mới.
- Tọa độ handle CSS khớp kích thước thẻ và viền. Handle chỉ dùng để hiển thị, không chặn nút mở/đóng nhánh khi thu nhỏ.

## Kiểm chứng

Log/ảnh/manifest nằm trong `.tmp/topology-compact-20261030/`. Kiểm thử dùng cùng bộ dữ liệu 60 AP/120 client ở 1366×768 và 1920×1080, đổi 4/6/8 cột, mở toàn bộ client, cập nhật mẫu, AP scope, fullscreen và xuất PNG.

Rollback frontend: `APP_IMAGE=wifimarketing:before-compact-topology-20261030`, sau đó `docker compose up -d --no-build --no-deps --force-recreate frontend`.


## Kết quả trước production

- 109/109 unit test liên quan đạt, gồm tái hiện mất handle trong chính React Flow, định tuyến hai bên, hình học RX/TX và kích thước thẻ.
- 48/48 Playwright đạt trên **image phát hành**, gồm 60 AP/120 client ở hai độ phân giải; chuyển 4/6/8 cột, cập nhật mẫu thiếu/0/quá hạn, giữ zoom, fullscreen native/fallback, bảng thông tin và xuất PNG.
- Typecheck không dùng incremental cache đạt; Docker production build đạt. Manifest của 9 tệp runtime khớp image đã kiểm tra.
- Kiểm tra đọc dữ liệu mạng thật trên bản thử: 14 mẫu qua nhiều chu kỳ, không có line mất/toạ độ lỗi, lỗi JavaScript hoặc yêu cầu ghi API.
- Lần chạy trên dev trước đó có 2 lỗi: điều hướng khi Next đang biên dịch và giả định zoom ban đầu phải khác 100%. Thẻ gọn cho phép fleet vừa ở 100%; cập nhật kiểm tra đúng hành vi giữ zoom. Cả hai ca đều đạt khi chạy lại trên image production. Không coi lần dev đó là bộ kiểm thử đạt toàn bộ.

## Phát hành

- Frontend được cập nhật lúc **18:25:06 UTC 29/10/2026** (01:25:06 ngày 30/10 giờ Việt Nam).
- Image: `wifimarketing:compact-topology-20261030`.
- Image ID: `sha256:11333f6dd58183f53db97968a95d2aeec144a0abf5cf77f957b6e6bec353db5d`.
- Chỉ recreate frontend với `--no-build --no-deps`; 7 container production còn lại giữ nguyên ID. Không đổi database, cấu hình router/switch hoặc API backend.
- Kiểm tra trực tiếp `solutionai.com.vn` sau cập nhật: UniFi có 36 edge khi thu nhánh, 37 sau mở một client; MikroTik có 4 edge chính. Không có edge lỗi ở các lần đổi cột, vào/thoát fullscreen; mở bảng chi tiết gateway `192.168.0.1` trong fullscreen đạt. Không có lỗi JavaScript, HTTP API hoặc yêu cầu ghi trong lần kiểm tra.

Ảnh chụp kiểm chứng: [UniFi fullscreen](../.tmp/topology-compact-20261030/production-unifi-fullscreen.png), [MikroTik fullscreen](../.tmp/topology-compact-20261030/banner-diagnostic-mikrotik-fullscreen.png). Log `live-production.log`, `browser-candidate.log`, `unit-release.log`, `build-final.log` và manifest lưu cùng thư mục.

Kiểm tra production bổ sung: 14 mẫu mỗi 5 giây, 35 giây/provider, không phát hiện mất line hoặc tọa độ lỗi; 0 lỗi JavaScript và 0 yêu cầu ghi. Kiểm tra riêng trang MikroTik xác nhận ảnh banner đã tải đủ 2172 px, hiển thị ở giữa và gateway nằm bên dưới. Ảnh MikroTik dùng lần chụp riêng này; lần chụp liên tiếp sau chuyển provider trong Chromium headless không vẽ banner vào ảnh dù DOM báo ảnh đã tải, nên không dùng ảnh đó làm bằng chứng banner.
