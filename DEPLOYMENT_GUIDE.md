# Red Ribbon Ops - Deployment Guide

## 🚀 Quick Deploy to Production

### Prerequisites
- GitHub account
- MongoDB Atlas account (database)
- Railway account (backend) OR Render/Heroku
- Vercel account (frontend)

---

## Step 1: Set Up MongoDB Atlas

1. Go to https://cloud.mongodb.com
2. Create a free cluster
3. Create a database user and get your connection string (MONGO_URL)
4. Set the environment variable DB_NAME to: `red_ribbon_ops`
5. The app will auto-create collections on first use

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
   MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
   DB_NAME=red_ribbon_ops
   JWT_SECRET=your-super-secret-jwt-key-change-this
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000  # Comma-separated, no brackets or quotes around the full value
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

4. Add environment variables:
   ```
   REACT_APP_BACKEND_URL=https://your-app.up.railway.app
   ```
   **Important:** This must be set in Vercel's project settings before deploying.
   The frontend will not be able to reach the API without it.

5. Click **Deploy**

**Your frontend will be at:** `https://your-app.vercel.app`

---

## Step 5: Update CORS

After deployment, update your backend CORS_ORIGINS:

In Railway dashboard, update environment variable:
```
CORS_ORIGINS=https://your-app.vercel.app  # Comma-separated, no brackets or quotes around the full value
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
- Ensure MONGO_URL and DB_NAME are correct

### Frontend can't connect
- Check browser console for CORS errors
- Verify REACT_APP_BACKEND_URL is set correctly
- Ensure backend health check passes: `https://your-backend.railway.app/api/health`

### Database connection fails
- Verify MONGO_URL connection string and credentials
- Ensure your IP is whitelisted in MongoDB Atlas Network Access
- Check MongoDB Atlas cluster status

---

## Post-Deployment: Clear Seed Data

After first deployment, if sample data is visible in the Request Pipeline,
run:

```bash
MONGO_URL=your-connection-string DB_NAME=red_ribbon_ops python backend/scripts/clear_seed_data.py
```

This only deletes known seed/demo orders. It will not touch real client data.

---

## Next Steps

1. **Set up custom domain** on Vercel
2. **Configure SMTP** for email notifications
3. **Set up file storage** (S3/Nextcloud) for file uploads
4. **Add more users** through the IAM page

Need help? Check the logs and let me know what error you see!
