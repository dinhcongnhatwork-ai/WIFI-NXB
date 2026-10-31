# Giao diện vận hành mạng

## Phạm vi

Triển khai theo `ui_redesign_plan.md`: hệ thống màu xanh duy nhất, typography Inter/JetBrains Mono tự host, topology UniFi/MikroTik, lưu lượng có nguồn và thời điểm, dashboard ECharts và API giám sát tổng hợp. Hai nhà cung cấp giữ riêng; không cộng số liệu cùng máy khách từ hai nguồn.

## Topology

- Cấu trúc: tải khi mở trang và mỗi 60 giây. Lưu lượng: 5 giây, cache backend 3 giây và mẫu Redis hết hạn sau 120 giây.
- `downloadBps`/`uploadBps` là bit/giây; `downloadBytes`/`uploadBytes` là byte tích lũy.
- Chu kỳ đầu chưa có delta: “Đang đo…”. Counter giảm/đổi phiên: bỏ tốc độ của mẫu đó. Thiếu mẫu: “—”, không thay bằng 0.
- Máy khách UniFi dùng tx từ AP là download; cổng downstream cũng dùng tx là download; uplink nhìn từ thiết bị con dùng rx là download.
- Interface MikroTik chưa xác định vai trò WAN/LAN hiển thị TX/RX theo interface, không suy diễn download/upload; Hotspot dùng bytes-out/download, bytes-in/upload.
- Nút WAN UniFi chỉ hiện với bằng chứng `wan1` hợp lệ và có nhãn suy ra.
- Gom theo AP/SSID, mở tối đa 30 khách mỗi cụm, phần còn lại xem trong drawer. Khay chưa rõ kết nối không tạo đường nối suy đoán.
- Hoạt ảnh chỉ dùng mẫu mới có tốc độ dương; dừng khi tab ẩn, reduced motion, tạm dừng hoặc mẫu quá 30 giây. Tối đa 150 cạnh có hoạt ảnh.
- Lịch sử trong bộ nhớ trình duyệt giữ tối đa 15 phút, mất khi tải lại hoặc chuyển phạm vi.

## Giám sát

API mới đều sử dụng quyền đọc và phạm vi lọc hiện tại:

- `GET /api/monitor/metrics/batch?targetIds=...&metrics=...&time=24h`: tối đa 24 đối tượng và 96 chuỗi, concurrency 4, khoảng 500 điểm/chuỗi.
- `GET /api/monitor/summary?time=24h`: host và SLA kèm độ phủ, số liệu nguồn tách riêng.
- `GET /api/monitor/top?metric=cpu.percent&limit=5&time=24h`: xếp hạng theo lịch sử.
- `GET /api/monitor/events/histogram?time=24h&bucket=1h`: nhóm sự cố, báo giới hạn nếu chạm 10.000 sự kiện.
- Khoảng tùy chọn dùng `time=custom&from=<ISO có múi giờ>&to=<ISO có múi giờ>`, tối đa 30 ngày; cache tách theo thời điểm kết thúc và truy vấn không lấy mẫu sau `to`.
- `GET /api/network/client-context?mac=...`: liên kết điểm danh tối đa 10 bản ghi, đối chiếu phiên Hotspot theo cùng MAC từ kết nối hiện có; không import hoặc thay đổi cấu hình thiết bị.
- API metrics đơn vẫn hoạt động. p95 ở khoảng dài được ghi rõ là p95 của trung bình giờ; SLA trend có nhãn ước tính độ phủ dựa trên số mẫu, không coi một mẫu là một giờ hoạt động. Bảng Top có sparkline khi batch cung cấp đủ lịch sử, thiếu lịch sử được ghi rõ. Ngưỡng chỉ vẽ khi đọc được trigger xác định rõ; thiếu trigger không tự bịa ngưỡng.

## Kiểm tra và chạy bản mới

```bash
npm ci
npm run lint:colors
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npx playwright test tests/e2e/admin-shell.spec.ts tests/e2e/network.spec.ts tests/e2e/monitor.spec.ts tests/e2e/ui-redesign.spec.ts tests/e2e/monitor-sync.spec.ts
```

Font được đóng gói cùng ứng dụng; trình duyệt không cần kết nối Google Fonts. Các API mới dùng schema hiện có, không có migration DB mới riêng cho đợt UI này. Redis không khả dụng được ghi rõ; không dùng dữ liệu giả để thay thế nguồn.

