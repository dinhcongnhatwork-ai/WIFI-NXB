# MikroTik: nhiều thiết bị, sơ đồ tự cập nhật và kết nối theo cổng

Áp dụng cho hệ thống gồm nhiều thiết bị RouterOS, ví dụ 2 router, 1 core switch và 4 access switch. Không giới hạn hoặc tạo cứng bảy thiết bị. Đã triển khai production ngày 29/10/2026; xem `docs/topology-monitor-deployment-2026-10-29.md`.

## Thêm thiết bị

Mở **MikroTik → Thiết bị MikroTik → Thêm thiết bị**, hoặc nút **Thêm thiết bị** ngay trên sơ đồ. Khai báo tên, địa chỉ REST, tài khoản, mật khẩu và vai trò **Router / Core switch / Access switch**. Model và vị trí là tùy chọn. Chọn RouterOS cho các thiết bị hiện tại.

Lưu cấu hình xong, ứng dụng chuyển về **Sơ đồ toàn bộ MikroTik**. Thiết bị mới được đọc từ danh mục hiện tại và tự xuất hiện, không phải vẽ nhánh bằng tay. Chỉ thiết bị xác nhận online mới vào sơ đồ. Thiết bị chưa đọc được hoặc ngoại tuyến vẫn quản lý tại danh mục kết nối; không giả trạng thái online.

Mật khẩu tiếp tục được mã hóa phía máy chủ; sửa thiết bị mà để trống mật khẩu sẽ giữ thông tin đã lưu. Chỉ ADMIN được thêm/sửa/xóa cấu hình. VIEWER xem sơ đồ; các quyền vận hành hiện có được giữ nguyên.

## Sơ đồ và cổng kết nối

- `/admin/mikrotik/topology?scope=fleet`: sơ đồ tổng, tự lấy mọi kết nối MikroTik đã lưu. Bộ chọn cho phép chuyển sang một thiết bị cụ thể để quản trị riêng.
- Các thiết bị được định danh bằng connection ID; ID cổng nội bộ trùng nhau giữa các thiết bị không bị trộn.
- Đối chiếu MAC phần cứng và địa chỉ quản lý để nhận ra thiết bị láng giềng đã khai báo; không dùng tên/model để đoán dây nối. IP trùng hoặc MAC mâu thuẫn không bị ghép tùy tiện.
- RouterOS `/ip/neighbor` cung cấp thiết bị và cổng; khi báo cả `bridge,ether7`, ứng dụng ưu tiên cổng vật lý được xác nhận. Nếu chỉ biết bridge/VLAN, biểu diễn là quan hệ logic.
- Dữ liệu phát hiện hai chiều của cùng cáp/cặp cổng được gom thành một đường trên cây; bảng chi tiết vẫn giữ báo cáo tại cả hai thiết bị. Cáp song song khác cặp cổng được giữ riêng.
- Sơ đồ chỉ hiển thị hạ tầng MikroTik online. Không đọc ARP, DHCP, bảng MAC bridge, hotspot active hay UniFi Controller để dựng sơ đồ; không hiển thị máy khách và thiết bị khác hãng.
- Cổng không là thẻ riêng: liên kết hạ tầng giữ tên cổng nguồn/đích, loại liên kết và bằng chứng; bảng cổng vẫn nằm trong chi tiết thiết bị.
- Chọn switch → **Cổng & kết nối** để xem cổng tại switch, thiết bị phía bên kia, cổng phía bên kia nếu nguồn có báo, cùng bằng chứng thu thập. Ví dụ `ether7 → Access switch 2 / sfp1`.
- Trên thẻ có số láng giềng và số cổng vật lý nối AP đã xác định. Khi thu thập lỗi, các số chưa biết hiển thị dấu `—`.
- Cây và danh sách cùng chỉ hiển thị MikroTik online; thông tin cổng chuyển vào bảng chi tiết, không tạo thêm thẻ cổng trên canvas.
- Thẻ router/core/access dùng bộ hình phần cứng rackmount phù hợp; màu nền trắng/xám nhạt, nhấn xanh dương và lưu lượng gửi xanh ngọc thống nhất với Monitor.

Thiết bị MikroTik mới xác nhận online qua kết nối đã lưu sẽ xuất hiện ở lần cập nhật tiếp theo. Để lấy toàn bộ cổng, CPU/RAM và láng giềng bên dưới một switch, cần lưu kết nối REST của chính switch đó. Không tự sử dụng tài khoản của router để đăng nhập thiết bị khác.

Thiết bị chưa có bằng chứng uplink vẫn hiển thị trong sơ đồ, nhưng không tự tạo dây router → core → access chỉ từ vai trò. Kết nối thật đòi hỏi Neighbor Discovery/LLDP và quyền đọc tương ứng. Láng giềng chỉ được giữ khi có nhận diện MikroTik và trạng thái online xác thực; không suy đoán online từ tên hoặc nhà cung cấp bộ thu thập.

