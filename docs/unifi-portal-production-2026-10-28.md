# UniFi External Portal — triển khai production 28/10/2026

> Sau lần triển khai nền tảng dưới đây, đã build lại toàn bộ code lúc 19:00 Việt Nam. Trạng thái ảnh mới và kết quả kiểm tra xem [production refresh](production-refresh-2026-10-28.md).

## Phạm vi

Người vận hành chọn tích hợp xác thực trên UniFi để áp dụng trực tiếp theo SSID và yêu cầu thay portal mặc định bằng giao diện riêng tại `https://solutionai.com.vn`. MikroTik tiếp tục cấp DHCP, PPPoE/NAT và định tuyến; server Hotspot thử nghiệm `wmk-marketing` trên MikroTik giữ tắt.

Không sửa PPPoE, interface, bridge, DHCP, pool, DNS hay firewall MikroTik; không thêm ngoại lệ FastTrack. Dải DHCP giữ `192.168.0.20–192.168.0.255,192.168.1.2–192.168.3.254`, gateway `192.168.0.1/22`.

## Cơ chế portal

Site UniFi `m5npy6bn`, controller Network 9.4.19:

- `portal_enabled=true`, `auth=custom`, `custom_ip=192.168.1.253`.
- Dịch vụ `hotspot-entry` tại `192.168.1.253:80` chỉ nhận `/guest/s/<site>/` rồi chuyển đến callback HTTPS cùng hostname `solutionai.com.vn`.
- Callback giữ MAC/AP/SSID/site và chuyển sang `/portal` của ứng dụng. Không phục vụ form mật khẩu, voucher, Terms of Use hoặc trang chào mặc định của UniFi.
- Cho phép truy cập trước đăng nhập tới `192.168.1.253/32` và `solutionai.com.vn`; không mở toàn bộ Cloudflare/LAN.
- Ứng dụng kiểm tra MAC/AP/SSID/site thực trên controller, chiến dịch còn hiệu lực, mẫu đã xuất bản và quyền quản lý WLAN trước khi cấp phiên có chữ ký và trước khi gọi API cấp quyền.
- Bảo toàn các bước video/điểm danh; thiếu điều kiện trả lỗi, không tự chuyển sang đăng nhập thử MikroTik.
- Chỉ SSID mở/đang bật với đúng chiến dịch được bật guest policy; SSID có mật khẩu luôn bỏ qua marketing theo yêu cầu người vận hành. Không đổi security, mật khẩu, VLAN, network hoặc enabled của SSID.

Bộ đồng bộ backend chạy mỗi 15 giây để áp dụng lịch chiến dịch và khôi phục riêng trường `is_guest` do nó đã quản lý. Khi SSID đã được cấu hình portal, khách được chặn tại AP; không có bước chờ ứng dụng nhận diện từng MAC rồi sửa rule trên router. Độ trễ đổi cấu hình vẫn phụ thuộc chu kỳ đồng bộ và controller/AP; chưa đo độ trễ đăng nhập thực tế.

## Production và vận hành

`docker-compose.yml` chứa backend, frontend và `hotspot-entry`. `.env` chọn ảnh qua `APP_IMAGE`, bật `CAMPAIGN_HOTSPOT_ENABLED=true`, đặt `UNIFI_PORTAL_SERVER=192.168.1.253`. Hai vai trò ứng dụng dùng cùng một ảnh đã kiểm thử. Backend là vai trò duy nhất chạy bộ đồng bộ; frontend chuyển API tới backend.

Không chạy lại seed hoặc migration. Trạng thái sở hữu WLAN lưu trong `SystemSetting`; Redis dùng khóa để tránh hai tiến trình cùng thay đổi controller. Heartbeat: `campaign-hotspot:status`.

## Lỗi CMS đã xác định và sửa

Thao tác tái hiện: `/admin/templates` → bấm nút bút **Chỉnh sửa** trên Mẫu 4 → `/admin/templates/9b98e5ed-9532-4904-9e55-b4125b1824af/builder`.

Nội dung và iframe đã tải nhưng ancestor `.admin-tab-transition` giữ `transform` sau animation. Thành phần CMS `position:fixed` bị tính theo ancestor cao 0 thay vì viewport, làm vùng soạn thảo trắng. Lỗi tái hiện cả khi bấm từ danh sách và khi tải lại với hiệu ứng chuyển động thông thường. Phép kiểm tra trước chỉ xác nhận DOM có nội dung nên chưa bắt được chiều cao bằng 0.

Bản sửa trong `src/app/admin/layout.tsx` bỏ class animation riêng cho route CMS builder. Các trang quản trị còn lại giữ hiệu ứng cũ; không sửa dữ liệu mẫu.

Kiểm thử mới `tests/e2e/cms-navigation.spec.ts` bấm thật từ card, xác nhận vùng CMS 1440×1100, thanh màn hình và iframe nằm trong viewport, quay lại danh sách và không có API ghi dữ liệu.

## Kiểm thử trước triển khai

