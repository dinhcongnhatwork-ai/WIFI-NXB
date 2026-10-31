# Sửa luồng portal thử — 29/10/2026

Bản triển khai lúc 09:59 giờ Việt Nam dùng `wifimarketing:portal-flow-20261029`, image ID `sha256:a2ebc053fe86bc365a84d9ec836e326bee5fb284412992b1a8624340c3aa590b`. Giữ ảnh trước tại `wifimarketing:before-portal-auth-20261029`. Bản này đã được thay bằng [bản chuyển hướng trực tiếp lúc 11:06](portal-direct-redirect-2026-10-29.md).

## Vấn đề và thay đổi

1. API cũ trả lỗi 403 ngay khi không tìm thấy MAC trong danh sách máy khách hiện tại. Đã tái hiện trường hợp chưa thấy máy → thấy đúng máy ở lần kiểm tra sau. API mới trả `409 UNIFI_CLIENT_PENDING` và `Retry-After: 2` riêng khi WLAN/chiến dịch/ownership hợp lệ nhưng chưa có máy khách. Giao diện chờ tối đa 60 giây, có nút Thử lại; các trường hợp sai SSID/AP, thiếu ownership, video/điểm danh chưa hoàn tất vẫn bị từ chối. Không cấp phiên có chữ ký hoặc quyền Internet trong lúc chờ. Chưa thu được URL callback của lần lỗi ban đầu; dữ liệu trực tiếp xác nhận một lượt khách thử kết nối rồi ngắt, và lần kết nối lại đã hiển thị trên controller.
2. Mẫu 4 đang bật màn hình announcement ở cả ba biến thể. Đã tắt các gate của **Mẫu 4 đang lưu**, chỉ có ba cờ announcement thực sự đổi từ true sang false. Tạo revision xuất bản từ revision cũ và chỉnh tương ứng draft trong một transaction có kiểm tra version; các sửa nháp chưa xuất bản được giữ nguyên. Đối chiếu JSON xác nhận không đổi nội dung, ảnh hoặc bố cục khác.
3. Chiến dịch thử trước đó trỏ về `https://solutionai.com.vn/portal`, gây vòng về trang đầu sau cấp quyền. Theo URL người vận hành xác nhận, đã đổi đích chiến dịch thành **https://www.nxbctqg.org.vn/** qua API ứng dụng.
4. Sau khi UniFi xác nhận cấp quyền, GET `/api/connect` trả trang thành công bằng HTML, tự chuyển tới URL chiến dịch sau hai giây và có liên kết Tiếp tục. Không dùng JavaScript cho bước này. Đích lấy từ chiến dịch đã kiểm tra phía server; tham số redirect của khách không thay đích UniFi. Có `no-store`, `no-referrer` và CSP; không đổi nhánh trial MikroTik hay JSON POST `/api/login`.

Luồng mong muốn: **Mẫu 4 → Kết nối ngay → UniFi cấp quyền/đọc lại trạng thái → Kết nối WiFi thành công → website Nhà xuất bản**.

## Kiểm tra

- 95/95 kiểm thử trong 9 suite đạt; build production và TypeScript đạt.
- 7/7 kiểm thử trình duyệt đạt: chờ máy mới, dừng khi hết thời gian, lỗi xác định không tự thử lại, thử lại thủ công, một trang Mẫu 4, thông báo thành công và chuyển tới đúng website, CMS và preview video/điểm danh.
- Bản đóng gói thực gọi controller: MAC chưa có trả 409/pending; MAC thuộc SSID khác trả 403, không cấp quyền.
- Qua tên miền production, trình duyệt thấy một trang portal, 0 gate phụ, 1 nút kết nối, 0 lỗi JavaScript. API pending trả JSON409 đúng mã và health hoạt động.
- Bộ đồng bộ campaign `healthy`, một chiến dịch, không có ownership/SSID trùng hoặc site chưa sẵn sàng. Controller có một bản ghi cấp quyền từ lần thử thực của người vận hành trước khi thay revision; không tự cấp quyền hoặc ngắt máy khách để thay cho thử bằng điện thoại.
- Controller guest settings, WLAN, network giữ nguyên so với snapshot sau tạo SSID TEST. Database/Redis/MinIO/entry không khởi động lại. `.env` chỉ đổi `APP_IMAGE`. Không sửa cấu hình MikroTik/DHCP hoặc chạy migration/seed.

