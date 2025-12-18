# Bloom Filter Deployment & Activation Guide

## Overview

The Bloom Filter system for the Ares AntiCheat System is now **fully implemented and ready for deployment**. This guide explains how to activate and verify the integration.

---

## ✅ Pre-Deployment Checklist

- [x] **Core Implementation** - Bloom Filter classes in `backend/src/utils/bloomFilter.ts`
- [x] **Services Created** - Deduplication and threat tracking services
- [x] **Persistence Layer** - Disk storage and recovery
- [x] **API Integration** - 15+ new endpoints across all routes
- [x] **Server Integration** - Auto-initialization and periodic save
- [x] **TypeScript Compilation** - ✅ All files compile without errors
- [x] **Documentation** - 3 comprehensive guides
- [x] **No Breaking Changes** - 100% backward compatible

---

## 📦 Installation & Activation

### Step 1: No Additional Installation Needed
The Bloom Filter implementation **does not require any additional dependencies**. It uses only:
- Node.js built-ins (`crypto`, `fs`)
- Existing Express.js
- Existing MongoDB
- Existing TypeScript

### Step 2: Rebuild Backend (if needed)
```bash
cd backend
npm install  # Should have no changes
npm run build
```

### Step 3: Start the Backend

```bash
# Development mode
npm run dev

# Production mode
npm run build && npm start
```

**Expected Startup Output:**
```
Ares backend listening on http://localhost:3000
✓ Bloom Filters initialized and state loaded
✓ Periodic persistence scheduled
```

### Step 4: Verify Integration

Check that Bloom Filters are active:
```bash
curl http://localhost:3000/api/admin/bloom-filters/stats
```

**Expected Response:**
```json
{
  "deduplication": {
    "eventFilter": {
      "totalBits": 80000,
      "bitsSet": 0,
      "percentFull": "0.00%",
      "elementCount": 0,
      "hashCount": 3,
      "estimatedFalsePositiveRate": "0.0000%"
    },
    "suspiciousFilter": { ... },
    "uptime": 12345,
    "willResetIn": 3600000
  },
  "suspiciousPlayers": { ... },
  "storage": {
    "total": 0,
    "files": {}
  },
  "timestamp": 1702814400000
}
```

---

## 🚀 Usage Examples

### Test Event Deduplication

```bash
# Send first event
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "player1",
    "eventType": "mouseMove",
    "timestamp": 1702814400000,
    "deltaX": 10,
    "deltaY": 5,
    "speed": 2.5
  }'
# Response: 201 Created

# Send duplicate (same parameters)
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "player1",
    "eventType": "mouseMove",
    "timestamp": 1702814400000,
    "deltaX": 10,
    "deltaY": 5
  }'
# Response: 409 Conflict (Duplicate detected!)
```

### Test Threat Flagging

```bash
# Report detection
curl -X POST http://localhost:3000/api/detections \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "player1",
    "cheatType": "Aimbot-Speed",
    "cheatScore": 85,
    "timestamp": 1702814401000
  }'
# Response: 201 Created (Player auto-flagged)

# Check threat profile
curl http://localhost:3000/api/detections/player/player1
# Response: Player threat information
```

### Test Admin Functions

```bash
# View statistics
curl http://localhost:3000/api/admin/bloom-filters/stats

# Save to disk
curl -X POST http://localhost:3000/api/admin/bloom-filters/save

# Reset filters
curl -X POST http://localhost:3000/api/admin/bloom-filters/reset-all
```

---

## 📊 Monitoring & Maintenance

### Daily Monitoring

Check these metrics daily:
```bash
# Quick health check
curl http://localhost:3000/api/admin/bloom-filters/stats | jq '.deduplication.eventFilter.estimatedFalsePositiveRate'

# Monitor player threats
curl http://localhost:3000/api/admin/bloom-filters/stats | jq '.suspiciousPlayers'
```

### Weekly Tasks

1. **Review Statistics**
```bash
curl http://localhost:3000/api/admin/bloom-filters/stats | jq '.' > bloom-filter-stats-$(date +%Y%m%d).json
```

2. **Check Disk Usage**
```bash
du -sh ./bloom-filter-data/
```

3. **Verify Auto-Save**
```bash
ls -lah ./bloom-filter-data/
```

### Monthly Maintenance

1. **Archive Statistics**
```bash
tar czf bloom-filter-stats-$(date +%Y%m).tar.gz bloom-filter-data/
```

2. **Performance Review**
- Check false positive rates
- Review duplicate detection effectiveness
- Monitor threat classification accuracy

3. **Backup**
```bash
cp -r ./bloom-filter-data ./bloom-filter-data.backup-$(date +%Y%m%d)
```

---

## 🔍 Troubleshooting

### Issue: Bloom Filters Not Initializing

**Symptoms:** No "✓ Bloom Filters initialized" message in logs

**Solution:**
```bash
# 1. Check directory permissions
ls -la ./bloom-filter-data/

# 2. Create directory if needed
mkdir -p ./bloom-filter-data

# 3. Check logs
grep -i "bloom" ./server.log
```

### Issue: High False Positive Rate

**Symptoms:** `estimatedFalsePositiveRate` > 1%

**Solution:**
```typescript
// In deduplicationService.ts, increase filter size:
new BloomFilter(50000, 3)  // Increase from 10000 to 50000

// Or increase hash functions:
new BloomFilter(10000, 5)  // Increase from 3 to 5
```

