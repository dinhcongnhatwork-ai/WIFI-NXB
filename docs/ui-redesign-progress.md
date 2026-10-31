# Triển khai kế hoạch ui_redesign_plan.md

Triển khai 23–24/10/2026; nghiệm thu ngày 24/10/2026, múi giờ Asia/Bangkok.

## Quyết định triển khai

- ECharts, chỉ giao diện sáng; UniFi/MikroTik giữ sơ đồ riêng.
- Gom máy khách theo AP mặc định; có lựa chọn SSID.
- Lịch sử máy khách 15 phút trong trình duyệt.
- Dọn màu toàn bộ admin; nội dung portal/CMS do khách hàng thiết kế được giữ nguyên.
- Tiếp tục tại workspace và nhánh tính năng hiện tại để giữ toàn bộ mã chưa commit của người dùng.
- Các thay đổi được giữ tại workspace, không commit/push. Theo yêu cầu vận hành tiếp theo ngày24/10/2026, đã build và thay frontend/backend Docker bằng bản mới.

## Đối chiếu kế hoạch

| Giai đoạn | Kết quả mã nguồn | Nghiệm thu / giới hạn |
|---|---|---|
| P0 khảo sát | Đã đọc UniFi thật: 37 thiết bị, 18 client | Chưa đối chiếu chiều/đơn vị bằng thử tải trên UniFi UI; chưa có kết nối MikroTik |
| P1 design system | Token, font tự host, component UI dùng chung, bỏ override typography !important, dọn màu toàn admin, lint:colors | 0 vi phạm; có ảnh trước/sau đăng nhập và ba cỡ desktop |
| P2 dữ liệu lưu lượng | Delta/direct rate, reset/đổi phiên, Redis 3s/120s, API traffic có nguồn/thời điểm | Test mẫu đầu/reset/cache/phạm vi; sai lệch với UI thiết bị thật cần nghiệm thu riêng |
| P3 topology | Custom node, layout phân tầng, gom AP/SSID, tối đa30 khách mở, toolbar/lọc/tìm/PNG/minimap/khay chưa rõ | Fixture35 client kiểm tra mở cụm; liên kết chỉ có bằng chứng |
| P4 gói tin | Hai làn dữ liệu thật, giới hạn150 cạnh động, pause/hidden/reduced-motion/stale | E2E reduced-motion; benchmark riêng ghi rõ môi trường |
| P5 drawer | Bảng cổng/radio, top khách, traffic/history, dữ liệu gốc thu gọn admin; điểm danh và đối chiếu Hotspot theo MAC | Hotspot đối chiếu bộ đếm phiên riêng, không giả tốc độ khi chưa có mẫu delta |
| P6 Zabbix backend | Batch/summary/top/histogram, ngưỡng trigger, LTTB giữ khoảng thiếu, custom from/to | Bounded24 target/96 series, concurrency4; API avg/max sử dụng dữ liệu gốc/trend đúng nghĩa |
| P7 dashboard | ECharts, lưu lượng/sự cố/khách/phản hồi/khả dụng/CPU/RAM/disk, top sparkline, modal xác nhận, bảng chi tiết/nhật ký | Overview tối đa4 endpoint mỗi chu kỳ, phạm vi biểu đồ giới hạn để giữ tải hữu hạn |
| P8 QA | Unit/TypeScript/Playwright/responsive/video/production build | Kết quả lệnh cuối ghi trong báo cáo kiểm thử phía dưới |

## Các sửa lỗi qua review

- Uplink từ thiết bị con: RX là download; cổng downstream từ cha: TX là download.
- Port chỉ có metadata không được che mất counter thật ở nguồn khác.
- Interface chưa xác định WAN/LAN giữ góc nhìn TX/RX, không giả chiều người dùng.
- SLA trend dùng số mẫu để ước tính độ phủ; thiếu mẫu không tính thành hoạt động cả giờ. Long-range p95 được ghi là p95 trung bình giờ, max dùng value_max.
- Custom range có end-aware cache/history và không lẫn sự cố phát sinh sau thời điểm kết thúc; trạng thái xác nhận/phục hồi ghi rõ là trạng thái hiện tại.
- Drawer chỉ gửi một request sau effect replay, hủy request khi đổi phạm vi; Hotspot không hiển thị chờ đo tốc độ vô hạn.
- Tooltip chart dùng richText để tên từ nguồn thiết bị không trở thành HTML.

