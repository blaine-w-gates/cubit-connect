# ADR 004: Storage Monitoring with Fixed Thresholds

**Status**: Accepted  
**Date**: April 26, 2026  
**Decision Makers**: Engineering Team  

## Context

Cubit Connect stores all user data (video screenshots, AI analysis results, tasks) in browser IndexedDB. Browsers impose storage limits (~60MB per origin for mobile Safari, higher for desktop). Users need early warning before hitting limits to prevent data loss.

## Problem

Previous implementation used percentage-based thresholds (80% of quota), which varied by browser:
- Chrome: ~60% of disk space
- Safari: ~60MB hard limit
- Firefox: ~10% of disk space

This created inconsistent UX - users on Firefox with 1TB disk would never see warnings until 100MB+, while mobile Safari users would hit limits at 60MB.

## Decision

Use **fixed absolute thresholds** instead of percentages:
- **Warning at 50MB**: Alert users to consider exporting
- **Critical at 55MB**: Urgent action required, data loss imminent
- **Browser limit ~60MB**: Safety buffer for browser variance

## Rationale

### Why Fixed Thresholds?

1. **Consistent UX**: All users warned at same data volume
2. **Mobile-First**: 50MB is appropriate for all mobile browsers
3. **Predictable**: Users learn "export before 50MB"
4. **Safety Margin**: 5MB buffer (50→55) gives time to react

### Why 50MB/55MB Specifically?

| Browser | Typical Limit | Our Threshold | Safety |
|---------|--------------|---------------|---------|
| Mobile Safari | ~60MB | 50MB warning | 10MB |
| Desktop Chrome | ~6GB | 50MB warning | Very safe |
| Desktop Firefox | ~10% disk | 50MB warning | Very safe |
| iOS WebView | ~60MB | 50MB warning | 10MB |

50MB represents a substantial project (hundreds of screenshots + AI analysis) while leaving safety margin for mobile.

## Implementation

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  StorageMonitor │────▶│ useStorageMonitor│────▶│   Engine Page   │
│   (lib)         │     │    (hook)        │     │   (toast)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  SettingsDialog │     │ StorageWarningBanner│
│  (visual indicator)   │  (persistent banner)│
└─────────────────┘     └──────────────────┘
```

### Key Components

1. **storageMonitor.ts**: Core utility with fixed thresholds
2. **useStorageMonitor.ts**: React hook for components
3. **StorageWarningBanner.tsx**: Persistent visual indicator
4. **SettingsDialog.tsx**: Detailed storage status with export action

### Threshold Behavior

| Status | Threshold | User Action | UI Treatment |
|--------|-----------|-------------|--------------|
| ok | <50MB | None | Subtle indicator |
| warning | 50-55MB | Consider export | Amber toast + banner |
| critical | >55MB | Export immediately | Red persistent toast + banner |

## Consequences

### Positive
- ✅ Consistent experience across all browsers
- ✅ Mobile users protected (primary use case)
- ✅ Clear, actionable thresholds
- ✅ Time to react (5MB buffer)

### Negative
- ⚠️ Desktop users with massive disks see warnings "early"
- ⚠️ No granular breakdown (can't see "screenshots use X MB")

## Future Considerations

1. **Storage Breakdown**: Show which data types use space
2. **Auto-Export**: Optional automatic export before critical
3. **Enterprise Config**: Allow organizations to set custom thresholds
4. **Compression**: Store screenshots more efficiently

## Related Decisions

- ADR 001: Supabase Realtime (sync may increase storage needs)
- ADR 002: E2EE Web Crypto (encryption adds overhead)

## References

- [MDN: StorageManager.estimate()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate)
- [IndexedDB Limits by Browser](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Browser_storage_limits_and_eviction_criteria)
