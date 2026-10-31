# Sửa độ trễ xác thực UniFi portal — 31/10/2026

Đã triển khai lúc **12:08 giờ Việt Nam** lên backend và frontend bằng image `wifimarketing:portal-auth-ap-20261031`, ID `sha256:3f243601c5bf84510b5ae70f1e3d3b479b82aeda1a6a9f210e263d5d4d218701`.

## Vấn đề và thay đổi

Luồng cũ chỉ chấp nhận station trong `stat/sta`, nên dù thiết bị đã vào AP và tải mẫu, nút Kết nối vẫn có thể trả trang chờ cho đến khi controller cập nhật station. Lệnh `authorize-guest` cũng thiếu `ap_mac`, và chỉ kiểm tra `authorized` ba lần trong khoảng 500 ms sau khi gửi lệnh.

Bản vá:

- Giữ hiển thị mẫu độc lập với độ trễ station trên controller. Việc xem mẫu không cấp quyền Internet cho khách thường.
- Khi bấm Kết nối, kiểm tra lại campaign/site/WLAN, chữ ký, Reset epoch, video/điểm danh và khóa phiên như trước.
- Đọc `mca-dump` từ đúng AP thuộc inventory của controller để xác nhận MAC đang ở đúng WLAN/SSID. Kết nối SSH dùng credential quản trị thiết bị từ controller, giới hạn địa chỉ LAN, ghim khóa host và xác minh MAC AP. Chỉ đọc snapshot; không thêm quyền bằng SSH.
- Dữ liệu AP dùng `vap_table[].sta_table` và định danh WLAN, không suy luận quyền từ DHCP, IP hay riêng query của trình duyệt. Controller có bằng chứng sai MAC/AP/SSID/WLAN vẫn bị từ chối. Nếu AP không truy cập được, giữ phương thức xác minh controller đã hỗ trợ; không cấp quyền cho một MAC vắng mặt ở cả hai nguồn.
- Lệnh native UniFi gửi thêm `ap_mac` đã xác minh. Tham số này được hỗ trợ trong [API client UniFi của Art of WiFi](https://github.com/Art-of-WiFi/UniFi-API-client/blob/main/API_REFERENCE.md#authorize-guest).
- Đọc lại quyền trên AP khi có thể; chờ truyền quyền có giới hạn, chịu được station tạm vắng trong bước xác nhận, không gửi lại lệnh cấp quyền trong vòng kiểm tra đó. Khóa MAC được giữ trong quá trình xác nhận.
- Sau khi xác nhận quyền, vẫn HTTP 302 trực tiếp đến URL chiến dịch: `https://www.nxbctqg.org.vn/`. Không thêm trang thành công hoặc yêu cầu bấm lần nữa. Phiên đang active không được gia hạn khi bấm lại.

## Kiểm chứng

- Các ca tái hiện thiếu AP trong lệnh cấp quyền, controller chậm liệt kê station, readback chậm và station tạm vắng đã thất bại trước bản sửa và đạt sau sửa.
- **180/180** test trong **20 suite** đạt trong đúng image triển khai, bao gồm chữ ký/ownership/gates, Reset WiFi, thời hạn phiên, miễn xác thực và walled garden.
- Sửa một kỳ vọng test Reset đã lỗi sẵn trong image cũ: implementation hiện thu hồi ngay máy truy cập được, nên kết quả đúng là `revoked: 1`. Không đổi implementation Reset trong bản vá này.
- Build production kèm kiểm tra kiểu đạt. **6/6** test trình duyệt đạt khi chạy bản build production: kết nối một lần, redirect khi tắt JavaScript, chờ có giới hạn và xử lý sai danh tính. Dev Strict Mode có thể phát sinh request kép trong fixture; kết quả báo cáo ở đây là trên server production.
- Trên AP thật: xác minh được station và quyền từ AP ngay cả khi cố ý bỏ danh sách station của controller khỏi đầu vào phép kiểm tra. Đây là phép kiểm tra nguồn bằng chứng AP, không phải đo một lượt cấp quyền mới.
- Qua domain production: request có phiên ký của một máy đang active trả **HTTP 302** đúng URL đích trong **2.527 ms**, không đổi thời điểm hết hạn. Request UniFi thiếu phiên ký bị HTTP 403.
- Trình duyệt di động qua domain production hiển thị mẫu, đúng **một** nút Kết nối, không có gate phụ và không có lỗi JavaScript.
- Campaign hotspot, session expiry và MAC exemption worker đều healthy sau rollout.

**Giới hạn nghiệm thu:** phép đo 2.527 ms là trên phiên đã active. Chưa có kết quả từ một lượt xác thực WiFi mới bằng điện thoại sau rollout tại thời điểm lập biên bản; đã yêu cầu người dùng thử lại. Không dùng phép đo này để khẳng định thời gian cấp quyền mới hoặc thời gian tải website đích.

## Phạm vi vận hành

Chỉ tạo lại `wifi-marketing-backend` và `wifi-marketing-frontend`. `.env` chỉ đổi `APP_IMAGE`. Image được tạo từ image production trước và chép đè năm file nguồn liên quan, không build toàn bộ thay đổi ngoài phạm vi trong working tree.

Đối chiếu trước/sau: cấu hình WLAN và guest portal UniFi giữ nguyên; entry/controller/database/Redis/MinIO giữ nguyên container. Không có lệnh thay cấu hình MikroTik, PPPoE, bridge, interface hoặc DHCP; không reboot AP hoặc ngắt các phiên đang hoạt động để thử nghiệm.

Image quay lui còn giữ: `wifimarketing:portal-reset-20261030`. Log build/test, snapshot riêng, hash source và ảnh kiểm tra nằm trong `.tmp/portal-20261031/`; dữ liệu này có thông tin vận hành và không được commit.
