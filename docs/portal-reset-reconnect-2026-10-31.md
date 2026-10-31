# Reset WiFi: kiểm chứng ngắt và kết nối lại trên AP

Ngày kiểm tra: 31/10/2026.

## Bằng chứng từ điện thoại thực tế

Điện thoại của người dùng được tìm thấy trên AP8.1, có DHCP IP, chưa được cấp quyền guest. Kiểm tra riêng MAC này bằng lệnh UniFi `kick-sta`:

- Trước lệnh: phiên AP có uptime 163 giây, chưa có quyền Internet.
- Khoảng 3 giây sau: MAC không còn trên AP.
- Khoảng 10 giây sau: thiết bị tự nối lại, uptime 3 giây, vẫn chưa có quyền Internet.
- Gói tin ghi nhận `GET /hotspot-detect.html`, AP trả HTTP 302 về portal nội bộ, portal nội bộ trả HTTP 302 tới tên miền công khai.
- Khoảng 9 giây sau probe đầu tiên, điện thoại truy cập trang đích và probe Apple nhận HTTP 200.
- Người dùng xác nhận: “Có, portal tự hiện lại”, không cần Forget trong lượt thử này.

Capture của điện thoại có SSID trong callback. Vì vậy, bản vá tương thích callback thiếu SSID trước đó không đủ để giải thích hoặc nghiệm thu sự cố Reset này.

Một lượt đối chiếu thêm quan sát thấy `unauthorize-guest` trả thành công trong khi `stat/guest` ngay sau đó còn báo quyền hiệu lực; tác vụ nền đối chiếu lại sau đó đã chuyển ledger sang waiting. Đây là ví dụ controller cập nhật không đồng thời. Không bỏ qua kiểm tra thu hồi quyền để cấp Internet sớm.

## Khoảng trống trong xử lý cũ

Luồng cũ chỉ gọi kick khi `stat/sta` còn thấy thiết bị sau bước thu hồi. Nếu telemetry mất thiết bị tạm thời, bước kick có thể bị bỏ qua. Khi đã gọi kick, phản hồi nhận lệnh từ controller được dùng để tiến tới trạng thái revoked, chưa kiểm tra thiết bị thực sự rời radio.

Đây là khoảng trống logic xác định được qua mã nguồn và kiểm thử hồi quy. Chưa chứng minh mọi lượt Reset lỗi trước đó đều xảy ra đúng nhánh này.

## Thay đổi

Thêm `reconnectUniFiGuest`, được dùng chung bởi Reset và tác vụ hết hạn:

1. Xác minh đúng AP quản lý và đúng guest WLAN của chiến dịch.
2. Đọc station hiện tại qua SSH có xác thực AP và pin host key.
3. Chỉ kick khi đúng MAC vẫn trên đúng WLAN và đã bị thu hồi quyền.
4. Không phụ thuộc riêng vào việc `stat/sta` còn trả client sau thu hồi.
5. Sau lệnh, đọc lại AP có giới hạn. Chỉ xác nhận reconnect khi MAC đã rời AP hoặc uptime của phiên radio giảm, chứng minh có phiên mới.
6. Nếu AP chưa thực hiện lệnh, giữ ý định thu hồi để worker thử lại; không báo đã hoàn tất chỉ từ acknowledgement.
7. Không kick thiết bị đã chuyển sang SSID khác. Không flush cache toàn AP, reboot AP hoặc thay đổi DHCP lease.

Popup vẫn do hệ điều hành phát hiện captive network, không phải cửa sổ server có thể đẩy trực tiếp. Lượt thực tế ở trên chứng minh điện thoại người dùng có thể mở lại portal khi được ngắt/kết nối lại đúng. Tham khảo cơ chế của Apple: https://developer.apple.com/news/?id=q78sq5rv .

## Kiểm thử

137 kiểm thử chức năng liên quan đạt, gồm ca controller mất station sau revoke nhưng AP còn kết nối, lệnh kick được nhận nhưng radio không ngắt, client nối lại quá nhanh, chuyển SSID, mất lease, Reset và thời hạn 30/60 phút.

Image triển khai: `wifimarketing:portal-reset-reconnect-20261031`, kế thừa `wifimarketing:portal-reopen-20261031`. Chỉ thay hai container ứng dụng. Giữ nguyên MikroTik, PPPoE, bridge, DHCP, cấu hình WLAN và guest access.

Không coi kiểm thử đơn vị hoặc lượt kick trực tiếp trước triển khai là nghiệm thu toàn bộ nút Reset sau triển khai. Cần ghi nhận riêng lượt chạy qua luồng mới và phản hồi trên điện thoại khi thiết bị đang kết nối.

## Xác minh sau triển khai

- 5/5 kiểm thử trình duyệt trên build mới đạt.
- Hai container backend/frontend đã chạy image mới.
- SHA-256 của ba file thay đổi khớp giữa workspace và container production.
- Trang portal công khai trả HTTP 200.
- Đã dừng container kiểm tra riêng. MAC điện thoại không còn có mặt trên AP trong thời điểm chờ kiểm tra lại luồng Reset mới; đã yêu cầu người dùng giữ kết nối để nghiệm thu tiếp. Không tự cấp Internet hoặc ngắt các thiết bị khác để thử.
