# WeddingQR

Wedding photo upload site for guests scanning a QR code. Photos upload directly to Amazon S3.

**Live site:** https://catherineandjohn2026.org

---

## Local development (Windows)

```powershell
cd C:\Users\johnh\Documents\Programming\WeddingQR
npm install
npm start
```

Open http://localhost:3000

Create a `.env` file (see `.env.example`). Never commit `.env`.

---

## Connect to EC2

From PowerShell on your PC:

```powershell
ssh -i "C:\path\to\your-key.pem" ec2-user@108.133.107.207
```

Or use **EC2 Instance Connect** in the AWS Console.

Replace the IP with your **Elastic IP** if it changes.

---

## First-time setup on EC2

Run once after cloning the repo:

```bash
cd ~
git clone https://github.com/jleeh94/WeddingQR.git
cd WeddingQR

nano .env
# Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET, PORT=3000

npm install
pm2 start server.js --name wedding
pm2 save
pm2 startup
# Run the command that pm2 startup prints (starts with sudo env PATH=...)
```

---

## Common EC2 commands

### Go to the project

```bash
cd ~/WeddingQR
```

### Pull latest code from GitHub

```bash
cd ~/WeddingQR
git pull
```

If `package.json` changed, also run:

```bash
npm install
```

### Restart the app after pulling changes

```bash
pm2 restart wedding
```

### Check the app is running

```bash
pm2 status
curl http://localhost:3000/api/health
```

Expected: `{"ok":true,"s3Configured":true}`

### View app logs

```bash
pm2 logs wedding
```

Press `Ctrl+C` to exit logs.

### Stop / start the app

```bash
pm2 stop wedding
pm2 start wedding
```

---

## HTTPS (Caddy)

Caddy handles HTTPS and forwards traffic to the Node app on port 3000.

### Check Caddy status

```bash
sudo systemctl status caddy
```

### Restart Caddy (after config changes)

```bash
sudo systemctl restart caddy
```

### View Caddy logs

```bash
sudo journalctl -u caddy -n 50 --no-pager
```

Caddy config: `/etc/caddy/Caddyfile`

---

## Deploy updates (typical workflow)

**On your PC** — commit and push:

```powershell
cd C:\Users\johnh\Documents\Programming\WeddingQR
git add .
git commit -m "Describe your change"
git push
```

**On EC2** — pull and restart:

```bash
cd ~/WeddingQR
git pull
npm install
pm2 restart wedding
```

Then test https://catherineandjohn2026.org on your phone.

---

## Environment variables (`.env` on EC2)

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-west-1
S3_BUCKET=your-bucket-name
PORT=3000
```

After editing `.env`:

```bash
pm2 restart wedding
```

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| Site won't load | `pm2 status`, security group allows 443 (and 3000 if testing directly) |
| Upload fails | S3 CORS includes `https://catherineandjohn2026.org`, IAM has `s3:PutObject` |
| `s3Configured: false` | `.env` exists on EC2 and values are correct |
| HTTPS certificate error | DNS A record points to Elastic IP; `sudo systemctl status caddy` |
| Changes not visible | `git pull` on EC2, `pm2 restart wedding`, hard-refresh browser |

---

## Useful one-liners

```bash
# Full deploy on EC2
cd ~/WeddingQR && git pull && npm install && pm2 restart wedding

# Health check
curl http://localhost:3000/api/health

# See what's using port 3000
sudo ss -tlnp | grep 3000
```
