# Rà soát và thiết kế lại 5 mẫu — 30/10/2026

## Giao diện

Cả 5 preset được thiết kế lại trên Mobile, Tablet và PC; mỗi preset có trang kết nối, video, điểm danh, thông báo. Mặc định bật màn hình theo đúng chủ đề trước đây. Nền có bản ngang/dọc riêng và giữ tỷ lệ ảnh.

| Mẫu | Hướng thiết kế |
| --- | --- |
| 1 — Văn hóa đọc | Giấy ấm, đỏ nâu, tiêu đề serif |
| 2 — Xuất bản số | Navy, xanh ngọc, chữ sans tiếng Việt |
| 3 — Hội nghị | Đỏ trầm, bề mặt sáng, CTA đỏ |
| 4 — Triển lãm | Kiến trúc sáng, ảnh ấn phẩm và tiêu đề biên tập |
| 5 — Nghiên cứu lý luận | Núi rừng, xanh trầm, nền nội dung sáng |

PC: bố cục hai cột có thể chỉnh sửa trong CMS; Tablet/Mobile: một cột. Chữ nội dung 15–16px, tiêu đề 28–38px; nhãn/chân trang tối thiểu 12px. Font Be Vietnam Pro lưu tại public/fonts kèm OFL. Nút kết nối 54px, màu phẳng, bỏ shimmer/glow. Slider giữ tỷ lệ bằng contain, không chạy tự động hoặc phủ caption dài; có nút chuyển ảnh, vuốt và điều hướng bàn phím. Màn hình chức năng dùng chiều cao theo nội dung trong flow; bố cục freeform vẫn giữ chiều cao đã thiết lập.

Thư viện có thumbnail mới chụp từ renderer thực tế. Bảng xem nhanh: [5 mẫu trên PC/Mobile](template-redesign-preview-2026-10-30.webp).

## Áp dụng cho mẫu đã lưu

Trong CMS, chọn **Đổi thiết kế…**, chọn một trong 5 mẫu, xem trước và bấm **Áp dụng Mẫu…**. Thao tác thay toàn bộ thiết kế 3 thiết bị của bản nháp: JSON cũ được tải xuống dự phòng; Hoàn tác khôi phục toàn bộ tài liệu. Cần xuất bản riêng để cập nhật chiến dịch. Không thay đổi cấu hình Controller, campaign hay bản đang xuất bản khi chỉ xem trước.

## Lỗi xuất bản trong ảnh người dùng

Đã đọc bản nháp Mẫu 4 ID 9b98e5ed-9532-4904-9e55-b4125b1824af. PC có thêm một Logo và hai Hình ảnh với src rỗng; logo và slider gốc vẫn đủ nguồn. Không tự xóa hoặc điền nội dung thay cho người dùng. Mỗi lỗi/cảnh báo trong modal xuất bản nay có nút **Đến thành phần**: mở đúng thiết bị, màn hình, section và node để chọn ảnh hoặc xóa node thừa. Validation vẫn chặn media bắt buộc còn trống. Các preset mới có đủ media và alt.

## Kiểm chứng

- 55 kiểm thử logic: preset, publish, media/nền, renderer, document, đồng bộ và điều hướng lỗi.
- Browser matrix: 5 × 4 × 3 = 60 tổ hợp; ảnh giải mã được, không tràn ngang, CTA hoạt động, form điểm danh/thông báo hoàn tất trong mô phỏng, không cuộn lồng trong flow. Có kiểm tra bổ sung Mobile 375px.
- 21 bài browser CMS/renderer: thư viện, kéo/thả, undo, autosave, đồng bộ, reduced motion, điều hướng lỗi, thay thiết kế với backup và undo, video/điểm danh reset.
- API trong các kiểm tra browser được mock, không tạo phiên WiFi hoặc điểm danh thật. Chỉ đọc dữ liệu production để tìm nguyên nhân ảnh chụp; chưa sửa cơ sở dữ liệu hoặc triển khai dịch vụ đang chạy.

Build production cuối cùng đã hoàn tất thành công tại `.tmp/preset-redesign-build`; gồm lint, kiểm tra kiểu, sinh 46 trang và build traces. Chưa triển khai bản build lên container đang phục vụ người dùng.