## Baseline

Ban đầu:217 unit đạt,1 lỗi,7 bỏ qua. Lỗi `presets-create` kỳ vọng headers object trong khi transport đã dùng `Headers`; assertion đã sửa để đọc header bằng `new Headers(...).get(...)`, không thay xác thực.

Chi tiết nguồn thật: [ui-redesign-data-validation.md](ui-redesign-data-validation.md).
Hướng dẫn vận hành/API: [ui-redesign-operations.md](ui-redesign-operations.md).

## Kiểm thử cuối

- `NEXT_DIST_DIR=.tmp/redesign-build npm run build`: thành công, gồm kiểm tra kiểu và tạo trang production.
- `npm run typecheck`, `npm run lint:colors`, `git diff --check`: đạt; bảng màu 0 vi phạm.
- `npm test`: **263 đạt, 7 bỏ qua**, 43 file đạt/1 file bỏ qua. Các test bỏ qua cần NETWORK_TEST_DATABASE_URL (6 test) và PUBLISHING_TEST_DATABASE_URL (1 test) cho DB cô lập; không chạy vào DB ứng dụng thật. Không chứng nhận chúng đã chạy.
- Playwright trên server `next start` từ bản production: **29/29 đạt** trong 1,2 phút, gồm 5 nhóm admin shell, responsive, topology, monitor và đồng bộ crosshair sau khi dữ liệu đến muộn.
- Có kiểm tra fallback sao chép MAC khi Clipboard API không khả dụng, pause/resume, reduced motion, request drawer chỉ chạy khi mở tab liên quan, ảnh ở1280/1440/1920, modal xác nhận và custom range.

Ảnh nằm trong `.tmp/ui-redesign`, `.tmp/network-upgrade`; video nghiệm thu production tại `.tmp/playwright-redesign-production-final/**/video.webm`. Fixture không thay cho đối chiếu với giao diện thiết bị thật. Đã đọc thử Zabbix7.0.32: available có66 mẫu/giờ; CPU thiếu mẫu giữ quality missing và đọc được2 ngưỡng trigger (xem báo cáo dữ liệu).

### Kiểm tra hiệu năng gói tin P4

Bản cuối dùng Canvas2D cho hạt, giữ cạnh/nhãn SVG tĩnh. Một registry nằm trong từng topology, lấy 97 điểm trên mỗi đường SVG và cache hữu hạn; một requestAnimationFrame nội suy toàn bộ hạt rồi vẽ theo hai màu. Hai làn vẫn lệch ±3 px, download cha→con, upload con→cha, mật độ/thời gian lấy từ số liệu thật. Không có hạt thì không có vòng rAF; pause/hidden/reduced-motion/stale/ngoại tuyến và perspective interface đều hủy đăng ký. Thay đổi viewport áp dụng bằng phép biến đổi tọa độ, không cập nhật React mỗi frame. Canvas được xuất cùng ảnh PNG.

Đây là điều chỉnh kỹ thuật so với circle/animateMotion trong kế hoạch để giảm chi phí 1.500 hoạt ảnh SVG riêng. Đo Headless Chromium, fixture 300 máy khách, 150 cạnh động/1.500 hạt, viewport 1920×1080, cửa sổ 4 giây: SVG ban đầu25,5 FPS; SVG nét chấm27,39 FPS; Canvas trong Next dev46,75 và42,25 FPS, p95 frame16,8 ms. Kết quả dev có độ dao động và chưa đạt tiêu chí ≥50 FPS trung bình; lượt nghiệm thu production được ghi riêng sau khi build. Chi tiết `.tmp/ui-redesign/topology-performance.json`; đây là fixture trên máy thực thi, không phải đo trên thiết bị người vận hành.


### Nghiệm thu production P4 và PNG

