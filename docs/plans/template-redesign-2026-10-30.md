# Thiết kế lại 5 mẫu trang chào

Phạm vi: 5 mẫu, 4 màn hình, 3 thiết bị. Giữ logo, ảnh ấn phẩm và luồng kết nối; dùng bộ nền ngang/dọc đã tạo. Không sửa trực tiếp bản đang xuất bản hoặc tự loại thành phần trong bản nháp.

1. Bổ sung vị trí grid tùy chọn cho node flow; tài liệu cũ hiển thị như trước.
2. Cập nhật cả 5 preset: PC hai cột; Mobile/Tablet xếp dọc, font Việt tự lưu trữ, chữ 15–17px, nút tối thiểu 48px, bỏ shimmer/glow/bóng chữ. Ảnh dùng contain.
3. Màn hình chức năng cao theo nội dung, không cuộn lồng nhau. Giữ đầy đủ validation và trạng thái chờ/lỗi.
4. Điều hướng từ lỗi publish tới node cần sửa; không bỏ validation hoặc tự lấp media sai mục đích.
5. Cập nhật gallery bằng screenshot renderer thật; kiểm tra publish, 60 tổ hợp thiết bị/màn hình, ảnh, tràn ngang và các flow mô phỏng.

Palette: Văn hóa đọc giấy ấm/đỏ nâu; Xuất bản số navy/teal; Hội nghị đỏ trầm/bề mặt sáng; Triển lãm kiến trúc sáng/đỏ; Lý luận xanh rừng/bề mặt sáng.

Điều tra: đọc bản nháp Mẫu 4 trong ảnh cho thấy PC có thêm 3 node src rỗng (Logo, Hình ảnh, Hình ảnh). Logo và slider gốc vẫn có đủ nguồn. Giữ cảnh báo và giúp người dùng tới đúng thành phần cần chọn ảnh hoặc xóa.
