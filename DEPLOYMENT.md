# Deployment Guide - DigitalOcean + Cloudflare

## 1. Підготовка сервера DigitalOcean

### Створення Droplet
1. Створіть Ubuntu 22.04 LTS Droplet (мінімум 2GB RAM)
2. Підключіться через SSH: `ssh root@your-server-ip`

### Встановлення залежностей
```bash
# Оновлення системи
apt update && apt upgrade -y

# Встановлення Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Встановлення nginx
apt install -y nginx

# Встановлення PostgreSQL
apt install -y postgresql postgresql-contrib

# Встановлення Redis
apt install -y redis-server

# Встановлення PM2 (для запуску Node.js в фоні)
npm install -g pm2
```

## 2. Налаштування бази даних PostgreSQL

```bash
# Увійти в PostgreSQL
sudo -u postgres psql

# Створити базу даних та користувача
CREATE DATABASE teacher_agent;
CREATE USER teacher_user WITH PASSWORD 'your-strong-password';
GRANT ALL PRIVILEGES ON DATABASE teacher_agent TO teacher_user;
\q
```

## 3. Налаштування Cloudflare

1. Додайте ваш домен до Cloudflare
2. Налаштуйте DNS запис:
   - Type: `A`
   - Name: `@` (або `www`)
   - Content: `your-server-ip`
   - Proxy status: `Proxied` (помаранчева хмара)
3. SSL/TLS режим: **Full** або **Flexible**
   - **Flexible**: Cloudflare ↔ сервер без SSL (простіше)
   - **Full**: Cloudflare ↔ сервер з SSL (безпечніше)

Якщо обираєте **Full**, створіть Origin Certificate:
1. SSL/TLS → Origin Server → Create Certificate
2. Збережіть сертифікат і приватний ключ на сервері

## 4. Деплой додатку

### Завантажити код на сервер
```bash
# Створити директорію для проєкту
mkdir -p /var/www/teacher-agent
cd /var/www/teacher-agent

# Клонувати репозиторій (або завантажити файли)
# git clone your-repo-url .

# Або завантажити через scp з локального комп'ютера:
# scp -r /path/to/project/* root@your-server-ip:/var/www/teacher-agent/
```

### Налаштувати .env файл
```bash
cd /var/www/teacher-agent
nano .env
```

Заповніть всі необхідні змінні з `.env.example`:
```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000

OPENAI_API_KEY=your-openai-api-key
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17

LIVEAVATAR_API_KEY=your-liveavatar-key
LIVEAVATAR_AVATAR_ID=your-avatar-id
LIVEAVATAR_VOICE_ID=your-voice-id
LIVEAVATAR_CONTEXT_ID=your-context-id

LIVEKIT_URL=your-livekit-url
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret

DB_HOST=localhost
DB_PORT=5432
DB_USER=teacher_user
DB_PASSWORD=your-strong-password
DB_NAME=teacher_agent

REDIS_URL=redis://localhost:6379

INTERNAL_API_SECRET=generate-random-secret-here

APP_BASE_URL=https://yourdomain.com
```

### Збілдити проєкт
```bash
# Встановити залежності
npm install

# Збілдити фронтенд
cd web
npm install
npm run build

# Збілдити бекенд
cd ../server
npm install
npm run build

cd ..
```

## 5. Налаштування Nginx

### Скопіювати конфігурацію
```bash
# Скопіювати nginx.conf до nginx sites
cp nginx.conf /etc/nginx/sites-available/teacher-agent

# Відредагувати конфігурацію
nano /etc/nginx/sites-available/teacher-agent
```

**Змініть:**
- `yourdomain.com` → ваш реальний домен
- Якщо використовуєте **Flexible SSL** (Cloudflare), видаліть секцію SSL:
  ```nginx
  # Видаліть або закоментуйте ці рядки:
  # ssl_certificate /etc/ssl/certs/your-cert.pem;
  # ssl_certificate_key /etc/ssl/private/your-key.pem;
  ```

