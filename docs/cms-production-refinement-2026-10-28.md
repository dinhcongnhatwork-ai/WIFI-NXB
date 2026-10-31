# CMS: đồng bộ thiết bị và chuẩn hóa công cụ

## Phạm vi

Cải tiến trình thiết kế CMS hiện hữu, renderer dùng chung và thư viện media. Giữ nguyên nội dung mẫu, cấu hình mạng và dữ liệu đang chạy. Đây là quy ước giao diện/vận hành của sản phẩm; không phải xác nhận đáp ứng một quy chuẩn pháp lý cho cơ quan nhà nước.

## Quy ước giao diện

- Nền trắng/xám lạnh, màu xanh cho thao tác chính; màu đỏ dành cho lỗi/xóa, màu xanh lá cho trạng thái đã lưu.
- Nhãn công cụ tối thiểu 12px, ô nhập số 13px, số dùng độ rộng cố định. Các ô số vị trí/kích thước chia hai cột; nhóm có thể thu gọn.
- Công cụ dùng chung bộ icon hiện có. Nút có trạng thái focus, disabled; điều khiển CMS cao tối thiểu 32px; nút kết nối có vùng bấm cao tối thiểu 44px.
- Thu gọn thanh công cụ theo chiều rộng màn hình, tránh chồng lấn nhóm thiết bị và thao tác lưu/xem trước/xuất bản.
- Hiệu ứng kết nối không phóng lớn vượt khung. Tôn trọng cài đặt giảm chuyển động, ngừng hiệu ứng khi nút bị vô hiệu hóa.

## Đồng bộ

Chế độ được lưu trong document (`deviceSync`). Mặc định đồng bộ thay đổi nội dung, media chính và cấu hình chức năng giữa các phần tử tương ứng của Mobile, Tablet, PC. Có thể chọn đồng bộ thêm màu/hiệu ứng hoặc chỉnh riêng từng thiết bị.

Tọa độ, kích thước, cỡ chữ, line-height, crop và các thuộc tính thay thế dành riêng cho PC được giữ riêng. Thêm/xóa phần tử hay section không tự động ghi đè cấu trúc thiết bị khác. Bảng màu thương hiệu vốn là dữ liệu chung của document.

Ghép phần tử dựa trên ID, tên/loại duy nhất hoặc nội dung cũ duy nhất trong cùng màn hình; không ghép theo thứ tự một cách phỏng đoán. Bỏ qua phần tử đích bị khóa hoặc không xác định được cặp. Nút “Đồng bộ ngay” báo số cập nhật/bỏ qua. Một lần hoàn tác khôi phục toàn bộ thay đổi đồng bộ của lần chỉnh đó.

Sao chép thiết bị là công cụ riêng, có lựa chọn ghi đè/thêm vào cuối. Khi sao chép bố cục tự do, chuyển tọa độ/kích thước theo chiều rộng đích, gồm cả phần tử con. Không dùng thiết bị nguồn làm đích.

So sánh ba thiết bị hiển thị đúng màn hình đang chỉnh, không tự chạy luồng mô phỏng. Nhân bản và đổi thứ tự phần tử con giữ đúng container; vị trí đầu/cuối được tính theo nhóm anh em, không theo danh sách lớp đã làm phẳng.

## Thư viện và bản nháp

Thư viện sử dụng transport xác thực chung, lấy phiên đăng nhập hiện tại khi gửi yêu cầu. Truy vấn tìm kiếm có debounce, hủy yêu cầu cũ và bỏ qua phản hồi đã bị hủy. Lỗi tải có nút thử lại và không hiển thị nhầm trạng thái thư mục trống. Các file đã tải thành công trước một lỗi tải nhiều file vẫn được làm mới trong thư viện.

Khi lưu thất bại, giữ document đang mở, hiển thị lỗi và có nút thử lưu lại/tải bản nháp JSON. Xung đột phiên bản không tự ghi đè dữ liệu máy chủ. Không công bố đã lưu nếu máy chủ chưa trả phiên bản hợp lệ.

## Nút kết nối và renderer

Nút dùng ảnh cũng là button có tên truy cập và thao tác bàn phím; ảnh lỗi chuyển sang nút chữ. Cấu hình yêu cầu đồng ý điều khoản được thực thi ở cả nút ảnh và nút chữ. Chế độ mô phỏng không gọi API kết nối thật.

Không báo kết nối thành công trước khi gateway xác nhận: trạng thái trong lúc chuyển hướng là “Đang xử lý kết nối WiFi”. Gradient preset giữ nguyên góc và các điểm màu đã lưu; màu phát sáng không tạo chuỗi hex alpha sai với màu rút gọn. Trong document v2, chiều cao slider/spacer của thiết bị hiện tại ưu tiên hơn thuộc tính chiều cao PC cũ.

## Kiểm tra vận hành

Kiểm tra chỉ đọc trên frontend/backend đang chạy: GET thư viện với phiên hợp lệ đều trả HTTP 200, 50 tài nguyên và 7 thư mục. Điều này không tái hiện được phiên đăng nhập cụ thể trong ảnh người dùng.

Các kiểm thử trình duyệt dùng dữ liệu/API giả lập để kiểm tra hành vi giao diện; không thay mẫu thật, tạo chiến dịch hay gọi cấp quyền WiFi thật. Kiểm thử database xuất bản chỉ chạy khi có database test độc lập.

## Kết quả xác minh

- 12 suite Vitest: 83 kiểm thử đạt; 1 kiểm thử database độc lập được bỏ qua vì chưa cấp database test riêng.
- 20/20 kiểm thử Playwright đạt trên dev; 20/20 đạt lại trên bản build production chạy cục bộ. Bao gồm lưu chậm, lỗi lưu/thử lại, thư viện lỗi/thử lại, đồng bộ/undo, so sánh đúng màn hình, nút ảnh/bàn phím/điều khoản, giảm chuyển động, nhân bản/đổi thứ tự lớp con và giao diện 1366/1440/1920px.
- Build Next.js production đạt; TypeScript và kiểm tra khoảng trắng phần thay đổi đạt.
- Sửa fixture kiểm thử cách ly bản xuất bản để dùng document hợp lệ; fixture cũ `{ published: true }` bị portal chủ động chuyển về preset dự phòng nên không còn kiểm tra đúng tính cách ly draft/revision.
- Ảnh kiểm tra: `.tmp/cms-review-tablet.png`, `.tmp/cms-review-library.png`.
- Chưa triển khai lên dịch vụ đang chạy. Không thay database, router, chiến dịch, mẫu thật hoặc bản xuất bản thật; đã dừng hai server kiểm tra cục bộ sau khi xác minh.
