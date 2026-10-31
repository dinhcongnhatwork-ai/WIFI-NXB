# Portal UniFi và Hotspot MikroTik trong mạng hiện tại

Phạm vi so sánh là hệ thống đang dùng UniFi AP, MikroTik CCR2004 và LAN chung `192.168.0.0/22`. Đây không phải kết luận rằng một sản phẩm luôn tốt hơn sản phẩm còn lại.

| Tiêu chí | Portal tại UniFi | Hotspot tại MikroTik |
| --- | --- | --- |
| Điểm áp dụng xác thực | Theo SSID trên UniFi | Theo interface/VLAN/bridge trên router |
| Chọn đúng SSID chiến dịch | Có thể bật captive portal trực tiếp cho SSID | Với AP UniFi cùng bridge, cần phân tách luồng hoặc đồng bộ MAC–SSID |
| Độ trễ khi khách kết nối | Khi SSID đã bật portal, không cần chờ ứng dụng phân loại MAC rồi sửa rule router | Phương án MAC–SSID trên bridge chung có khoảng chờ nhận diện; khách có thể truy cập trước khi bị chặn |
| Giữ DHCP và dải IP hiện tại | Giữ MikroTik cấp DHCP như hiện nay | Có thể giữ DHCP với cấu hình Hotspot phù hợp, không chạy wizard tạo lại mạng |
| SSID có mật khẩu, LAN dây | Không áp portal nếu không bật guest policy cho các SSID đó | Hotspot trên bridge chung có thể ảnh hưởng cả LAN nếu không giới hạn đúng |
| FastTrack trên CCR2004 | Không phải sửa FastTrack để AP thực thi portal | Phải tính tới FastTrack bỏ qua Hotspot và các kết nối đang tồn tại |
| Hệ AP hỗn hợp hoặc khách qua dây | Cách tích hợp này phục vụ SSID trên UniFi AP | Thuận tiện quản lý tại gateway khi nhiều loại AP/thiết bị đi qua cùng router |
| Phụ thuộc khi cấp quyền mới | UniFi Controller/API, ứng dụng portal và đường tới domain phải hoạt động | Router và portal marketing phải hoạt động; phương án đọc SSID từ UniFi vẫn cần controller |
| Quản lý hạn phiên | Có qua API UniFi; bản tích hợp này giới hạn theo thời gian còn lại của chiến dịch, tối đa 4 giờ | Có các profile, user/session, RADIUS và cơ chế quản lý tại router |

UniFi cho phép captive portal theo WiFi SSID và External Portal Server. Client được gửi MAC, AP và SSID tới portal, rồi máy chủ cấp quyền qua Network API sau khi hoàn tất các bước yêu cầu. [Tài liệu captive portal](https://help.ui.com/hc/en-us/articles/115000166827-UniFi-Hotspots-and-Captive-Portals), [luồng external portal và authorization](https://help.ui.com/hc/en-us/articles/31228198640023-External-Hotspot-API-for-Authorization-Clients).

MikroTik Hotspot đặt trên interface; FastTrack có thể bỏ qua xử lý Hotspot. Vì vậy bảng trên phân biệt phương án router với VLAN/interface riêng và phương án nhận diện MAC trên bridge chung. [Tài liệu Hotspot](https://manual.mikrotik.com/docs/authentication-authorization-accounting/hotspot-captive-portal/), [FastTrack](https://help.mikrotik.com/docs/spaces/ROS/pages/130220087/Connection+tracking).

Với yêu cầu giữ nguyên mạng và chỉ xác thực SSID chiến dịch hiện tại, chọn UniFi External Portal giúp bỏ bước phân loại MAC để sửa rule trên MikroTik. MikroTik tiếp tục xử lý PPPoE, DHCP, NAT và định tuyến. Portal marketing vẫn là `https://solutionai.com.vn`; không hiển thị form đăng nhập mặc định của UniFi.

Bộ đồng bộ kiểm tra lịch chiến dịch định kỳ 15 giây; thời gian controller/AP áp dụng thay đổi có thể cộng thêm. Đây là độ trễ khi thay đổi cấu hình chiến dịch, khác với việc chờ nhận diện từng khách khi họ vừa kết nối WiFi. Chưa có phép đo độ trễ trên khách WiFi thực, nên không công bố số mili giây hoặc tỷ lệ cải thiện.

Để bảo toàn các SSID hiện có, chỉ SSID mở, đang bật, thuộc đúng site/WLAN của một chiến dịch còn hiệu lực và có mẫu đã xuất bản được quản lý. SSID có mật khẩu luôn bỏ qua marketing theo yêu cầu người vận hành. Không tự tạo campaign hoặc SSID để thử nghiệm.
