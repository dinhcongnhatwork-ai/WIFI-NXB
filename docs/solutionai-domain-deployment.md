# Cấu hình domain solutionai.com.vn

Ngày cấu hình: 24/10/2026. Cloudflare Tunnel do người vận hành tự kết nối.

## Domain và origin

| Mục | Giá trị |
|---|---|
| Tunnel ID | `d58e5586-4021-4ed1-af7f-1f1ed937455b` |
| Public hostname | `solutionai.com.vn` |
| Service khi cloudflared chạy cùng máy | `http://127.0.0.1:3000` |
| Service khi cloudflared chạy trên máy khác cùng LAN | `http://192.168.1.56:3000` |
| Portal | `https://solutionai.com.vn/portal` |
| Quản trị | `https://solutionai.com.vn/admin` |
| Health qua domain | `https://solutionai.com.vn/api/monitor/health` |

Trên Cloudflare Tunnel, đặt hostname trên cho toàn bộ đường dẫn (không giới hạn path). Frontend cổng3000 tự chuyển `/api/*` tới backend nội bộ `127.0.0.1:3001`; media cũng qua `/api/media/*` cùng domain. Nếu cloudflared chạy trong container bridge, `127.0.0.1` là container đó: dùng địa chỉ LAN hoặc host networking.

HTTPS kết thúc tại Cloudflare; origin nội bộ dùng HTTP. Không dùng `https://127.0.0.1:3000`. Giữ đường dẫn và query string qua Tunnel để MAC/IP/SSID và các link Hotspot được chuyển đầy đủ. Không cache `/api/*` hoặc `/portal*`; tránh trang Cloudflare Access/JS Challenge trên các đường dẫn portal, API và tài nguyên portal để captive WebView tải được.

## Cấu hình runtime đã áp dụng

```env
APP_DOMAIN=solutionai.com.vn
NEXT_PUBLIC_APP_URL=https://solutionai.com.vn
NEXT_PUBLIC_API_URL=https://solutionai.com.vn
HOTSPOT_DNS_NAME=hotspot.wifi
BACKEND_URL=http://127.0.0.1:3001
```

Hai container frontend/backend được tạo lại để nạp môi trường mới; dùng image production đã nghiệm thu. Không có thay đổi schema hoặc seed DB.

```bash
docker compose up -d --force-recreate --no-deps --no-build backend frontend
curl -H 'Host: solutionai.com.vn' http://127.0.0.1:3000/api/monitor/health
curl -I -H 'Host: solutionai.com.vn' http://127.0.0.1:3000/api/connect
```

Health phải trả `status:ok`, `mode:backend`; connect không có thông tin Hotspot phải chuyển hướng tới `https://solutionai.com.vn/portal`.

## Cấu hình Hotspot để khách chưa đăng nhập mở được portal

1. Tải file `login.html` ở thư mục gốc dự án lên đúng thư mục HTML của profile Hotspot đang sử dụng (thường `hotspot/login.html`, đôi khi `flash/hotspot/login.html`). File đã chuyển sang `https://solutionai.com.vn/portal` và giữ tham số MAC/IP/link-login/link-login-only/trial/SSID.
2. Tải và import `deploy/mikrotik-solutionai.rsc`. Script chỉ thêm/cập nhật hai rule walled garden theo comment, có thể chạy lại; không xóa phiên hoặc thiết lập DHCP/NAT hiện tại. Rule IP dùng `dst-host` để router tự phân giải các địa chỉ IPv4 hiện tại, chỉ mở TCP443.
3. Nếu từng đặt DNS static cho `solutionai.com.vn` tới IP LAN/proxy cũ, bỏ override đó để domain phân giải về Cloudflare. Không đổi `dns-name` Hotspot thành domain portal; giữ tên gateway riêng như `hotspot.wifi` (hoặc cập nhật `HOTSPOT_DNS_NAME` theo tên thực tế).
4. Profile cần có phương thức `trial` nếu dùng luồng trial hiện tại. Kiểm tra `login-by` và giới hạn trial trước khi thay đổi profile. Không import toàn bộ `hotspot_config.rsc` cũ để đổi domain; đó là snapshot cấu hình cũ.
5. Cần chiến dịch còn hiệu lực, SSID khớp và mẫu đã xuất bản để API cho phép kết nối. Giữ các bước video/điểm danh nếu mẫu yêu cầu; domain mới không bỏ các điều kiện xác thực.

Nguồn RouterOS: [Walled garden và dst-host](https://help.mikrotik.com/docs/spaces/ROS/pages/56459266/HotSpot+-+Captive+portal), [trang đăng nhập ngoài router](https://manual.mikrotik.com/docs/authentication-authorization-accounting/hotspot-captive-portal/hotspot-customisation/).

## Trạng thái xác minh

Đã kiểm tra origin với `Host: solutionai.com.vn` và forwarded protocol HTTPS: `/admin`, `/portal`, `/api/portal`, health và ảnh tĩnh đều HTTP200. Health qua frontend đến đúng backend. `/api/connect` không có thông tin phiên trả302 tới `https://solutionai.com.vn/portal`. `/api/login` nhận được yêu cầu từ origin mới và trả400 khi thiếu thông tin Hotspot (không tạo phiên giả để kiểm tra). Portal API tạo được chữ ký phiên. Cả hai container đã nạp domain mới và chạy với số lần restart0. Chromium đã mở trang đăng nhập quản trị trên hostname `solutionai.com.vn:3000` được ánh xạ về origin để kiểm tra, không có lỗi JavaScript. Ảnh `.tmp/solutionai-domain/admin-origin.png`; phép kiểm tra này không đi qua Tunnel public.

**Điều kiện để đăng nhập WiFi thực:** DB hiện có **0 chiến dịch còn hiệu lực kèm mẫu đã xuất bản**. Chưa bật hoặc xuất bản chiến dịch thay người vận hành. Router cũ tại `192.168.1.200` và gateway ghi trong cấu hình cũ `192.168.1.22` đều chưa truy cập được từ máy chủ, nên file HTML và script walled garden mới được chuẩn bị tại workspace, chưa áp dụng lên router.

Tunnel do người vận hành tự kết nối; hiện đường public còn báo1033 trước khi connector hoạt động. Phiên Internet thực cần kiểm tra từ một máy khách trên WiFi Hotspot sau khi Tunnel, cấu hình router và chiến dịch đã sẵn sàng.
