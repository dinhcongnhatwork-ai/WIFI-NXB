# Nâng cấp quản trị và giám sát mạng

Triển khai theo kế hoạch người dùng duyệt ngày 2026-10-21.

## Phân công và hợp đồng tích hợp

| Phần | Đầu ra | Phụ thuộc | Trạng thái |
|---|---|---|---|
| Nền dữ liệu, kết nối, RBAC | Vai trò, secrets, API xác thực, migration bổ sung | Prisma/PostgreSQL | Đã triển khai production |
| Giao diện | Layout, sidebar248px, ba cỡ chữ12/14/20, bảng và form | useAuth.role | Đã triển khai production |
| Thiết bị và topology | API/form/capability, dữ liệu liên kết có bằng chứng | Connection resolver, authorization, audit | Đã triển khai; chờ nghiệm thu thiết bị thực |
| Giám sát | Zabbix, collector, log, UI/API | MonitoringTarget/OperationalLog, resolver | Production có dữ liệu máy chủ/ứng dụng thật |
| Nghiệm thu | TypeScript, unit, build, Playwright, hồi quy | Các phần trên | Đã đạt kiểm tra tự động; xem bên dưới |

## Quyết định triển khai

- Giữ workspace và các thay đổi sẵn có trên nhánh tính năng để tích hợp với công việc trình dựng mẫu/điểm danh chưa commit của người dùng.
- Người dùng cho phép build và chạy production ngày 22/10/2026. Không ghi cấu hình thiết bị đang phục vụ.
- Giám sát dùng nguồn dữ liệu thật; thiếu quyền/nguồn dữ liệu thể hiện rõ thay vì ghi số 0.
- Các subsystem có phạm vi file riêng, hợp đồng tích hợp lưu trong `.tmp/network-upgrade/contracts.md`.

## Kiểm tra và triển khai

- Bộ unit tích hợp: 186 đạt, 5 bỏ qua theo điều kiện môi trường. Bộ DB phân quyền/tài khoản/kết nối cô lập: 6 đạt.
- Kiểm tra phần sửa cuối: network 57 unit và 7 E2E; monitoring 26 unit và 4 E2E; UI 10 E2E; hồi quy builder/renderer 10 E2E. Các lượt này có thể chồng lặp test, không cộng thành tổng duy nhất.
- Trước triển khai: 17 test proxy/kết nối/TLS/phân quyền đạt; Docker production build hoàn tất, gồm kiểm tra TypeScript. `git diff --check` đạt.
- Migration chạy thử trên bản sao dữ liệu production rồi mới áp dụng thật. Số lượng tài khoản, mẫu, revisions và phiên điểm danh được giữ nguyên.
- Kiểm tra chính image mới: API tài khoản/dashboard/kết nối/giám sát trả 200, chưa đăng nhập trả 401; frontend proxy tới backend đúng; image không chứa `.env` hoặc thư mục skills.
- Đã chuyển frontend/backend/collector sang image `wifi-network-upgrade:20261022`. Tên miền production trả HTTP 200; API bảo vệ và proxy đã được kiểm tra lại qua HTTPS thật.
- Playwright mở trang Giám sát production, hiển thị biểu đồ và bảng dữ liệu thật, không có lỗi JavaScript. Ảnh nghiệm thu: `.tmp/network-upgrade/deploy/production-monitor.png`.
- Zabbix 7.0.32 nhận CPU/RAM/uptime/disk/availability của Agent 2, tiến trình ứng dụng và trạng thái dịch vụ; collector có heartbeat. Các lỗi khởi tạo cache item và tên host trùng đã xử lý trong bootstrap triển khai.
- UniFi đã nhập kết nối mã hóa nhưng controller `192.168.1.200:11443` hiện không truy cập được (`EHOSTUNREACH`); cần kiểm tra đường mạng/controller trước nghiệm thu thiết bị.
- MikroTik chưa cấu hình theo yêu cầu người dùng; không tự nhập kết nối cũ. Thao tác cấu hình và topology trên thiết bị thật cần nghiệm thu sau khi kết nối.

Xem [ghi chép triển khai và khôi phục](network-upgrade-deployment.md).
