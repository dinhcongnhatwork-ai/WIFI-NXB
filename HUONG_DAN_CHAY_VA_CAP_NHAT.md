# Huong Dan Chay Va Cap Nhat He Thong WiFi Marketing

## 1) Chay he thong bang Docker (khuyen dung)

### Chay lan dau hoac sau khi clone code

```bash
docker compose up -d --build
```

Lenh nay se build va khoi dong:
- frontend (cong 3000)
- backend (noi bo 3001)
- postgres
- redis
- minio

### Kiem tra trang web

- Trang quan tri: https://solutionai.com.vn/admin
- Thu vien media: https://solutionai.com.vn/admin/media

## 2) Khi sua code va can apply code moi len he thong

### Cach nhanh (chi app)

```bash
docker compose up -d --build frontend backend
```

### Neu co thay doi ha tang hoac env

```bash
docker compose down
docker compose up -d --build
```

## 3) Build lai rieng Frontend

```bash
docker compose up -d --build frontend
```

## 4) Xem log de debug

```bash
docker logs -f wifi-marketing-frontend
docker logs -f wifi-marketing-backend
docker logs -f wifi-marketing-db
docker logs -f wifi-marketing-minio
```

## 5) Cap nhat DB va seed du lieu

### Seed lai tai khoan admin

```bash
docker exec wifi-marketing-backend npm run db:seed
```

### Tao/cap nhat schema DB

```bash
docker exec wifi-marketing-backend npm run db:push
```

## 6) Kiem tra nhanh API dang nhap

```bash
curl -i -X POST https://solutionai.com.vn/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
```

Neu thanh cong se tra ve `200` va co `token` trong response.

## 7) Kiem tra upload media

1. Dang nhap vao trang admin
2. Vao Media
3. Keo tha file anh/video
4. Tai lai trang, danh sach media van con (du lieu da luu tren MinIO)

## 8) Cac lenh su dung thuong xuyen

```bash
# Trang thai container
docker ps

# Khoi dong lai rieng backend
docker restart wifi-marketing-backend

# Khoi dong lai rieng frontend
docker restart wifi-marketing-frontend

# Dung toan bo stack
docker compose down
```

## 9) Luu y quan trong

- Sau khi sua code, can chay lai lenh build de apply code moi.
- Neu giao dien khong doi, hay hard refresh trinh duyet (Ctrl + Shift + R).
- Neu domain dang proxy qua Cloudflare, can dam bao origin dang tro dung server.
