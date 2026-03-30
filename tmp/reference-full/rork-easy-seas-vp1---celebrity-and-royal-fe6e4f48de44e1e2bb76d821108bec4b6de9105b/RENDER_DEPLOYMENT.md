# Deploying to Render.com

This guide will help you deploy your Easy Seas Expo app as a static website on Render.com.

## Prerequisites

1. A Render.com account (free tier available)
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Push your code to a Git repository**
   - Commit all files including `render.yaml`
   - Push to GitHub, GitLab, or Bitbucket

2. **Create a new Static Site on Render**
   - Go to https://dashboard.render.com
   - Click "New +" and select "Static Site"
   - Connect your Git repository
   - Render will automatically detect the `render.yaml` configuration

3. **Configure Build Settings** (if not auto-detected)
   - Build Command: `npx expo export -p web --output-dir dist`
   - Publish Directory: `dist`
   - Auto-Deploy: Yes (recommended)

4. **Deploy**
   - Click "Create Static Site"
   - Render will build and deploy your app
   - You'll get a URL like: `https://easy-seas.onrender.com`

### Option 2: Manual Configuration

1. **Create a new Static Site on Render**
   - Go to https://dashboard.render.com
   - Click "New +" and select "Static Site"
   - Connect your Git repository

2. **Configure Build Settings**
   - Name: `easy-seas` (or your preferred name)
   - Branch: `main` (or your default branch)
   - Build Command: `npx expo export -p web --output-dir dist`
   - Publish Directory: `dist`

3. **Add Environment Variables** (if needed)
   - Go to "Environment" tab
   - Add any required environment variables

4. **Deploy**
   - Click "Create Static Site"
   - Wait for the build to complete

## Build Process

The build process will:
1. Install dependencies using npm
2. Export your Expo app for web using `expo export -p web`
3. Generate static files in the `dist` directory
4. Deploy those files to Render's CDN

## Routing Configuration

The `render.yaml` file includes routing rules to handle client-side routing:
- All routes are rewritten to `/index.html` for proper React Router navigation
- Static assets are cached with appropriate headers
- Expo's internal files (`/_expo/*`) are cached for 1 year

## Custom Domain

To use a custom domain:
1. Go to your site's Settings in Render dashboard
2. Click "Add Custom Domain"
3. Follow the instructions to configure your DNS

## Troubleshooting

### Build Fails
- Check that all dependencies are listed in `package.json`
- Verify the build command is correct
- Check the build logs in Render dashboard

### App Doesn't Load
- Ensure `dist` directory is set as the publish directory
- Check browser console for errors
- Verify routing rules are configured

### Assets Not Loading
- Make sure asset paths are relative
- Check that images are in the correct directory structure
- Verify cache headers are set correctly

## Files Created for Deployment

- `render.yaml` - Render.com configuration file
- `.node-version` - Specifies Node.js version to use
- `build.sh` - Optional build script
- `.gitignore` - Ensures build artifacts aren't committed

## Automatic Deployments

With the configuration provided:
- Every push to your main branch will trigger a new deployment
- Pull requests can have preview deployments
- Build failures will notify you via email

## Local Testing

To test the production build locally:
```bash
npx expo export -p web --output-dir dist
npx serve dist
```

Then open http://localhost:3000 in your browser.

## Additional Resources

- [Render Static Sites Documentation](https://render.com/docs/static-sites)
- [Expo Web Documentation](https://docs.expo.dev/workflow/web/)
- [Expo Router Web Configuration](https://docs.expo.dev/router/introduction/)
