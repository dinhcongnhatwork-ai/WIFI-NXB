# Sửa và đổi Topology sang sơ đồ cây — 24/10/2026

## Nguyên nhân màn hình trắng

Đọc controller đang cấu hình thành công: 37 AP, 118 máy khách, 155 node và 133 liên kết. Trong 15 liên kết giữa AP có một cặp khai báo uplink qua lại. Đây là dữ liệu controller báo cáo; việc bố trí sơ đồ phải xử lý được chu trình.

Thuật toán cũ tăng rank theo cạnh qua từng vòng lặp. Chu trình đẩy vị trí AP tới y=10.545 px, hàng ngang trải tới x=6.440 px. Căn khung trước khi đo đầy đủ rồi chỉ dựng node trong viewport khiến màn hình thấp không có node dù API vẫn có dữ liệu. Bản production cũ đã được tái hiện với cùng dữ liệu controller: cao 768/900 px không dựng node nào, cao 1.100 px chỉ dựng 2 node.

## Bố cục cây theo ảnh tham chiếu

Tham chiếu người vận hành: [cây mạng phân cấp](https://fptcloud.com/wp-content/uploads/2022/03/Cau-truc-hinh-cay-gan-tuong-tu-nhu-cau-truc-hinh-sao.jpg).

- Thiết bị cha nằm phía trên, căn giữa các nhánh con. Dùng layout Dagre trên DAG thu gọn của các thành phần liên thông mạnh (Tarjan). Giữ cả hai cạnh AP khai báo qua lại; chúng đi qua cổng ngang giữa các AP cùng thành phần.
- Giữ toàn bộ node và cạnh có bằng chứng; không tạo gateway, switch hoặc WAN giả. Với một rừng nhiều nhánh chưa biết cha chung, thêm gốc “Sơ đồ mạng” được ghi rõ là nhóm hiển thị. Các nét chấm của nhóm mang bằng chứng `layout.organization`, không được coi là liên kết vật lý hay có lưu lượng.
- Các AP không có liên kết hạ tầng được gom vào nhánh “AP chưa rõ uplink”. Bấm để mở các AP và xem danh sách thiết bị. Máy khách vẫn gom dưới AP hoặc theo SSID, mở tối đa 30 máy khách mỗi cụm. Thiết bị backend đánh dấu chưa rõ kết nối vẫn ở khay riêng.
- Dùng icon và nhãn gọn, giữ đúng ba PNG người vận hành cung cấp. Đường nối gấp khúc bo góc, thống kê và toolbar được thu gọn để sơ đồ xuất hiện sớm hơn trên laptop.
- Cung cấp kích thước khởi tạo của node; đợi internals đo xong rồi căn khung và bật culling. Không dựa vào cờ `nodesInitialized` bị cũ của controlled ReactFlow khi ứng dụng không phản hồi dimension qua `onNodesChange`. Chỉ căn lại khi node/vị trí/liên kết thay đổi; poll lưu lượng không kéo viewport về ban đầu. Sơ đồ được căn gần mép trên để gốc cây không nằm dưới khoảng trống lớn.

## Dữ liệu và kiểm tra

Bản dữ liệu controller lưu riêng tại `.tmp/topology-debug/real-topology.json`; dùng lại trong trình duyệt để so sánh cùng đồ thị. Các kiểm tra UI dùng fixture xác thực, không tạo phiên quản trị hoặc sửa cấu hình controller.

Sau bố cục cây, cùng dữ liệu dựng 30 node ở cả ba viewport 1366×768, 1366×900 và 1366×1100: 23 AP, 5 cụm khách và 2 nhóm hiển thị. 11 AP nằm trong nhánh mở rộng “AP chưa rõ uplink”; 3 AP khác nằm trong khay chưa rõ kết nối. Toàn bộ 37 AP và 118 máy khách được giữ trong dữ liệu. Ảnh trước/sau ở `.tmp/topology-debug/`.

Unit kiểm tra chu trình, căn thiết bị cha giữa các nhánh, vị trí ổn định khi đổi thứ tự dữ liệu và nhóm AP chưa biết uplink mà không sinh thiết bị vật lý giả. Unit: **279 đạt, 7 bỏ qua** do cần DB kiểm thử riêng. Browser kiểm tra ba chiều cao laptop, mở nhóm AP, đúng các icon, cây gateway → switch → AP → máy khách, và giữ zoom qua poll lưu lượng. Typecheck, kiểm tra bảng màu và diff whitespace đạt.

## Nghiệm thu production

Image `2286e235d718` build thành công và cả 7 module Topology trong image khớp workspace. **33 E2E đạt** trên image production ở cổng 3102. Benchmark Headless Chromium với 300 client, 150 cạnh động / 1.500 hạt đạt **54.91 FPS**, p95 frame **16.8 ms**, max frame **466.6 ms**; vẫn có frame dài khi browser xử lý công việc nặng. Đây là fixture trên máy thực thi, không phải cam kết FPS trên mọi thiết bị. Xuất PNG thành công.

Đã khởi động lại frontend/backend bằng image mới, giữ cấu hình domain `solutionai.com.vn`. Health ở localhost và qua public domain trả HTTP 200, mode backend; truy vấn DB kiểm tra kết nối đạt. Cả hai container running, restart count 0. **5 E2E qua public domain đạt**, gồm bố cục cây, ba chiều cao laptop, mở nhánh AP, icon và giữ zoom qua poll.

Đọc lại controller sau khi triển khai: **37 AP, 112 client, 149 node, 127 liên kết**, không có warning. So sánh UI trên public domain dùng dữ liệu mới này với xác thực fixture; không thay đổi controller hay tạo phiên quản trị. Ảnh `.tmp/topology-debug/production-tree-768.png`, `production-tree-900.png`, `production-tree-1100.png`; log `.tmp/topology-debug/public-real-data.log`. Các counter/client có thể thay đổi theo kết nối thực tế.

Image cũ có tag rollback, ghi tại `.tmp/topology-debug/rollback.json`. Container kiểm thử cổng 3102 đã dừng sau nghiệm thu. Không thay đổi cấu hình router, chiến dịch hoặc DB schema.