Cùng fixture300 máy khách,151 nút hiển thị,150 liên kết động và1.500 hạt, viewport1920×1080, cửa sổ đo10 giây trên Headless Chromium/`next start`: ba lượt production đạt **52,10 /53,41 /53,61 FPS**, p95 frame **16,8 ms**. Đạt mục tiêu trung bình≥50 FPS trong môi trường kiểm thử này. Vẫn quan sát long frame khi cập nhật dữ liệu (max500–750 ms); không diễn giải kết quả thành bảo đảm50 FPS tức thời hoặc chứng nhận phần cứng NOC thực tế. JSON có thống kê long task: `.tmp/ui-redesign/topology-performance-production.json`.

Xuất PNG thực được tải qua trình duyệt và xem lại; ảnh không chứa controls/minimap/attribution để tránh lỗi mặt nạ SVG khi clone. Tên file dùng ngày Asia/Bangkok. Artifact: `.tmp/ui-redesign/topology-export.png`.

### Sửa lỗi tương tác cuối

Biểu đồ ban đầu chưa có lịch sử nên nối nhóm trong effect lúc mount không có instance để nối. Đã chuyển sang `onChartReady`; kiểm thử di chuột CPU và so sánh bitmap RAM đã tái hiện lỗi trước sửa, chạy đạt sau sửa trên production. Sao chép IP/MAC có fallback browser copy command cho console HTTP LAN, không ném lỗi khi thiếu Clipboard API.

Server kiểm thử production cổng3102 của đợt nghiệm thu ban đầu đã dừng. Trạng thái vận hành cập nhật sau yêu cầu icon/khởi động lại được ghi bên dưới.


## Cập nhật icon và triển khai vận hành — 24/10/2026

- Lưu nguyên bản ba PNG do người vận hành cung cấp trong `public/device-icons/`, dùng chung cho Topology, drawer và danh sách/bộ chọn đối tượng biểu đồ giám sát. Giữ thông tin OS/model/fingerprint qua API để phân biệt điện thoại và máy tính; loại chưa rõ dùng icon chung.
- Unit: **276 đạt,7 bỏ qua**;13 test về nhận diện và thông tin nguồn qua topology. Typecheck và kiểm tra bảng màu đạt.
- Image production `d541151d9756` đã build thành công; mã của6 module liên quan trong image khớp workspace. **29 E2E đạt** trên chính image đó, gồm tải ảnh thực và kiểm tra cả ba loại icon trong Topology. Các API nghiệp vụ ở E2E dùng fixture. Sau khi triển khai, kiểm thử Topology trên dịch vụ thật cổng3000 cũng đạt (1/1); bao gồm xác nhận ảnh điện thoại/laptop/AP đã tải và thao tác drawer/lưu lượng.
- Đã thay và khởi động lại hai container ứng dụng cổng3000/3001. `/admin` HTTP200; health trực tiếp backend và qua proxy đều HTTP200, modebackend; truy vấn DB `SELECT1` thành công; ba PNG HTTP200 và nội dung khớp ảnh gốc. Dịch vụ DB/Redis/MinIO và stack giám sát giữ nguyên, image cũ có tag rollback được ghi trong `.tmp/device-icons-deploy/rollback.json`.
- Máy chủ hiện không phân giải được `wifi.jtsc.vn`, vì vậy xác minh vận hành qua localhost; chưa khẳng định truy cập tên miền bên ngoài. Không thay đổi DNS.


## Sửa Topology trắng và bố cục cây theo tham chiếu — 24/10/2026

Đã xử lý chu trình uplink AP bằng SCC/DAG, sửa căn viewport của controlled ReactFlow và chuyển node sang icon/nhãn, cây cha–con có mở/thu nhánh. Các nhóm thiếu uplink được ghi rõ là nhóm hiển thị; giữ dữ liệu vật lý quan sát được. Bản `2286e235d718` đã triển khai cho frontend/backend trên `solutionai.com.vn`: unit279 đạt/7 bỏ qua,33 E2E image production đạt,5 E2E public domain đạt. Benchmark mới 54.91 FPS với150 cạnh/1.500 hạt; xuấtPNG đạt. Xem [báo cáo sửa Topology](topology-blank-fix.md) để có dữ liệu trước/sau, giới hạn đo và chi tiết triển khai.
