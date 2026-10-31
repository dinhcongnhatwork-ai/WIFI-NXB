# Giao diện giám sát mạng — thiết kế lại

Giao diện sáng kiểu UniFi cho sơ đồ UniFi/MikroTik, Monitor, danh sách thiết bị/máy khách và bảng chi tiết. Không thay API công khai, cơ sở dữ liệu hoặc thiết lập thiết bị mạng. Chưa triển khai production.

## Cách dùng

- Mở Sơ đồ mạng ở 100%. Thẻ rộng 300px, tên 15px, hình phần cứng 64px. Cuộn hoặc kéo để di chuyển; minimap giúp đi qua cây lớn. Vừa khung là thao tác chủ động, không chạy lại khi nguồn cập nhật.
- Cây đi từ trái sang phải. AP thu gọn máy khách theo mặc định; nút Mở nhánh tách biệt thao tác chọn thẻ để xem chi tiết. Chọn một AP trong bộ lọc để xem toàn bộ nhánh, gồm AP mesh và máy khách bên dưới.
- Tìm tên, IP, MAC hoặc hostname; nhấn Enter hoặc chọn kết quả để mở các nhánh cần thiết và đưa thiết bị vào vùng nhìn. Tìm lại cùng một kết quả sau khi kéo xa vẫn đưa camera về thiết bị.
- Diagram và danh sách dùng cùng bộ lọc tầng/trạng thái, giữ tổ tiên cần thiết làm ngữ cảnh. Tầng ưu tiên metadata; tầng suy từ tên AP có chú thích và không dùng để suy ra cáp vật lý.
- Chưa rõ uplink hoặc kết nối máy khách được thể hiện bằng nhóm hiển thị, không tự gán controller, IP, model hay tốc độ. Liên kết tổ chức/logic dùng nét đứt.
- Toàn màn hình giữ nguyên phạm vi và bố cục, có fallback khi trình duyệt từ chối Fullscreen API; Escape đóng và trả focus. Xuất PNG dùng ảnh địa phương, giữ độ trong suốt của hình thiết bị.

## Traffic và tính chính xác

- Xanh dương: nhận / tải xuống; xanh ngọc: gửi / tải lên. Chỉ dùng Download/Upload khi nguồn xác định được chiều người dùng.
- Hợp đồng TrafficSample cũ được giữ nguyên: với perspective=interface, downloadBps chứa TX và uploadBps chứa RX. Lớp trình bày hoán đổi đúng vị trí để RX nhận màu xanh dương, TX gửi màu xanh ngọc.
- Các metric collector rx.bytes_sec/tx.bytes_sec có đơn vị B/s; chỉ đổi sang bit/s một lần. Zabbix cung cấp đơn vị bit/s tường minh được giữ nguyên. Bộ chuẩn hóa idempotent, giữ null và zero khác nhau.
- Số liệu mới nhất được chọn theo sampledAt giữa topology và traffic feed, cả trên thẻ, cạnh và bảng chi tiết. Bố trí Dagre không phụ thuộc các giá trị lưu lượng.
- Chỉ hạt trên liên kết có số liệu thực, chưa quá 30 giây, có hướng đã xác định mới chuyển động. Tab ẩn, yêu cầu giảm chuyển động, nút tạm dừng, thiết bị offline hoặc mẫu cũ sẽ dừng hạt.
- Tổng khách chỉ cộng bộ đếm máy khách tương thích; không giả là tổng uplink hay tổng Internet. Bộ đếm interface không bị cộng thành download người dùng.
- Lịch sử sơ đồ là mẫu thật trong phiên trình duyệt, tối đa 15 phút. Biểu đồ chi tiết dùng RX/TX đúng phía, khoảng trống cho null, trục thời gian gọn; mẫu đơn hiện một điểm thật thay vì tạo đường lịch sử.
- Backend Monitor không còn tạo lịch sử/jitter từ snapshot mới nhất, hoặc tự tạo ngưỡng cảnh báo mặc định. Không có lịch sử thật sẽ trả trạng thái thiếu mẫu. Monitor giữ khoảng thời gian mặc định 24 giờ và lịch sử backend hiện có.
- Topology cập nhật 15 giây như các workspace trước đó, traffic 5 giây; Monitor giữ chu kỳ hiện có 30 giây. Trạng thái mở nhánh, tìm kiếm, lựa chọn và lịch sử được đặt lại khi đổi connection/site.

## Bộ hình

Mười ảnh PNG v2 có alpha thật: AP, router, switch, laptop, desktop, điện thoại, máy in, TV, server và thiết bị chung. Tạo bằng built-in imagegen theo cùng một phong cách sản phẩm, tối ưu xuống 512×512; không thay ảnh gốc. Đây là hình đại diện loại phần cứng, không phải ảnh xác nhận đúng model.

