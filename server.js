// server.js - Express backend for Insurance Portal (ES Module version)
// Run with: node server.js

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Data directory
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// File paths
const MANUAL_PLANS_FILE = path.join(DATA_DIR, 'manual-plans.json');
const BENEFITS_FILE = path.join(DATA_DIR, 'benefits.json');

// Helper functions
const readJSON = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return {};
};

const writeJSON = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
};

// ============================================================================
// MANUAL PLANS API
// ============================================================================

// GET /api/manual-plans - Get all manual plans
app.get('/api/manual-plans', (req, res) => {
  const plans = readJSON(MANUAL_PLANS_FILE);
  res.json({ success: true, plans });
});

// POST /api/manual-plans - Save manual plans
app.post('/api/manual-plans', (req, res) => {
  const { plans } = req.body;
  if (!plans) {
    return res.status(400).json({ success: false, error: 'Plans data required' });
  }
  
  if (writeJSON(MANUAL_PLANS_FILE, plans)) {
    res.json({ success: true, message: 'Plans saved successfully' });
  } else {
    res.status(500).json({ success: false, error: 'Failed to save plans' });
  }
});

// DELETE /api/manual-plans - Delete a specific plan
app.delete('/api/manual-plans', (req, res) => {
  const { providerKey, planId } = req.body;
  if (!providerKey || !planId) {
    return res.status(400).json({ success: false, error: 'providerKey and planId required' });
  }
  
  const plans = readJSON(MANUAL_PLANS_FILE);
  if (plans[providerKey]) {
    plans[providerKey] = plans[providerKey].filter(p => p.id !== planId);
    writeJSON(MANUAL_PLANS_FILE, plans);
  }
  res.json({ success: true, message: 'Plan deleted successfully' });
});

// ============================================================================
// BENEFITS API
// ============================================================================

// GET /api/benefits - Get all benefits
app.get('/api/benefits', (req, res) => {
  const benefits = readJSON(BENEFITS_FILE);
  res.json({ success: true, benefits });
});

// POST /api/benefits - Save benefits for a plan
app.post('/api/benefits', (req, res) => {
  const { planKey, benefits, updatedBy } = req.body;
  if (!planKey || !benefits) {
    return res.status(400).json({ success: false, error: 'planKey and benefits required' });
  }
  
  const allBenefits = readJSON(BENEFITS_FILE);
  allBenefits[planKey] = {
    ...benefits,
    _meta: {
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || 'Unknown'
    }
  };
  
  if (writeJSON(BENEFITS_FILE, allBenefits)) {
    res.json({ success: true, message: 'Benefits saved successfully' });
  } else {
    res.status(500).json({ success: false, error: 'Failed to save benefits' });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`🚀 Insurance Portal API Server running on http://localhost:${PORT}`);
  console.log(`📁 Data stored in: ${DATA_DIR}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /api/manual-plans  - Get all manual plans');
  console.log('  POST /api/manual-plans  - Save manual plans');
  console.log('  GET  /api/benefits      - Get all benefits');
  console.log('  POST /api/benefits      - Save benefits');
});