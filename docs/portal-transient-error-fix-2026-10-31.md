# Lỗi giao diện trước khi chuyển hướng WiFi — 31/10/2026

## Tình huống và bằng chứng

Người dùng báo popup có lúc hiện lỗi máy chủ trước khi thấy portal; sau khi bấm Kết nối cũng có thể thấy lỗi rồi mới tới trang đích.

Trong lượt kiểm tra, trang đích `https://www.nxbctqg.org.vn/` trả HTTP 200, không chuyển hướng trung gian và không có nội dung lỗi máy chủ. Nhật ký gần nhất của ứng dụng ghi nhận authorize thành công khoảng 3,9 giây, chưa thấy lỗi backend khớp với thông báo người dùng. Điều này không loại trừ mọi lỗi mạng hoặc trang đích ở thời điểm khác.

Đã tái hiện trong trình duyệt lỗi của giao diện:

- Portal đã hiển thị nhưng vẫn đang poll `/api/portal` vì association chưa xác minh xong.
- Người dùng bấm Kết nối, trình duyệt bắt đầu điều hướng tới `/api/connect`.
- Yêu cầu poll bị lỗi trong lúc chờ điều hướng. Catch cũ thay toàn bộ portal bằng “Lỗi kết nối máy chủ. Vui lòng thử lại.”
- Yêu cầu connect vẫn thành công; sau đó trình duyệt tới đúng URL đích.

Kiểm thử dùng MutationObserver ghi nhận thông báo lỗi xuất hiện trước redirect: bản cũ thất bại với một lần hiện lỗi, dù điều hướng cuối cùng thành công.

Đã tái hiện thêm việc một lỗi fetch hoặc phản hồi HTML 503 ngay lần tải đầu khiến bản cũ dừng và yêu cầu thử lại thủ công.

## Thay đổi

- Nút Kết nối gọi callback trước khi điều hướng; trang portal hủy fetch/poll đang chạy và bỏ qua kết quả trả về muộn.
- Lỗi mạng, phản hồi 5xx/429 hoặc JSON không đọc được được thử lại có giới hạn, tối đa ba lần liên tiếp, nghỉ một giây giữa lần thử. Mỗi yêu cầu có timeout tám giây.
- Nếu đã hiển thị portal hợp lệ, lỗi poll tạm thời không thay portal bằng màn hình lỗi. Người dùng vẫn có thể bấm Kết nối.
- Nếu chưa tải được portal sau giới hạn, hiển thị thông báo có hướng xử lý và nút Thử lại. Không poll vô hạn.
- Sai danh tính HTTP 403 vẫn được hiển thị, không tự retry hoặc bỏ qua xác thực.
- Giữ nguyên cấp quyền UniFi, token, gate và HTTP 302 tới URL chiến dịch sau khi xác minh cấp quyền thành công.

Đây là bản sửa cho các tình huống đã tái hiện; không coi đó là bằng chứng mọi lỗi native captive browser hoặc lỗi từ trang đích đều đã được loại trừ.

## Kiểm tra

110 kiểm thử chức năng liên quan đạt. Kết quả build, kiểm thử trình duyệt và triển khai được ghi bổ sung sau khi hoàn tất.

## Triển khai và xác minh

- Build production đạt kiểm tra TypeScript và tạo trang thành công.
- 14/14 kiểm thử Playwright đạt, gồm lỗi poll trong lúc điều hướng, tự phục hồi khi tải đầu thất bại, dừng retry khi lỗi kéo dài, lỗi danh tính không tự retry, client chưa xuất hiện, không cấp mạng tự động, video, điểm danh và Reset.
- Image mặc định cập nhật thành `wifimarketing:portal-redirect-clean-20261031`.
- Chỉ tạo lại container frontend. Backend và worker giữ nguyên container/image đang chạy (`wifimarketing:portal-reset-reconnect-20261031`); logic API và xác thực trong image mới kế thừa nguyên bản từ image này. Lần triển khai toàn bộ tiếp theo sẽ dùng image mặc định mới.
- Không thay cấu hình UniFi/MikroTik/DHCP, không Reset phiên hoặc cấp quyền thiết bị để kiểm tra bản vá giao diện.
- SHA-256 của ba file giao diện khớp với container frontend sau triển khai. Trang portal công khai trả HTTP 200 và tải bundle chứa thông báo retry mới.
- Đã dừng container kiểm thử riêng sau xác minh.

Cửa sổ captive đang mở từ trước có thể còn chạy JavaScript cũ; cần mở lại cửa sổ đăng nhập để tải giao diện mới. Chưa có phản hồi nghiệm thu từ điện thoại sau lần triển khai này; kết quả xác nhận lỗi đã sửa hiện là các phép thử hồi quy trên trình duyệt và kiểm tra artifact production.