## Toàn màn hình và màu sắc

Nút **Toàn màn hình** có cả biểu tượng và chữ trên sơ đồ lẫn trang Monitor. Hỗ trợ native Fullscreen API và chế độ phủ cửa sổ khi trình duyệt từ chối. Escape thoát, phục hồi focus và giữ phạm vi lựa chọn/zoom.

Monitor dùng một bộ màu sáng thống nhất, biểu đồ traffic nhận xanh dương/gửi xanh ngọc. Trang quản lý MikroTik bỏ các giá trị model/serial/tài nguyên mẫu khi nguồn thiếu dữ liệu. Collector phân loại router/core/access theo cấu hình đã lưu để switch không bị đếm thành router trong Monitor.

## Kiến trúc và tương thích

Không cần migration. Metadata mới nằm trong `NetworkConnection.config`: `deviceRole`, `operatingSystem`, `model`, `location`. Giá trị enum và độ dài chuỗi được kiểm tra ở backend.

Hai endpoint topology và traffic MikroTik hỗ trợ thêm `scope=fleet`. Không truyền scope này tới API quản trị, UniFi hoặc thiết bị khác. Phạm vi từng connection hiện có tiếp tục hoạt động. Mỗi endpoint thành viên được thu thập bằng connection ID đã lưu, với tối đa bốn thiết bị được đọc đồng thời. Một thiết bị lỗi không làm mất các thiết bị còn lại.

Nguồn chính thức: [MikroTik Neighbor Discovery](https://help.mikrotik.com/docs/spaces/ROS/pages/24805517/Neighbor%2Bdiscovery). Bộ icon và prompt tạo ảnh được ghi tại [SOURCES.md](../public/device-icons/SOURCES.md).

## Kiểm chứng

Có kiểm thử cho bảy thiết bị và thêm thiết bị thứ tám, phân quyền ADMIN/VIEWER, scope=fleet trên cả topology/traffic, tự cập nhật danh mục, LLDP/cặp cổng, tránh ghép nhầm MAC/IP, phản hồi lỗi từng thiết bị, giới hạn song song, ảnh alpha, fullscreen và tránh thẻ đè lên nhau. Dữ liệu kiểm thử được chặn API ở trình duyệt; không thêm thiết bị thật hoặc ghi cấu hình RouterOS trong quá trình kiểm chứng.

Ảnh và báo cáo trong `.tmp/network-fleet/`: `fleet-after.png`, `fleet-port-after.png`, `monitor-fullscreen-native.png`, `icon-contact-sheet.png`, các log kiểm thử/typecheck/build và `review.md`. Kiểm thử toàn dự án trước đợt này vẫn có các lỗi nền đã ghi trong tài liệu redesign trước; không coi toàn suite đã đạt.

Kết quả kiểm chứng: 100 bài kiểm thử tập trung đạt; 23 trường hợp trình duyệt của luồng mới và sơ đồ trước đó đạt, gồm kiểm tra thẻ không đè nhau. Nhóm Monitor hiện có và fullscreen cũng được chạy lại. Rà soát độc lập đã đóng các lỗi chọn bridge làm cổng vật lý, ghép IP khi MAC mâu thuẫn và tìm kiếm cổng đang ẩn.

## Sửa hiệu năng ngày 29/10/2026

Sơ đồ tải hạ tầng và mẫu lưu lượng interface mỗi 15 giây. Không chạy thêm lượt thu thập toàn bộ fleet mỗi 5 giây. Bộ nhớ đệm của chế độ hạ tầng tách khỏi chế độ thu thập đầy đủ; tối đa 4 thiết bị được đọc đồng thời. Giao diện lọc cả phản hồi cũ có máy khách trước khi dựng cây. Dữ liệu lưu lượng thay đổi không kích hoạt lại Dagre; trạng thái/quan hệ thay đổi mới cập nhật bố cục. Khi một thiết bị offline, không nối tắt các thiết bị hai phía qua nó.

Kiểm chứng riêng cho thay đổi này và ảnh chụp: `.tmp/mikrotik-online/`. Bộ fixture gồm 976 máy khách, thiết bị UniFi, thiết bị ngoại tuyến và 7 MikroTik online; danh sách và canvas cùng chỉ có 7 MikroTik. Không thay đổi RouterOS, database, portal hoặc triển khai production trong bước sửa mã này.

Kết quả kiểm chứng đợt sửa 29/10: 63 unit test liên quan và 6 Playwright đạt; typecheck và production build đạt. Ảnh mới: `.tmp/mikrotik-online/online-1366.png`, `online-1920.png`, `online-port-after.png`. Báo cáo và giới hạn kiểm chứng: `.tmp/mikrotik-online/verification.md`.

Bản lọc chỉ hạ tầng online đã được triển khai production cùng banner trong canvas và line traffic ngày 29/10/2026. Báo cáo: [topology-monitor-deployment-2026-10-29.md](topology-monitor-deployment-2026-10-29.md).
