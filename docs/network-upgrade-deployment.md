# Triển khai production ngày 22/10/2026

Đích triển khai: https://wifi.jtsc.vn. Frontend chạy cổng 3000, backend cổng 3001; middleware chuyển các yêu cầu `/api/` sang backend theo cấu hình runtime. PostgreSQL, Redis và MinIO hiện có được giữ nguyên.

## Dữ liệu và cấu hình

Đã sao lưu PostgreSQL dạng custom dump tại `.tmp/network-upgrade/deploy/database.before.dump` và cấu hình trước triển khai tại `environment.before` cùng thư mục. Thư mục và file được giới hạn quyền truy cập; không đưa vào Git hoặc Docker image.

Migration đã chạy trên bản sao database thực trước khi áp dụng production. Hai migration baseline được đánh dấu đã tồn tại; ba migration bổ sung được áp dụng bằng `npm run network:migrate`. Sau migration vẫn có 2 quản trị viên, 4 mẫu, 15 bản xuất bản và 5 phiên điểm danh.

`NETWORK_CREDENTIALS_KEY` được tạo riêng cho môi trường này. Phải sao lưu khóa cùng database để khôi phục thông tin kết nối đã mã hóa. JWT secret đã thay mới: các tài khoản cần đăng nhập lại, mật khẩu tài khoản giữ nguyên.

Theo yêu cầu người dùng, `MIKROTIK_IMPORT_LEGACY=false`. Không nhập hoặc kết nối MikroTik từ cấu hình cũ. Khi thiết bị sẵn sàng, quản trị thêm kết nối trong Cài đặt → Kết nối thiết bị.

## Thao tác triển khai

```bash
docker build -t wifimarketing-backend:latest -t wifimarketing-frontend:latest -t wifi-network-upgrade:20261022 .
docker compose up -d --no-deps --no-build backend frontend
docker tag wifi-network-upgrade:20261022 wifimarketing-monitor-collector:latest
docker compose --env-file .env --env-file monitoring/images.lock.env -f docker-compose.yml -f compose.monitoring.yml --profile monitoring up -d --no-build zabbix-db zabbix-server zabbix-web zabbix-agent2 syslog-ng monitor-collector
```

Zabbix chỉ mở giao diện nội bộ tại `127.0.0.1:8088`. Tài khoản thu thập riêng giới hạn vào nhóm host/template của ứng dụng; mật khẩu Admin mặc định đã thay. Image giám sát được khóa digest trong `monitoring/images.lock.env`. Agent 2 chạy active check; syslog mặc định chỉ nhận trên loopback cổng 5514. Xem [hướng dẫn giám sát](monitoring.md) khi cần cấu hình thiết bị gửi syslog hoặc SNMP.

## Khôi phục ứng dụng

Image trước triển khai được giữ với tag `wifi-backend:pre-network-upgrade-20261022` và `wifi-frontend:pre-network-upgrade-20261022`. Để quay lại mã cũ, gán lại hai tag `wifimarketing-backend:latest`, `wifimarketing-frontend:latest` rồi recreate hai service bằng `--no-build`. Migration bổ sung có thể giữ nguyên. Dừng collector nếu cần cô lập giám sát. Chỉ khôi phục database từ dump khi thực sự cần, sau khi đã sao lưu dữ liệu phát sinh; việc restore sẽ thay dữ liệu sau thời điểm backup.

Không ghi hoặc reboot thiết bị mạng trong quá trình triển khai. Nghiệm thu cấu hình trực tiếp trên thiết bị thử nghiệm khi có kết nối thực.

## Thiết lập thiết bị trên web

Mở **Cài đặt hệ thống** tại `/admin/settings`. Phần **Kết nối UniFi và MikroTik** cho phép thiết lập hoặc chỉnh sửa ngay tại trang này; trang `/admin/settings/connections` dùng chung biểu mẫu.

- UniFi: địa chỉ controller có giao thức/cổng, tài khoản, mật khẩu hoặc API key, site mặc định, các site giám sát và loại Controller/API.
- MikroTik: địa chỉ RouterOS REST có giao thức/cổng, tài khoản, mật khẩu và tùy chọn chứng chỉ tự ký. Có thể thêm nhiều router và chọn kết nối mặc định.
- Bấm **Lưu kết nối**, sau đó **Kiểm tra** ở dòng kết nối vừa lưu. Kiểm tra chỉ đọc thông tin thiết bị. Không cần sửa `.env` hoặc khởi động lại để áp dụng thông số mới.
- Mật khẩu/API key lưu mã hóa trong database, không trả về trình duyệt. Khi sửa kết nối, để trống mật khẩu/API key để giữ thông tin hiện có. Khóa mã hóa phía máy chủ là cấu hình triển khai riêng.

Kiểm thử bổ sung: 11 unit về API/kết nối đạt; Playwright đạt luồng thêm cả hai hãng ngay trong Cài đặt hệ thống, tải lại cấu hình, sửa địa chỉ mà giữ mật khẩu và kiểm tra đúng kết nối.

## Sửa phiên đăng nhập khi dùng HTTP nội bộ

Cookie production có cờ Secure nên không được gửi trên HTTP LAN. Trước bản sửa, dashboard truyền bearer token riêng nhưng Cài đặt và Kết nối chỉ dùng cookie; API trả 401 làm xóa phiên phía trình duyệt. API client hiện lấy token phiên từ localStorage cho các API cùng ứng dụng nếu không truyền token riêng. Không gửi token phiên tự động tới URL ngoài ứng dụng hoặc yêu cầu đăng nhập.