Để áp dụng trên Docker, build lại cả frontend và backend bằng quy trình hiện tại trong `HUONG_DAN_CHAY_VA_CAP_NHAT.md`, vì cả API và frontend đều có thay đổi. Không chạy song song nhiều lượt Playwright dùng cùng thư mục output; khi cần, truyền `--output` riêng. Bản build kiểm tra dùng `NEXT_DIST_DIR=.tmp/redesign-build` để tránh đè `.next` của dịch vụ hiện đang chạy.

## Điều kiện nghiệm thu tại môi trường thật

Xem `ui-redesign-data-validation.md` để biết trường nào đã quan sát được từ controller thật. Chỉ chứng nhận sai lệch ≤ một chu kỳ sau khi đối chiếu chiều/đơn vị bằng thử tải và giao diện UniFi gốc. MikroTik cần kết nối thực để kiểm tra API/counter; không cấu hình thiết bị tự động trong đợt sửa giao diện. Mốc 50 FPS/150 cạnh cần Chrome Performance trên máy vận hành thực tế.

## Walkthrough nghiệm thu UI

1. Mở `/admin`: xác nhận sidebar/tab đang chọn, số liệu có nguồn/thời điểm, thông báo khi tải lại thất bại vẫn giữ dữ liệu cũ.
2. Mở `/admin/unifi/topology`, chọn controller/site; thử tìm tên/IP/MAC, đổi gom AP/SSID, mở cụm và bấm máy khách. Nút vừa khung không tự phóng nút vượt kích thước đọc tự nhiên.
3. Trong drawer xem lưu lượng, kết nối, radio/cổng; tab Liên quan mới tải điểm danh/Hotspot. Hai nguồn nằm riêng; Hotspot chỉ đối chiếu bộ đếm phiên khi chưa có phép đo tốc độ.
4. Bật reduced motion hoặc Tạm dừng hiệu ứng để xác nhận gói tin dừng, dữ liệu số vẫn tiếp tục cập nhật. Mẫu thiếu/quá hạn không chạy gói tin.
5. Mở `/admin/monitor`: biểu đồ lưu lượng/sự cố ở đầu, chọn đối tượng và 1h/6h/24h/7d/30d hoặc khoảng tùy chọn UTC+7; kéo zoom trên chart, kiểm tra ngưỡng thực và khoảng trống dữ liệu.
6. Tab Cảnh báo: thử bộ lọc, mở modal xác nhận bằng tài khoản có quyền; Viewer không có nút xác nhận. Tab Nhật ký giữ bộ lọc/phân trang/xuất CSV.

Ảnh fixture: `.tmp/ui-redesign/admin-{1280,1440,1920}.png`, `.tmp/network-upgrade/topology-{1280,1440,1920}.png`, `.tmp/network-upgrade/monitor-desktop.png`. Video của từng lượt nằm dưới `.tmp/playwright-redesign-production-final/**/video.webm`. Ảnh đăng nhập trước/sau lấy từ dịch vụ cũ và server kiểm thử: `.tmp/ui-redesign/login-before.png`, `.tmp/ui-redesign/login-after.png`.

## Icon thiết bị (24/10/2026)

Ba ảnh gốc người vận hành cung cấp được lưu tại `public/device-icons/`; nguồn ảnh ở `public/device-icons/SOURCES.md`. Component `DeviceIcon` dùng chung cho Topology, drawer, danh sách liên quan, bảng thiết bị, top thiết bị và đối tượng biểu đồ trong trang giám sát. Ảnh được phục vụ cùng ứng dụng để tải và xuất PNG không phụ thuộc CDN bên ngoài.

Điện thoại nhận diện từ iOS/iPhone/Android hoặc thông tin loại thiết bị; máy tính từ Windows/macOS/MacBook/laptop/desktop. Topology giữ thêm thông tin OS, model và fingerprint từ UniFi. AP UniFi dùng ảnh AP; thiết bị chưa rõ loại giữ icon chung. Không suy đoán điện thoại chỉ từ việc kết nối Wi-Fi hoặc hãng MAC.


## Topology cây và xử lý uplink vòng

Bố cục hiện tại dùng cây cha–con, node dạng icon và nhãn. Nhánh AP chưa có bằng chứng uplink được gom riêng; nét chấm từ nhóm hiển thị không phải dây mạng vật lý. Bấm nhóm để mở các AP và xem danh sách. Luồng máy khách vẫn gom theo AP/SSID; các AP trong chu trình giữ cạnh quan sát, xếp trên cùng tầng trong thành phần đó. Nút Vừa khung căn lại toàn sơ đồ; poll lưu lượng giữ zoom. Chi tiết kiểm chứng, ảnh và image triển khai: [sửa sơ đồ trắng và đổi cây](topology-blank-fix.md).
