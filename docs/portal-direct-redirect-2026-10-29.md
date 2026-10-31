# Chuyển thẳng đến website sau xác thực WiFi — 29/10/2026

Bản triển khai khoảng 11:06 giờ Việt Nam dùng `wifimarketing:portal-direct-20261029`, image ID `sha256:3683bf7007894ae1410d4ba10951fde14062a34c4b08aa3680ac3834d5fd168a`. Production hiện đã dùng [bản bổ sung thời hạn phiên chiến dịch](campaign-session-expiry-2026-10-29.md), giữ nguyên hành vi chuyển hướng trực tiếp này.

## Hành vi

Luồng UniFi: **Mẫu 4 → Kết nối ngay → xác thực và đọc lại quyền trên controller → HTTP302 đến URL chiến dịch**. Bỏ trang HTML xác nhận, thời gian chờ hai giây và nút Tiếp tục. Redirect không phụ thuộc JavaScript hoặc meta refresh. Chiến dịch TEST hiện có URL `https://www.nxbctqg.org.vn/`.

Chỉ thay helper `src/lib/network/portal-success.ts` trong ảnh production trước. Các bước kiểm tra phiên có chữ ký, MAC/SSID/AP, ownership, chiến dịch hiệu lực, video/điểm danh và readback quyền giữ nguyên. Lỗi xác thực không được redirect như một lượt thành công. URL lấy từ chiến dịch phía server, giữ `no-store` và `no-referrer`; vẫn từ chối giao thức không hợp lệ hoặc URL có username/password. Không đổi luồng trial MikroTik hoặc response JSON của POST `/api/login`.

## Kiểm chứng

- Test trước sửa thất bại đúng do HTTP200/trang trung gian; sau sửa 95/95 test trong 9 suite đạt, gồm chặn cấp quyền và giữ URL chiến dịch khi khách gửi URL khác.
- Build production và kiểm tra kiểu đạt. 8/8 test trình duyệt đạt, gồm chuyển thẳng sau một lần bấm, redirect khi JavaScript bị tắt, loading có giới hạn, renderer và CMS.
- Test trình duyệt dùng controller giả lập và máy chủ đích HTTP thật chạy cục bộ. Chưa thực hiện một lượt xác thực mới bằng iPhone sau bản cập nhật này.
- Qua tên miền production: portal HTTP200, một trang portal, không có gate phụ, một nút kết nối, không có lỗi JavaScript. Request UniFi thiếu phiên ký vẫn bị HTTP403.
- Hai container chạy đúng image và source hash đã kiểm tra. Worker đồng bộ campaign healthy sau cập nhật.
- Đối chiếu trước/sau xác nhận guest settings, WLAN và network trên UniFi không thay đổi. Không tác động cấu hình MikroTik, PPPoE, bridge, DHCP hoặc thu hồi các phiên WiFi đang sử dụng.
- Chỉ tạo lại backend/frontend; entry, controller, database, Redis, MinIO giữ nguyên container. `.env` chỉ đổi `APP_IMAGE`; không migration/seed.

Ảnh trước giữ tại `wifimarketing:before-portal-direct-20261029` (cùng nội dung với `portal-flow-20261029`). Log build/test, snapshot trước/sau và ảnh kiểm tra production nằm trong thư mục riêng `.tmp/portal-direct-20261029/`.