Kiểm tra nguồn thao tác ghi giữ nguyên bảo vệ cookie và từ chối yêu cầu trình duyệt cross-site. Với bearer token đã xác minh, cho phép proxy nội bộ đổi địa chỉ đích từ frontend sang backend; vẫn kiểm tra vai trò hiện tại trong database ở từng yêu cầu.

Kiểm thử hồi quy: hai lỗi được tái hiện bằng test trước khi sửa, sau sửa 18 unit đạt, TypeScript đạt và Playwright đạt luồng Cài đặt không có cookie với các API từ chối yêu cầu thiếu Authorization. Không hạ cờ Secure của cookie.

Đã triển khai image `wifi-network-upgrade:20261022-http-auth` cho frontend và backend. Trình duyệt production không có cookie đi từ Dashboard sang Cài đặt và tải lại trang thành công trên cả `http://192.168.1.56:3000` và `https://wifi.jtsc.vn`, không có lỗi JavaScript. Yêu cầu ghi kiểm tra bằng payload không hợp lệ trả 400 trên cả hai địa chỉ (trước sửa LAN bị 403). Kiểm tra UniFi thật trên LAN trả 502 vì controller `192.168.1.200:11443` không truy cập được; trang Cài đặt vẫn giữ phiên. Không ghi cấu hình hoặc reboot thiết bị trong lượt kiểm tra này.

## Controller UniFi Network Server 9.4.19

Người dùng đã đổi kết nối sang `https://viettuans.synology.me:8443`, site `m5npy6bn`, tài khoản `itnxb`. Mật khẩu giữ trong bản ghi mã hóa, không ghi vào tài liệu hoặc source. Đăng nhập và đọc site/thiết bị/client trực tiếp thành công mà không dùng API key.

Lỗi `api.err.InvalidObject` của nút Kiểm tra do `getControllerInfo()` gọi URL trống sau `/api/s/{site}`. Controller trả 400 cho URL này, trong khi `/api/s/{site}/stat/sysinfo` trả đúng phiên bản 9.4.19. Đã sửa ưu tiên `stat/sysinfo`, hỗ trợ `meta.server_version` của `/status` và giữ các fallback 404 đã có. Hai regression test thất bại trước sửa, sau sửa 25 unit và TypeScript đạt. Chỉ đăng nhập và đọc dữ liệu trên thiết bị thật, không thay cấu hình mạng.

Đã triển khai backend bằng image `wifi-network-upgrade:20261022-unifi-sysinfo`. Kiểm tra qua frontend production lúc 17:28 ngày 22/10/2026 (Asia/Saigon): nút Kiểm tra/API trả 200, phiên bản 9.4.19, `apiKey:false`, một site; API thiết bị trả 37 bản ghi, API client trả 130 bản ghi tại thời điểm lấy mẫu. Database đã lưu `status:online`, `lastError:null` và thời điểm đồng bộ mới.

## Phiên đăng nhập trên các trang mạng

Ảnh người dùng sau đó cho thấy trang UniFi vẫn báo chưa có kết nối. Nguyên nhân: NetworkShell gọi fetch trực tiếp khi tải danh sách kết nối/site, và networkFetch của các trang thiết bị cũng chỉ gửi cookie. Trên HTTP LAN, các yêu cầu này thiếu bearer token dù API Cài đặt đã được sửa trước đó.

Đã thống nhất `authenticatedFetch` trong `src/lib/api.ts` cho cả API JSON và networkFetch; NetworkShell cũng dùng transport này. Không gửi token hoặc connection/site sang origin khác. Các yêu cầu UniFi bổ sung trong trang chiến dịch/người dùng và yêu cầu điểm danh dùng chung transport để tránh cùng lỗi. Lỗi tải danh sách được hiển thị riêng và có nút Thử lại, không chuyển thành thông báo chưa cấu hình. Chờ cấu hình kết nối trước khi chọn site mặc định để tránh chọn site sai do tải song song.

Kiểm tra: 7 unit transport/scope đạt; các test trình duyệt trước đã yêu cầu header Authorization thay vì chấp nhận mọi yêu cầu. 8 test mạng/cài đặt đạt và test mới về lỗi tải/thử lại đạt sau khi điều chỉnh locator để loại route announcer của Next.js. API thật trả Tổng quan 37 thiết bị, topology 161 nút và quyền đọc SSID khả dụng tại thời điểm kiểm tra. Các số lượng thay đổi theo thời gian.

Đã cập nhật frontend production bằng image `wifi-network-upgrade:20261022-network-pages`. Trình duyệt không có cookie trên HTTP LAN tự chọn đúng Controller và site m5npy6bn; năm trang Tổng quan, Thiết bị, Client, Quản lý SSID và Topology đều đọc API thành công (200), không còn thông báo thiếu đăng nhập/chưa cấu hình và không có lỗi JavaScript. Lúc kiểm tra: 37 thiết bị, 121 client, 2 SSID, 157 nút topology. Ảnh tại `.tmp/network-upgrade/deploy/unifi-page-*.png`. API thống kê dashboard nâng cao vẫn được đánh dấu chưa khả dụng; dữ liệu thiết bị/client/SSID được lấy trực tiếp từ các endpoint hoạt động.