Ảnh, JSON đối chiếu, snapshot trước thay đổi và log nằm tại `.tmp/portal-auth-fix-20261029/`. Credential tạm đã xóa và hai container candidate đã dọn sau kiểm tra. Cần đóng cửa sổ captive cũ và mở lại để nhận revision/bundle mới; không dùng kết quả của phiên cũ để đánh giá luồng mới.

Tài liệu luồng cấp quyền của hãng: [External Hotspot API](https://help.ui.com/hc/en-us/articles/31228198640023-External-Hotspot-API-for-Authorization-Clients).

## Kiểm tra phiên thử lúc 10:38–10:45 giờ Việt Nam

Người vận hành báo portal chờ nhận diện và có Internet trước khi bấm kết nối. Kiểm tra trực tiếp xác nhận:

- Chỉ có một log kết nối của chiến dịch TEST, lúc 09:45:27, cùng một bản ghi UniFi cấp quyền 240 phút, ban đầu hết hạn lúc 13:45:27. Không có log cấp quyền mới trong lượt kiểm tra này. Vì vậy, việc dùng lại MAC đã được cấp quyền không kiểm tra được điều kiện của một khách chưa xác thực.
- MAC của phiên thử cũ còn nằm trong `guest_authorized_mac` trên AP5.2 và AP6.3. Các AP đọc thành công khác không có MAC này; AP8.3 không SSH được. AP5.2 có rule `GUESTIN` cho hai VAP TEST, chặn mặc định, chặn IPv6 và chỉ cho DNS/DHCP/portal cùng khách có quyền đi qua. Danh sách pre-auth chỉ có IP máy portal và hai IP hiện tại của tên miền portal.
- Đã thu hồi đúng một phiên TEST cũ qua controller, xác nhận bản ghi hết hạn. Do cache quyền trên hai AP vẫn còn sau khi controller xác nhận hết hạn, đã xóa đúng MAC này khỏi ipset động của AP5.2/AP6.3. Không đổi rule, cấu hình SSID, radio hoặc các MAC khác. Đọc lại ngay sau thao tác và sau hơn một phút đều không còn quyền cũ trên hai AP.
- Controller không có khách TEST đang kết nối trong các snapshot kiểm tra. Log AP6.3 ghi nhận điện thoại kết nối lại lúc 10:32 và 10:33 với RSSI khoảng -80 đến -87 dBm; sau đó AP6.3 và AP5.2 loại station sau 180 giây im lặng, lần cuối trên AP5.2 lúc 10:38:44. Điều này xác nhận điện thoại đã mất kết nối, nhưng chưa xác định được MAC/AP trong URL của trang loading người vận hành chụp.
- Đã mở cửa sổ chẩn đoán chỉ lấy đường dẫn và MAC/AP/SSID/site của callback/API portal; không thu header, cookie hoặc token phiên. Chưa thu được lượt gọi thực từ điện thoại trong cửa sổ này. Request kiểm tra chủ động tới production trả đúng HTTP409 khi MAC không tồn tại và không tạo log/cấp quyền.
- Đối chiếu trước/sau xác nhận guest settings, toàn bộ WLAN và network trên controller giữ nguyên. Không có thao tác cấu hình MikroTik. Image production vẫn là `portal-flow-20261029`; không sửa code hoặc khởi động lại dịch vụ trong lượt kiểm tra này. Worker vẫn healthy và public portal HTTP200.

**Chưa nghiệm thu luồng bằng điện thoại sau khi xóa phiên cũ.** Đã đề nghị người vận hành tắt dữ liệu di động, quên mạng TEST rồi kết nối lại để thu đúng callback và thử Internet trước khi bấm nút. Chỉ kết luận hoàn tất sau khi quan sát được khách chưa có quyền, hiển thị Mẫu 4, bấm kết nối mới cấp quyền và chuyển tới website đã cấu hình. Không dùng dữ liệu lịch sử hoặc quyền đã hết hạn để thay cho việc kiểm tra station đang kết nối.