### Issue: Persistence Not Working

**Symptoms:** Data lost after server restart

**Solution:**
```bash
# 1. Check permissions
chmod 755 ./bloom-filter-data/
chmod 644 ./bloom-filter-data/*.json

# 2. Test save/load
curl -X POST http://localhost:3000/api/admin/bloom-filters/save
curl -X POST http://localhost:3000/api/admin/bloom-filters/load
```

### Issue: Duplicate Detection Too Aggressive

**Symptoms:** Legitimate events marked as duplicates

**Solution:**
```typescript
// In deduplicationService.ts, reset more frequently:
resetIntervalMs: 600000  // 10 minutes instead of 1 hour

// Or increase filter size:
new BloomFilter(50000, 3)  // More capacity
```

---

## 🔧 Configuration

### Production Recommendations

```typescript
// For high-volume scenarios (>10k events/hour)
// deduplicationService.ts
new BloomFilter(50000, 4)    // Larger, more hash functions

// For strict deduplication
resetIntervalMs: 600000      // Reset every 10 minutes

// In server.ts, persist more frequently
setInterval(..., 300000)     // Save every 5 minutes
```

### Conservative Approach

```typescript
// For low-volume scenarios (<1k events/hour)
// deduplicationService.ts
new BloomFilter(5000, 2)     // Smaller, fewer hash functions

// For more tolerance
resetIntervalMs: 3600000     // Reset every 1 hour (default)

// Persist less frequently
setInterval(..., 1800000)    // Save every 30 minutes
```

---

## 📈 Performance Baseline

After deployment, establish a performance baseline:

```bash
#!/bin/bash
# save-baseline.sh

echo "=== Bloom Filter Performance Baseline ===" > baseline.txt
echo "Timestamp: $(date)" >> baseline.txt
echo "" >> baseline.txt

echo "Stats:" >> baseline.txt
curl http://localhost:3000/api/admin/bloom-filters/stats >> baseline.txt
echo "" >> baseline.txt

echo "Dedup Rate:" >> baseline.txt
curl http://localhost:3000/api/events/dedup/stats >> baseline.txt
echo "" >> baseline.txt

echo "Threat Stats:" >> baseline.txt
curl http://localhost:3000/api/detections/threats/stats >> baseline.txt

echo "Baseline saved to baseline.txt"
```

Run weekly and compare:
```bash
diff baseline.txt baseline-$(date +%Y%m%d).txt
```

---

## 🚨 Emergency Procedures

### Reset Everything (Last Resort)

```bash
# 1. Stop server
# (Ctrl+C)

# 2. Clear persistent data
rm -rf ./bloom-filter-data

# 3. Start server again
npm run dev
```

### Recover from Corruption

```bash
# 1. Stop server

# 2. Restore from backup
cp -r ./bloom-filter-data.backup ./bloom-filter-data

# 3. Restart
npm run dev

# 4. Verify
curl http://localhost:3000/api/admin/bloom-filters/stats
```

### Disable Bloom Filters (Temporary)

```bash
# In server.ts, comment out:
// await initializeBloomFilters();
// setupPeriodicPersistence();
```

---

## 📋 Deployment Checklist

Before going live:
- [ ] All TypeScript files compile without errors
- [ ] Backend starts without warnings
- [ ] Bloom Filter stats endpoint responds
- [ ] Event deduplication works (test with POST)
- [ ] Detection flagging works
- [ ] Persistence saves to disk
- [ ] Persistence loads on restart
- [ ] Monitor false positive rate
- [ ] Set up backup procedures
- [ ] Document custom configurations
- [ ] Brief team on new endpoints
- [ ] Add monitoring dashboard
- [ ] Set up alerts for high false positive rate

---

## 📞 Support & Reference

### Quick Reference
- [Quick Start Guide](docs/BLOOM_FILTER_QUICK_REFERENCE.md)
- [Full Documentation](docs/bloom_filter_implementation.md)
- [Implementation Summary](BLOOM_FILTER_IMPLEMENTATION_SUMMARY.md)

### API Endpoints

**Events:**
- `POST /api/events` - Test deduplication
- `GET /api/events/dedup/stats` - Check stats

**Detections:**
- `POST /api/detections` - Test threat flagging
- `GET /api/detections/player/:playerId` - Check threat profile

**Admin:**
- `GET /api/admin/bloom-filters/stats` - Full statistics
- `POST /api/admin/bloom-filters/save` - Manual save
- `POST /api/admin/bloom-filters/load` - Manual load
- `POST /api/admin/bloom-filters/reset-all` - Full reset

---

## 🎉 Success Indicators

You'll know the deployment is successful when:

1. ✅ Server starts with "✓ Bloom Filters initialized" message
2. ✅ Duplicate event returns 409 Conflict
3. ✅ Detection endpoint flags players
4. ✅ Admin stats show non-zero filters
5. ✅ Disk storage appears in `./bloom-filter-data/`
6. ✅ False positive rate < 1%
7. ✅ No TypeScript errors on compile
8. ✅ No performance degradation observed

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Status:** ☐ Testing ☐ Staging ☐ Production

---

**Last Updated:** December 18, 2025
**Version:** 1.0
**Status:** Ready for Deployment
