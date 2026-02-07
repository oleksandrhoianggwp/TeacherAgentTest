# Quick Deploy Checklist - DigitalOcean + Cloudflare

## 📋 Швидка інструкція для деплою

### 1️⃣ На сервері (одноразово)
```bash
# Встановлення залежностей
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx postgresql postgresql-contrib redis-server
npm install -g pm2

# PostgreSQL база
sudo -u postgres psql
CREATE DATABASE teacher_agent;
CREATE USER teacher_user WITH PASSWORD 'YOUR_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE teacher_agent TO teacher_user;
\q

# Firewall
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable
```

### 2️⃣ Cloudflare (одноразово)
1. Додати домен до Cloudflare
2. DNS: A record → `@` → IP сервера (Proxied ✅)
3. SSL/TLS → **Flexible** (найпростіше) або **Full** (з Origin Certificate)

### 3️⃣ Завантаження коду
```bash
mkdir -p /var/www/teacher-agent
cd /var/www/teacher-agent

# Через SCP (з вашого комп'ютера):
scp -r C:\Users\tramb\OneDrive\Desktop\teacherAgentTest\TeacherAgentTest/* root@YOUR_SERVER_IP:/var/www/teacher-agent/

# Або через git:
# git clone YOUR_REPO_URL .
```

### 4️⃣ Налаштування .env
```bash
cd /var/www/teacher-agent
cp .env.example .env
nano .env
```

**Мінімально необхідні змінні:**
```env
NODE_ENV=production
PORT=3000

OPENAI_API_KEY=sk-...
LIVEAVATAR_API_KEY=...
LIVEAVATAR_AVATAR_ID=...
LIVEAVATAR_VOICE_ID=...
LIVEAVATAR_CONTEXT_ID=...

LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

DB_HOST=localhost
DB_USER=teacher_user
DB_PASSWORD=YOUR_PASSWORD_HERE
DB_NAME=teacher_agent

REDIS_URL=redis://localhost:6379
INTERNAL_API_SECRET=generate-random-32-chars-here

APP_BASE_URL=https://yourdomain.com
```

### 5️⃣ Білд проєкту
```bash
cd /var/www/teacher-agent

# Root залежності
npm install

# Фронтенд білд
cd web && npm install && npm run build

# Бекенд білд
cd ../server && npm install && npm run build
cd ..
```

### 6️⃣ Nginx конфігурація
```bash
# Скопіювати конфігурацію
cp nginx.conf /etc/nginx/sites-available/teacher-agent

# Редагувати
nano /etc/nginx/sites-available/teacher-agent
```

**❗ ВАЖЛИВО - змінити в nginx.conf:**
- `yourdomain.com` → ваш реальний домен

**Якщо Cloudflare SSL = Flexible:**
```nginx
# Закоментувати/видалити ці рядки:
# ssl_certificate /etc/ssl/certs/your-cert.pem;
# ssl_certificate_key /etc/ssl/private/your-key.pem;
```

**Якщо Cloudflare SSL = Full:**
1. Cloudflare → SSL/TLS → Origin Server → Create Certificate
2. Зберегти сертифікат:
```bash
nano /etc/ssl/certs/cloudflare-origin.pem  # Вставити сертифікат
nano /etc/ssl/private/cloudflare-origin.key  # Вставити ключ
chmod 600 /etc/ssl/private/cloudflare-origin.key
```
3. Оновити шляхи в nginx.conf:
```nginx
ssl_certificate /etc/ssl/certs/cloudflare-origin.pem;
ssl_certificate_key /etc/ssl/private/cloudflare-origin.key;
```

**Активувати nginx:**
```bash
ln -s /etc/nginx/sites-available/teacher-agent /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Опціонально
nginx -t  # Перевірка
systemctl restart nginx
```

### 7️⃣ Запуск з PM2
```bash
cd /var/www/teacher-agent/server
pm2 start dist/index.js --name teacher-agent
pm2 save
pm2 startup
# Виконати команду, яку покаже PM2
```

### 8️⃣ Перевірка
```bash
# Статус
pm2 status

# Логи
pm2 logs teacher-agent

# Nginx логи
tail -f /var/log/nginx/teacher-agent-error.log

# Перевірка в браузері
https://yourdomain.com
https://yourdomain.com/health
```

---

## 🔄 Оновлення проєкту (після змін у коді)

```bash
cd /var/www/teacher-agent

# 1. Завантажити новий код
# scp або git pull

# 2. Білд
cd web && npm run build
cd ../server && npm run build

# 3. Перезапуск
pm2 restart teacher-agent
```

---

## 🆘 Швидке вирішення проблем

### Nginx не працює
```bash
nginx -t  # Перевірка конфігурації
systemctl status nginx
systemctl restart nginx
```

### PM2/Node.js не працює
```bash
pm2 logs teacher-agent  # Подивитися помилки
pm2 restart teacher-agent  # Перезапуск
```

### База даних не працює
```bash
systemctl status postgresql
systemctl restart postgresql
```

### "502 Bad Gateway"
- PM2 не запущений: `pm2 start dist/index.js --name teacher-agent`
- Порт 3000 зайнятий: `lsof -i :3000` → `kill -9 PID`
- Перевірити логи: `pm2 logs teacher-agent`

### "SSL/HTTPS помилки"
- **Flexible SSL**: видалити SSL рядки з nginx.conf
- **Full SSL**: додати Origin Certificate
- Перезапустити nginx: `systemctl restart nginx`

---

## ✅ Готово!
Ваш додаток має працювати: **https://yourdomain.com**