- Якщо використовуєте **Full SSL**, додайте Origin Certificate:
  ```bash
  # Створити файли сертифікатів
  nano /etc/ssl/certs/cloudflare-origin.pem
  # Вставити сертифікат з Cloudflare

  nano /etc/ssl/private/cloudflare-origin.key
  # Вставити приватний ключ

  # Встановити права
  chmod 600 /etc/ssl/private/cloudflare-origin.key
  ```

### Активувати конфігурацію
```bash
# Створити symlink
ln -s /etc/nginx/sites-available/teacher-agent /etc/nginx/sites-enabled/

# Видалити дефолтну конфігурацію (опціонально)
rm /etc/nginx/sites-enabled/default

# Перевірити конфігурацію
nginx -t

# Перезапустити nginx
systemctl restart nginx
```

## 6. Запуск додатку з PM2

```bash
cd /var/www/teacher-agent/server

# Запустити сервер
pm2 start dist/index.js --name teacher-agent

# Зберегти конфігурацію PM2
pm2 save

# Автозапуск при перезавантаженні
pm2 startup
# Скопіювати і виконати команду, яку покаже PM2
```

### Корисні команди PM2
```bash
# Подивитися логи
pm2 logs teacher-agent

# Перезапустити
pm2 restart teacher-agent

# Зупинити
pm2 stop teacher-agent

# Видалити з PM2
pm2 delete teacher-agent

# Подивитися статус
pm2 status
```

## 7. Налаштування Firewall

```bash
# Дозволити HTTP, HTTPS, SSH
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp  # Тільки якщо потрібен прямий доступ до Node.js

# Активувати firewall
ufw enable

# Перевірити статус
ufw status
```

## 8. Перевірка деплою

1. Відкрийте браузер: `https://yourdomain.com`
2. Перевірте health endpoint: `https://yourdomain.com/health`
3. Перевірте логи:
   ```bash
   # Nginx логи
   tail -f /var/log/nginx/teacher-agent-access.log
   tail -f /var/log/nginx/teacher-agent-error.log

   # PM2 логи
   pm2 logs teacher-agent
   ```

## 9. Оновлення додатку

```bash
cd /var/www/teacher-agent

# Завантажити нові зміни
# git pull  # якщо використовуєте git

# Збілдити
cd web && npm run build
cd ../server && npm run build

# Перезапустити
pm2 restart teacher-agent
```

## 10. Troubleshooting

### Nginx помилки
```bash
# Перевірити конфігурацію
nginx -t

# Перезапустити nginx
systemctl restart nginx

# Подивитися статус
systemctl status nginx
```

### Node.js/PM2 помилки
```bash
# Логи PM2
pm2 logs teacher-agent

# Перезапустити з очищенням логів
pm2 restart teacher-agent --update-env

# Повне перезавантаження
pm2 delete teacher-agent
pm2 start dist/index.js --name teacher-agent
```

### PostgreSQL/Redis помилки
```bash
# Перевірити статус PostgreSQL
systemctl status postgresql

# Перевірити статус Redis
systemctl status redis-server

# Перезапустити
systemctl restart postgresql
systemctl restart redis-server
```

### Cloudflare SSL помилки
- Переконайтесь, що SSL/TLS режим відповідає налаштуванням nginx
- **Flexible**: видаліть SSL сертифікати з nginx
- **Full**: додайте Origin Certificate

## Безпека

### Регулярні оновлення
```bash
# Оновлення системи
apt update && apt upgrade -y

# Оновлення npm пакетів
cd /var/www/teacher-agent
npm update
```

### Бекапи бази даних
```bash
# Створити бекап
pg_dump -U teacher_user teacher_agent > backup_$(date +%Y%m%d).sql

# Відновити з бекапу
psql -U teacher_user teacher_agent < backup_20240101.sql
```

### Моніторинг
- Налаштуйте моніторинг через PM2: `pm2 monitor`
- Або використовуйте DigitalOcean Monitoring
- Налаштуйте алерти для критичних помилок

---

**Готово!** Ваш додаток має працювати на `https://yourdomain.com`
