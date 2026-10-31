# Luồng hiển thị portal và Reset WiFi ngày 30/10/2026

## Quy tắc vận hành

- DHCP cấp IP trước xác thực để thiết bị truy cập DNS, gateway và portal. Giữ nguyên DHCP server, pool và lease hiện tại. Có IP hoặc hiện biểu tượng WiFi không chứng minh đã có quyền Internet.
- Thiết bị chưa xác thực chỉ được dùng các ngoại lệ portal. Máy đã có phiên còn hạn được giữ quyền theo thời hạn chiến dịch; Forget/reconnect không tự thu hồi phiên. Reset WiFi buộc xác thực lại.
- Mẫu xuất bản có thể hiển thị khi controller chưa kịp thấy MAC, với `connectionPending=true`. Chỉ bỏ điều kiện có station ở bước hiển thị; site, SSID, WLAN mở, chiến dịch và ownership vẫn phải hợp lệ. Sai danh tính kết nối thực tế tiếp tục bị từ chối.
- Trước khi cấp Internet luôn kiểm tra MAC/AP/SSID/WLAN với controller. Không có lệnh cấp quyền từ bước hiển thị mẫu cho khách thường. Ngoại lệ MAC chỉ tự cấp quyền nếu được quản trị duyệt và chưa bị Reset bắt xác thực lại.
- Nếu người dùng đã bấm Kết nối mà station chưa cập nhật, trình duyệt nhận trang chờ có thử lại tối đa 8 lần, 2 giây/lần. Không báo thành công hoặc chuyển tới URL đích trước khi xác nhận được quyền.

## Reset WiFi

Nút Reset dùng API admin riêng `POST /api/campaigns/{id}/reset-wifi`, thực hiện thu hồi/kick ngay trong lượt xử lý và giữ ý định bền vững cho tác vụ nền thử lại.

1. Xác minh đúng controller/site/WLAN mở thuộc chiến dịch được quản lý.
2. Đổi epoch Reset của chiến dịch. Token portal cũ hết hiệu lực; cửa sổ hoặc URL Kết nối cũ quay về mẫu portal mới, không tự cấp lại quyền bằng token cũ. Epoch được kiểm tra thêm bên trong khóa MAC trước lệnh cấp quyền.
3. Ghi ý định thu hồi từng MAC đang trong SSID và các MAC có sổ phiên của chiến dịch. Reset bao gồm cả MAC được miễn xác thực: các máy đó phải bấm Kết nối lại một lần, sau đó tiếp tục chính sách miễn xác thực.
4. Thu hồi native guest authorization và đọc lại danh sách guest. Xóa riêng MAC đó khỏi `guest_authorized_mac` trên AP có bằng chứng phát đúng WLAN chiến dịch; đọc lại để xác nhận, rồi ngắt máy nếu vẫn nằm trong SSID chiến dịch. Nếu máy đã chuyển sang SSID không guest, chỉ xóa quyền guest cũ; không kick SSID đó. Nếu đã chuyển sang guest/WLAN khác không rõ quyền sở hữu, không tác động tùy tiện.
5. Máy ngoại tuyến được giữ ý định thu hồi và xử lý khi xuất hiện lại. AP ngoại tuyến hoặc thiếu dữ liệu WLAN được giữ trong `cachePending`; chưa báo hoàn tất việc dọn cache. Sau khi thiết bị đã bị thu hồi, tác vụ chỉ thử lại các AP còn chờ, không kick lại các máy đã xử lý. Máy bận khóa được thử lại có giới hạn; không dừng Reset của các máy còn lại.
6. API/UI báo riêng `queued`, `revoked`, `waiting`, `skipped`, `failed`, `notQueued`. Phiên đã lưu ý định được thử lại tự động. MAC chưa lưu được ý định (`notQueued`) phải bấm Reset lại; không được báo đã hoàn tất toàn bộ.

Chính sách hết hạn phiên thông thường và tùy chọn áp dụng thời hạn không thay đổi quy tắc miễn xác thực. Việc bắt cả MAC được miễn đăng nhập lại chỉ áp dụng nút Reset WiFi cưỡng bức.

## Nguyên nhân đã đối chiếu

Controller và AP ghi nhận hai máy TEST chưa được cấp quyền; AP không có MAC đó trong `guest_authorized_mac`. Vì vậy phải kiểm tra truy cập Internet với dữ liệu di động tắt, không kết luận từ DHCP hoặc biểu tượng kết nối.

Tìm thấy một MAC cũ đã sang `NXBCTQGST` (`is_guest=false`) nhưng vẫn có guest grant còn hạn, do tác vụ cũ bỏ qua mọi máy đổi SSID trước khi xóa guest grant. Bản sửa thu hồi quyền guest cũ mà không ngắt mạng chính, tránh quyền đó tự mở Internet khi máy quay về TEST.

Kiểm tra tiếp sau Reset: controller đã hết guest grant, nhưng AP vẫn giữ MAC khách cũ trong `guest_authorized_mac` khi khách đã rời mạng hoặc chuyển SSID. Vì vậy chỉ gọi unauthorize trên controller chưa đủ. Bản sửa xác thực định danh AP và khóa SSH trước khi xóa đúng MAC trong cache; không flush ipset, không reboot AP. Kiểm tra lệnh và đọc lại thành công trên AP3.1 và AP5.2 thuộc hai dòng phần cứng đang vận hành.

API hiển thị mẫu trước đây chờ `stat/sta` tối đa 60 giây dù mẫu đã xuất bản; bản sửa tách hiển thị và cấp quyền để bỏ màn hình chờ toàn trang khi controller chậm cập nhật.

## Kết nối quản trị AP

Thư viện SSH dùng thông tin quản trị thiết bị do controller cung cấp. Chỉ kết nối IPv4 riêng trong LAN; đọc MAC của AP để khớp inventory trước khi sửa cache. Khóa host SSH được ghim theo controller/site/MAC AP vào SystemSetting; đổi khóa bất ngờ sẽ dừng thao tác và báo cần xử lý. Mỗi lệnh có giới hạn thời gian, kiểm tra khóa phiên trước khi xóa, và chờ toàn bộ thao tác song song kết thúc trước khi nhả khóa MAC. Không ghi mật khẩu vào log.

## Kiểm chứng

Đang hoàn tất kiểm tra trình duyệt và rollout. Kết quả cuối sẽ cập nhật sau triển khai.
