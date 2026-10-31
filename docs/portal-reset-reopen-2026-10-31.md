# Kiểm tra mở lại portal sau Reset/hết hạn — 31/10/2026

## Phạm vi và kết quả

Người dùng báo sau Reset chiến dịch, iPhone vẫn giữ IP nhưng mất Internet và không tự mở cửa sổ xác thực. Không thay đổi MikroTik, DHCP, bridge, PPPoE, WLAN hoặc cấu hình guest của UniFi trong lượt xử lý này.

Đã triển khai bản vá tương thích callback UniFi thiếu SSID. Chưa nghiệm thu được việc iPhone tự mở lại popup sau Reset/hết hạn: MAC trong ảnh không có trên các AP phản hồi lúc kiểm tra, và chưa nhận được lượt thử HTTP từ điện thoại. Không coi kiểm thử HTTP từ máy chủ là kiểm thử đường truyền guest hoặc bằng chứng popup hoạt động.

## Bằng chứng

- AP8.1 có luật redirect HTTP/HTTPS/DNS cho guest chưa xác thực. Danh sách cho phép trước xác thực có địa chỉ portal nội bộ và hai A record công khai.
- Truy vấn HTTP tới redirector của AP trả callback `/guest/s/<site>` không có `ssid`. Đây là truy vấn từ máy chủ, không phải gói tin của điện thoại trong ảnh; nó chứng minh một dạng callback cần tương thích, chưa chứng minh đó là nguyên nhân duy nhất của sự cố người dùng.
- Handler cũ bắt buộc SSID và trả 400. Trước triển khai, thử callback thiếu SSID với một kết nối marketing đang tồn tại trả 400 ở nội bộ và tên miền công khai.
- Sau triển khai, cùng phép thử đọc trả 302 tới `/portal`, đúng MAC/AP/SSID, khoảng 2,5–2,7 giây. Không gọi authorize, không Reset hoặc ngắt người dùng để thử.
- Một AP khác bị timeout SSH; nhật ký dọn cache vẫn có công việc chờ. Không xử lý bằng reboot AP/switch hoặc thay cấu hình mạng.

## Thay đổi

- Khi callback thiếu SSID, đọc kết nối thực tế qua SSH được xác thực và pin host key của đúng AP quản lý.
- Chỉ suy ra SSID khi đúng MAC xuất hiện trên đúng VAP đang chạy, được controller khai báo là guest. Không chọn chiến dịch mặc định và không cấp Internet trong bước này.
- Khi AP chưa nhận diện được thiết bị, trang chờ tự thử lại có giới hạn; không lặp vô hạn. Danh tính không khớp bị từ chối.
- Callback trả `Cache-Control: no-store` để tránh dùng lại chuyển hướng cũ.

## Reset và thời hạn

Đã kiểm tra luồng chung thu hồi native guest grant, xóa cache MAC có phạm vi, rồi gửi `kick-sta` cho thiết bị vẫn thuộc SSID chiến dịch. Kiểm thử xác nhận Reset vô hiệu token cũ và cần lần bấm Kết nối mới, không tự cấp lại Internet khi tải trang. Kiểm thử thời hạn 30/60 phút xác nhận lưu và gửi đúng thời lượng; truy cập lại không kéo dài deadline.

Chính sách production đang là 240 phút. Phiên đang hoạt động có thời lượng native UniFi và ledger cùng 240 phút, deadline lệch khoảng 3 giây. Không đổi chính sách này trong lượt xử lý.

Việc thu hồi quyền không cần thu hồi DHCP lease. Giữ IP sau Reset là đúng. Popup do hệ điều hành phát hiện captive network, không phải cửa sổ có thể được server đẩy trực tiếp lên điện thoại. Apple mô tả cơ chế probe khi tham gia mạng và giới hạn của chặn lưu lượng khi phiên hết hạn: https://developer.apple.com/news/?id=q78sq5rv . Apple cũng lưu ý lựa chọn “Without Internet” có thể tắt Auto-Login: https://support.apple.com/en-us/102554 . Không thêm DHCP Option 114 vì DHCP dùng chung và yêu cầu giữ nguyên cấu hình DHCP.

## Xác minh và triển khai

- 130/130 kiểm thử unit/integration liên quan đạt.
- 5/5 kiểm thử trình duyệt đạt: Reset, báo Reset một phần, một nút kết nối, redirect không JavaScript và phiên cấp quyền chậm.
- Image: `wifimarketing:portal-reopen-20261031`, kế thừa `wifimarketing:portal-flow-timer-20261031`.
- Chỉ tạo lại hai container ứng dụng backend/frontend. Không restart controller/AP hoặc hạ tầng mạng.
- Cần lượt thử thực tế: kết nối WIFI MARKETING, tắt dữ liệu di động, sau Reset mở HTTP captive probe. Nếu HTTP về portal nhưng không tự có popup, cần xử lý/đối chiếu hành vi captive detection của điện thoại; nếu HTTP treo, tiếp tục bắt đường guest trên AP thực tế.
