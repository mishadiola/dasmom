import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const pageDuration = new Trend('page_response_ms');
const scriptDuration = new Trend('app_script_response_ms');
const styleDuration = new Trend('app_stylesheet_response_ms');

export const options = {
  scenarios: {
    local_production_bundle: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 150 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.99'],
  },
};

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:4173';
const jsPath = __ENV.JS_PATH;
const cssPath = __ENV.CSS_PATH;

if (!jsPath || !cssPath) {
  throw new Error('Set JS_PATH and CSS_PATH from the local production index.html.');
}

export default function () {
  const page = http.get(`${baseUrl}/`);
  pageDuration.add(page.timings.duration);
  check(page, {
    'page returns 200': (response) => response.status === 200,
    'page contains app root': (response) => response.body.includes('id="root"'),
  });

  const script = http.get(`${baseUrl}${jsPath}`);
  scriptDuration.add(script.timings.duration);
  check(script, { 'app bundle returns 200': (response) => response.status === 200 });

  const stylesheet = http.get(`${baseUrl}${cssPath}`);
  styleDuration.add(stylesheet.timings.duration);
  check(stylesheet, { 'app stylesheet returns 200': (response) => response.status === 200 });

  sleep(1);
}