- 78/78 kiểm thử trong bảy suite cho chính sách campaign, worker, signed portal/authorization, ownership, campaign targeting, attendance và HTTP entry.
- TypeScript không lỗi.
- 11/11 kiểm thử trình duyệt CMS/renderer, bao gồm lỗi điều hướng mới; 12/12 kiểm thử cms-editor.
- Rà soát độc lập đã xác nhận lỗi quyền quản lý WLAN được sửa và phê duyệt thay đổi CMS.
- Bản candidate thực gọi được controller và từ chối máy khách giả bằng HTTP403; callback chuyển đúng về HTTPS public portal.

Không coi việc callback/HTTP200 hoạt động là xác thực WiFi thực đã thành công. Tại lần kiểm tra gần nhất chưa có chiến dịch và hai SSID hiện tại đều WPA PSK. Cần SSID mở/chiến dịch đã xuất bản và một thiết bị WiFi thực để kiểm tra toàn bộ luồng từ AP, nhận IP, mở portal, hoàn tất điều kiện và truy cập Internet.

## Hoàn tác

Ảnh cũ giữ tại `wifimarketing-backend:hotspot-before-20261028` và `wifimarketing-frontend:hotspot-before-20261028`. Snapshot cấu hình site, môi trường và nguồn nằm trong `.tmp/hotspot-audit-20261028/`, không đưa bí mật lên Git.

Nếu đã có SSID đang được quản lý, cần dừng cấp quyền mới và khôi phục `is_guest` thuộc quyền bộ đồng bộ trước khi tắt worker. Sau đó khôi phục riêng các trường portal site từ snapshot, dùng lại ảnh cũ và môi trường cũ. Không restore toàn bộ router/database hoặc xóa template/campaign của người vận hành.

## Đối chiếu hai phương án

Xem `docs/unifi-vs-mikrotik-portal.md` để so sánh điểm chặn, độ trễ, DHCP, FastTrack, SSID có mật khẩu và phụ thuộc vận hành. Tài liệu nhà sản xuất: [captive portal theo SSID](https://help.ui.com/hc/en-us/articles/115000166827-UniFi-Hotspots-and-Captive-Portals), [external portal và authorization](https://help.ui.com/hc/en-us/articles/31228198640023-External-Hotspot-API-for-Authorization-Clients).

## Kết quả sau chuyển production

Đã chuyển backend và frontend lúc 11:41 UTC (18:41 Việt Nam) ngày 28/10/2026 sang cùng ảnh `wifimarketing-hotspot:20261028-production`, image ID `sha256:f300d8f64c3a3b558ea2db067a9be6547aa54baaa28b7b0a510a82fe274f2df4`. Chỉ tạo lại hai dịch vụ ứng dụng bằng `docker compose up -d --no-build --no-deps --force-recreate backend frontend`; database, Redis, MinIO và controller không khởi động lại.

Kết quả kiểm tra sau chuyển:

- Health backend, frontend qua proxy, tên miền công khai và HTTP entry đều thành công. Hai dịch vụ ứng dụng và entry đang chạy, số lần tự khởi động lại bằng 0 trong thời gian quan sát.
- Trình duyệt mở `https://solutionai.com.vn/admin/templates`, bấm đúng nút **Chỉnh sửa** Mẫu 4: CMS và iframe hiển thị; khung 1440×1100 tại (0,0), transform `none`, không có lỗi JavaScript và không có API ghi template. Ảnh bằng chứng: `.tmp/hotspot-white-screen/production-fixed-click.png`; kết quả: `production-verification.log` cùng thư mục.
- HTTP entry → callback HTTPS → `/portal` trả đúng chuỗi chuyển hướng và HTTP200. Máy khách MAC giả bị API production từ chối HTTP403; không cấp quyền thử cho máy thật.
- Bộ đồng bộ đang bật, heartbeat Redis cập nhật mỗi 15 giây: `status=idle`, `campaigns=0`, `ownedWlans=0`. Không có lỗi đồng bộ tại lần kiểm tra.
- Đối chiếu controller: toàn bộ WLAN và network giống snapshot ban đầu; hai SSID WPA PSK vẫn `is_guest=false`. Portal site đọc lại đúng `auth=custom`, server `192.168.1.253` và hai ngoại lệ truy cập trước đăng nhập đã nêu trên.
- SSH đọc lại MikroTik: export cấu hình giống snapshot sau lần nạp Hotspot tắt; `wmk-marketing` vẫn disabled. Không đổi PPPoE/interface/bridge/DHCP/pool/DNS/firewall trong lần triển khai UniFi này.
- Đã xóa hai container candidate sau kiểm tra. Giữ ảnh cũ và snapshot phục vụ hoàn tác.

Phần chưa xác minh là đăng nhập qua WiFi trên thiết bị thực: hiện chưa có SSID mở hoặc chiến dịch để thực hiện phép thử đó. Không tạo SSID/campaign thử hay đổi mật khẩu hai SSID hiện có. Trước khi tuyên bố luồng WiFi hoàn tất, cần chọn SSID mở, gắn chiến dịch đang hiệu lực với mẫu đã xuất bản, rồi kiểm tra từ điện thoại: IP DHCP cũ → giao diện riêng → hoàn tất điều kiện → truy cập Internet. SSID có mật khẩu/không thuộc chiến dịch tiếp tục dùng mạng trực tiếp.
