# Insurance Portal - NSIB

## Quick Start

1. Extract this folder
2. Open terminal in the folder
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Open http://localhost:5173 in your browser

## Deploy to Netlify

### Option 1: Drag & Drop (Easiest)
1. Run `npm run build`
2. Go to https://app.netlify.com/drop
3. Drag the `dist` folder

### Option 2: GitHub Deploy
1. Push to GitHub
2. Connect repo at Netlify
3. Build settings (auto-detected):
   - Build command: `npm run build`
   - Publish directory: `dist`

## Troubleshooting

If `npm install` fails:
```bash
npm cache clean --force
rm -rf node_modules
npm install
```

If you see TypeScript errors, run:
```bash
npm run build -- --skipLibCheck
```
