# Kiểm chứng dữ liệu topology / lưu lượng

Thời điểm kiểm tra: 23/10/2026 (Asia/Bangkok). Chỉ đọc cấu hình kết nối đã tồn tại trong PostgreSQL và gọi API đọc của controller; không import cấu hình cũ, không cập nhật thiết bị. Báo cáo không chứa địa chỉ controller, tài khoản, mật khẩu, IP hay MAC thiết bị.

## Quan sát trực tiếp

Cơ sở dữ liệu hiện có **1 kết nối UniFi**, không có kết nối MikroTik. Hai lượt đọc trả về cùng số lượng **37 thiết bị**, **18 máy khách**.

| Trường | Quan sát |
|---|---|
| UniFi thiết bị `tx_bytes`, `rx_bytes` | Có ở 22/37 thiết bị; 15 thiết bị còn lại phải hiển thị thiếu số liệu |
| UniFi thiết bị `tx_bytes-r`, `rx_bytes-r` | 0/37; cần delta giữa hai mẫu để có tốc độ |
| UniFi máy khách `tx_bytes`, `rx_bytes` | 18/18 |
| UniFi máy khách `tx_bytes-r`, `rx_bytes-r` | 18/18, cả hai giá trị chuyển được thành số hữu hạn |
| UniFi máy khách `ap_mac` | 18/18; không thấy `sw_mac` |
| `uplink` | Có ở 36/37 thiết bị |
| `port_table` | Có trường ở 37 thiết bị nhưng tổng cộng chỉ 2 hàng; không có `speed`, `poe_power`, `tx_bytes`, `rx_bytes` trên 2 hàng này |
| `radio_table` | Tổng cộng 74 hàng trên 37 thiết bị |
| `wan1` | Không có ở cả 37 thiết bị; không tạo nút Internet suy đoán |
| MikroTik interface / Hotspot | Chưa kiểm chứng thực tế vì chưa có kết nối được cấu hình |

## Ánh xạ đang triển khai

- UniFi station: `tx_bytes` / `tx_bytes-r` → tải xuống, `rx_bytes` / `rx_bytes-r` → tải lên (góc nhìn AP gửi/nhận với máy khách).
- MikroTik Hotspot: `bytes-out` → tải xuống, `bytes-in` → tải lên.
- Cổng UniFi phía cha: TX = tải xuống thiết bị con; uplink phía con: RX = tải xuống từ cha. Tốc độ/PoE vẫn giữ khi cổng không có bộ đếm; ưu tiên bộ đếm thật từ client hoặc uplink thay thế. Không dùng tổng thiết bị giả làm lưu lượng uplink.
- MikroTik interface chưa xác định được vai trò WAN/LAN bằng default route: `perspective: interface`, giá trị hai trường lưu lượng tương ứng **TX / RX của interface**, không gọi là tải xuống/tải lên của người dùng và không cộng vào tổng người dùng. Hotspot và các mẫu còn lại mang `perspective: user`.
- WAN UniFi chỉ tạo khi gateway báo `wan1` có địa chỉ khác `0.0.0.0` và bằng chứng trạng thái up. Nút/cạnh đều đánh dấu “suy ra”; dữ liệu khảo sát hiện tại không tạo WAN. MikroTik chưa tạo WAN vì chưa có bằng chứng default route.
- Bộ đếm giữ đơn vị byte; `downloadBps` / `uploadBps` trả về **bit/giây**. Trường rate từ controller được đổi byte/giây → bit/giây.

Đã xác nhận **sự hiện diện của trường** bằng API thật. Chưa đối chiếu các chiều tx/rx và đơn vị rate với giao diện UniFi gốc hoặc thử tải có kiểm soát; chưa thể nghiệm thu sai lệch ≤ một chu kỳ đo theo P0/P2. Không được diễn giải báo cáo này thành chứng nhận chiều và đơn vị đã đo thực tế.

## Kiểm chứng tự động

16 kiểm thử Vitest của topology/lưu lượng/cache đã chạy đạt: mẫu đầu, thiếu trường, tốc độ 0 thật, rate trực tiếp, delta và đơn vị bit/giây, reset, đổi phiên, mẫu cũ, giữ metadata, không tạo kết nối giả, cache 3 giây / lịch sử 120 giây, chia sẻ request và tách biệt site, chiều uplink/port, cổng chỉ có metadata không làm mất rate, giữ góc nhìn interface và WAN có bằng chứng.

Lệnh: `npx vitest run tests/network-topology.test.ts tests/network-traffic.test.ts tests/network-traffic-cache.test.ts`.

## Bổ sung giám sát thật ngày 24/10/2026 (Asia/Bangkok)

Kiểm tra chỉ đọc từ PostgreSQL và Zabbix API hiện có, không thay cấu hình nguồn: Zabbix trả phiên bản **7.0.32**. Trong tối đa ba target đã có ánh xạ, lấy thử một AP với cửa sổ một giờ: `available` có **66 mẫu**, chất lượng fresh; `cpu.percent` không có mẫu đo và được trả quality missing (không thay bằng 0), đồng thời đọc được **hai ngưỡng trigger**. Không đưa tên host, IP, MAC hoặc thông tin xác thực vào báo cáo. Kết quả chi tiết: `.tmp/ui-redesign/monitor-live-validation.json`.
