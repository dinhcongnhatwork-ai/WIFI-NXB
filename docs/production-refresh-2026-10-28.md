# Production refresh — 28/10/2026

Đã build lại toàn bộ mã nguồn hiện tại theo yêu cầu vận hành, sau đó tạo lại frontend, backend và HTTP portal entry lúc khoảng **12:00 UTC / 19:00 Việt Nam**.

Ảnh đang chạy: `wifimarketing:production-20261028T1148-fixed`, ID `sha256:8c9d54789e55e12d063e49e66e20d9e36a692d034db7c407917f93ac4c40496e`. `.env` chỉ thay `APP_IMAGE`; những biến vận hành khác giữ nguyên.

## Phạm vi và kiểm tra

- Build toàn bộ checkout, gồm code/tài nguyên mới của CMS, thư viện media, template, giám sát và sơ đồ mạng. Đối chiếu SHA256: 427 file nguồn/tài nguyên trong ảnh khớp workspace.
- 212/212 kiểm thử trong 21 suite liên quan đạt. Build production và TypeScript đạt.
- 17/17 kiểm thử trình duyệt trên bản đóng gói đạt: CMS, media trong CMS, kéo/thả/undo/autosave, preview, fleet, phân quyền và fullscreen.
- Kiểm tra thật qua `https://solutionai.com.vn`: bấm Chỉnh sửa cả hai mẫu rồi tải lại trang; editor đều 1440×1100. Thư viện media, trang giám sát và portal hiển thị; không có lỗi JavaScript, API HTTP400+ hoặc request ghi dữ liệu trong phép thử.
- Cả 18 tài nguyên tĩnh đang được hai mẫu lưu tham chiếu đều tồn tại.
- Backend/frontend/public health và HTTP entry đều hoạt động; callback chuyển đúng HTTPS portal. API từ chối MAC giả HTTP403. Worker campaign bật và cập nhật heartbeat `idle`, 0 campaign, 0 WLAN quản lý.

## Lỗi phát hiện trước chuyển

Kiểm thử fullscreen dự phòng của màn hình giám sát thất bại: khung chỉ rộng 1070px tại (272,96), thay vì 1366px tại (0,0). Ancestor `.admin-tab-transition` giữ `transform: matrix(1,0,0,1,0,0)` do animation fill `both`. Thử riêng trên trình duyệt đổi fill thành `backwards` khôi phục đúng viewport.

Sửa duy nhất cho lỗi này: `src/app/globals.css` dùng fill `backwards` để bỏ transform sau animation. Giữ hiệu ứng chuyển trang và ngoại lệ CMS đã triển khai. Đóng gói lại và chạy lại 17 kiểm thử, tất cả đạt.

`.dockerignore` bổ sung loại trừ backup, SQL dump, cấu hình router và báo cáo sinh tự động. Kiểm tra ảnh cuối không chứa `.env`, `.env.backup`, thư mục backup, SQL dump, archive MinIO hoặc `.tmp`.

## Bảo toàn và hoàn tác

Chỉ tạo lại các dịch vụ ứng dụng:

```sh
docker compose up -d --no-build --no-deps --force-recreate backend frontend hotspot-entry
```

Không chạy migration/seed. Schema Prisma giống bản đang chạy trước đó; container ID và thời điểm khởi động database, Redis, MinIO giữ nguyên. Controller UniFi không khởi động lại; toàn bộ cấu hình portal site, WLAN và network giống snapshot trước refresh. SSH export MikroTik khớp snapshot Hotspot tắt: PPPoE, interface, bridge, DHCP, pool, DNS, firewall giữ nguyên; `wmk-marketing` vẫn disabled.

Bản trước refresh giữ ở `wifimarketing:before-refresh-20261028T1148`. Snapshot môi trường, cấu hình, log build/test và ảnh kiểm tra nằm trong `.tmp/production-refresh-20261028T1148/`; token trình duyệt và bản sao môi trường tạm phục vụ candidate đã được xóa sau kiểm tra. Hai container candidate cũng đã xóa.

Nếu cần hoàn tác ứng dụng, đổi `APP_IMAGE` về `wifimarketing:before-refresh-20261028T1148`, rồi chạy lại lệnh compose trên; không restore database/router.

Người vận hành sẽ tự tạo SSID mở và gán chiến dịch sau. Không tạo SSID/campaign thử trong lần refresh này; kiểm tra đăng nhập từ thiết bị WiFi thực vẫn chờ bước đó.
