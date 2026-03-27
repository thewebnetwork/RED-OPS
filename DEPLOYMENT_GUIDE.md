# Red Ribbon Ops - Deployment Guide

## 🚀 Quick Deploy to Production

### Prerequisites
- GitHub account
- Supabase account (database)
- Railway account (backend) OR Render/Heroku
- Vercel account (frontend)

---

## Step 1: Set Up Supabase Database

1. Go to https://supabase.com/dashboard
2. Click your project: `vgmeeihmtgrapvolmmg`
3. Go to **SQL Editor** (left sidebar)
4. Copy the entire content of `/app/supabase_schema.sql`
5. Paste it into the SQL Editor
6. Click **Run** (this creates all tables, indexes, and default admin user)

✅ **Your database is now ready!**

Admin credentials are set during initial seed — see Railway environment variables.

---

## Step 2: Push Code to GitHub

```bash
# Initialize git (if not already)
cd /app
git init
git add .
git commit -m "Initial commit - Red Ribbon Ops MVP"

# Add your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/red-ribbon-ops.git
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy Backend to Railway

### Option A: Using Railway CLI (Recommended)
1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login and deploy:
   ```bash
   railway login
   railway init
   railway up
   ```

3. Add environment variables in Railway dashboard:
   ```
   SUPABASE_URL=https://vgmeeihmtgrapvolmmg.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   JWT_SECRET=your-super-secret-jwt-key-change-this
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   CORS_ORIGINS=["https://your-app.vercel.app","http://localhost:3000"]
   ```

### Option B: Using Railway Dashboard
1. Go to https://railway.app
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `red-ribbon-ops` repository
4. Railway will auto-detect Python
5. Add environment variables (same as above)
6. Deploy!

**Your backend will be at:** `https://your-app.up.railway.app`

---

## Step 4: Deploy Frontend to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository: `red-ribbon-ops`
3. Configure build settings:
   - **Framework Preset:** Create React App
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`

4. Add environment variable:
   ```
   REACT_APP_BACKEND_URL=https://your-app.up.railway.app
   ```

5. Click **Deploy**

**Your frontend will be at:** `https://your-app.vercel.app`

---

## Step 5: Update CORS

After deployment, update your backend CORS_ORIGINS:

In Railway dashboard, update environment variable:
```
CORS_ORIGINS=["https://your-app.vercel.app"]
```

---

## 🎉 You're Live!

Visit your Vercel URL and login with:
Admin credentials are set during initial seed — see Railway environment variables.

---

## Troubleshooting

### Backend won't start
- Check Railway logs: `railway logs`
- Verify all environment variables are set
- Ensure Supabase credentials are correct

### Frontend can't connect
- Check browser console for CORS errors
- Verify REACT_APP_BACKEND_URL is set correctly
- Ensure backend health check passes: `https://your-backend.railway.app/api/health`

### Database connection fails
- Verify Supabase URL and keys
- Check if SQL schema was run successfully
- View Supabase logs in dashboard

---

## Next Steps

1. **Set up custom domain** on Vercel
2. **Configure SMTP** for email notifications
3. **Set up Supabase Storage** for file uploads
4. **Add more users** through the IAM page

Need help? Check the logs and let me know what error you see!
