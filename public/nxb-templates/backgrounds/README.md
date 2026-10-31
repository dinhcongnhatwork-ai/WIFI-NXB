# Bộ nền trang chào WiFi

Mỗi mẫu có hai ảnh được tạo riêng về bố cục, không kéo ảnh ngang thành ảnh dọc:

| Mẫu | Chủ đề | Tên tệp |
| --- | --- | --- |
| Văn hóa đọc | Giấy ấm, ánh sáng và bóng lá | `van-hoa-doc-*` |
| Xuất bản số | Đường truyền dữ liệu xanh trên nền navy | `xuat-ban-so-*` |
| Hội nghị | Đỏ trầm, dải vàng tiết chế | `hoi-nghi-*` |
| Triển lãm | Kiến trúc đá sáng, cây xanh và ánh nắng | `trien-lam-*` |
| Nghiên cứu lý luận | Núi rừng, tre và sương sớm | `ly-luan-*` |

- `*-desktop.webp`: 1920 × 1080, tỷ lệ 16:9, dành cho PC.
- `*-portrait.webp`: 1080 × 1920, tỷ lệ 9:16, dành cho Mobile/Tablet.
- WebP chất lượng 85; khoảng 52–178 KB/tệp. Không chứa chữ, logo hay ảnh sự kiện.
- Hiển thị bằng `cover`: giữ tỷ lệ, cắt phần dư theo vùng hiển thị.

`src/lib/preset-backgrounds.ts` cũng nhận diện đúng năm đường dẫn nền JPG cũ để các mẫu đã lưu sử dụng bộ nền mới theo thiết bị. Ảnh tự tải lên và các URL khác giữ thiết lập của người dùng. `scripts/generate-nxb-assets.mjs` chỉ tạo logo/slide/thumbnail; không tái tạo nền từ ảnh sự kiện.

Ảnh được tạo bằng công cụ imagegen ngày 29/10/2026. Bố cục, logo, nội dung và các slide của mẫu không đổi.