Registry và bộ phân loại dùng chung cho sơ đồ, Monitor và danh sách; ảnh lỗi có icon dự phòng. Prompt và nguồn được lưu trong [SOURCES.md](../public/device-icons/SOURCES.md).

## Kiến trúc

- NetworkTopologyWorkspace là workspace chung; các entry point cũ chuyển tiếp tới nó.
- network-layout tách cấu trúc quan sát, nhóm trình bày, lọc có giữ tổ tiên, và bố trí. SCC condensation bảo toàn liên kết vòng/hai chiều; không tạo chuỗi cấp vô hạn.
- NetworkDeviceNode, NetworkTrafficEdge và NetworkViewport tách thẻ, cạnh, camera. Chuyển động dùng registry Canvas đã có, bỏ glow và comet tail.
- Chart formatter và trạng thái sự cố có helper riêng. Giữ xác thực, quyền VIEWER/OPERATOR/ADMIN và connection/site qua API như trước.

## Kiểm chứng

Đối chiếu trên fixture 37 AP / 111 máy khách tại 1366×768 và 1920×1080. Fixture tự chứa trong Playwright, chỉ chặn API kiểm thử, không dùng thông tin đăng nhập hoặc sửa thiết bị thực.

- Playwright: tổng 23 bài đạt (16 sơ đồ mới và 7 Monitor); nhóm sơ đồ bao gồm kích thước/zoom, mở/đóng AP, toàn nhánh mesh, máy khách không có parent, tìm lại cùng thiết bị sau pan, giữ viewport qua các poll, null/zero/missing/failed/stale, native/fallback fullscreen và chữ ký PNG thật.
- 78 bài unit tập trung đạt; bao gồm cấu trúc cây, chu trình, bộ lọc, RX/TX, quy đổi đơn vị, lịch sử thật, biểu đồ compact/singleton, trạng thái chưa có dữ liệu và alpha của cả mười ảnh.
- Typecheck và production build đạt; kiểm tra diff không có whitespace lỗi.
- Baseline toàn suite được chạy riêng từ index trước thay đổi: 275 đạt, 15 lỗi, 7 bỏ qua. Sau thiết kế lại: 317 đạt, 14 lỗi, 7 bỏ qua. Các lỗi còn lại trùng baseline về attendance/publication, collector/adapters và truy vấn lịch sử/sự kiện; không coi toàn suite đã xanh. Bài kiểm tra hiệu ứng hạt cũ được đổi từ ràng buộc tốc độ/mật độ cụ thể sang giới hạn hành vi để phù hợp chuyển động tiết chế.
- Một số selector E2E Monitor cũ đã không còn khớp chính baseline; cập nhật selector tới tên truy cập hiện tại và giữ các kiểm tra hành vi. Cả 7 bài Monitor đạt sau khi cập nhật selector, đồng thời bổ sung hiển thị xác nhận thật và cảnh báo dữ liệu đã lưu khi nguồn lỗi.

Ảnh và báo cáo kiểm chứng cục bộ nằm trong `.tmp/network-redesign/`: before/after ở hai kích thước, hidden-client-search, monitor-after, bộ hình contact sheet, log unit/build/typecheck và rà soát độc lập. `.tmp` không thuộc mã nguồn triển khai.

Lệnh chuẩn khi môi trường có npm:

```bash
npm ci
npm run typecheck
npm test -- tests/network-redesign-layout.test.ts tests/device-icons.test.ts tests/network-topology.test.ts tests/network-traffic.test.ts tests/topology-presentation.test.ts tests/monitor-chart-format.test.ts tests/monitor-chart-empty-state.test.ts tests/monitor-event-state.test.ts tests/monitor-metric-series.test.ts
npm run test:e2e -- tests/e2e/network-redesign.spec.ts --output=.tmp/network-redesign/browser-results
APP_SERVER_MODE=build MONITOR_PROCESS_ENABLED=false npm run build
```

Trong phiên thực hiện, npm và thư viện Chromium được đặt cục bộ vì host thiếu npm/thư viện đồ họa/font; không cần sửa package-lock hoặc cài hệ thống với quyền quản trị. Không commit, reset các thay đổi sẵn có hay publish.

## Bổ sung MikroTik nhiều thiết bị

Xem [hướng dẫn danh mục, sơ đồ tổng, cổng AP và fullscreen](mikrotik-fleet-monitoring.md) cho luồng thêm router/core/access và chế độ `scope=fleet`.


Cập nhật vận hành 30/10/2026: AP nhiều hàng 4/6/8, nhánh MikroTik gọn, line fullscreen, menu chiến dịch và quản lý thiết bị đã triển khai; xem [báo cáo kiểm chứng](network-operations-2026-10-30.md).

Cập nhật line và thẻ gọn 30/10/2026: sửa mất đầu nối khi cập nhật dữ liệu, tuyến xuống AP hai bên và thẻ client gần vuông; xem [kiểm chứng và triển khai](topology-compact-lines-2026-10-30.md).
