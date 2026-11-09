import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.STAGING_BASE_URL || '').replace(/\/$/, '');
const token = __ENV.STAGING_OWNER_BEARER_TOKEN || '';
const confirmation = __ENV.CONFIRM_STAGING_TARGET || '';
const targetVus = Number(__ENV.TARGET_VUS || 10);

if (!baseUrl || !token || confirmation !== 'YES') {
  throw new Error('Set STAGING_BASE_URL, STAGING_OWNER_BEARER_TOKEN, and CONFIRM_STAGING_TARGET=YES.');
}

let targetHost;
try {
  targetHost = new URL(baseUrl).hostname.toLowerCase();
} catch {
  throw new Error('STAGING_BASE_URL must be a valid absolute URL.');
}

if (targetHost === 'myinventoryuse.com' || targetHost.endsWith('.myinventoryuse.com')) {
  throw new Error('Refusing to run against the production hostname.');
}
if (!Number.isInteger(targetVus) || targetVus < 1 || targetVus > 50) {
  throw new Error('TARGET_VUS must be an integer from 1 through 50 for this controlled staging profile.');
}

export const options = {
  stages: [
    { duration: '1m', target: Math.min(2, targetVus) },
    { duration: '2m', target: targetVus },
    { duration: '3m', target: targetVus },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  },
};

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
};

function get(path, label) {
  const response = http.get(`${baseUrl}${path}`, {
    headers,
    tags: { endpoint: label },
    timeout: '30s',
  });
  check(response, {
    [`${label} returns 2xx`]: (result) => result.status >= 200 && result.status < 300,
  });
}

export default function () {
  const sample = Math.random();
  if (sample < 0.65) {
    get('/api/products?page=1&per_page=25', 'products-page');
  } else if (sample < 0.80) {
    get('/api/analytics?type=products', 'product-analytics');
  } else if (sample < 0.90) {
    get('/api/analytics?type=sales', 'sales-analytics');
  } else if (sample < 0.97) {
    const filter = Math.random() < 0.25 ? 'all' : '30d';
    get(`/api/reports/product-metrics?filter=${filter}`, `product-metrics-${filter}`);
  } else {
    get('/api/analytics/owner-metrics', 'owner-metrics');
  }
  sleep(1);
}
