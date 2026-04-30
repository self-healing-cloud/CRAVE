// Phase 2: The 4-Tier Chaos Execution Protocol (k6 script)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Pre-seeded users or generate tokens before the test run
const tokens = new SharedArray('tokens', function () {
    return JSON.parse(open('./tokens.json'));
});

const BASE_URL = __ENV.API_URL || 'http://localhost:8001';

export const options = {
    scenarios: {
        // Tier 1: Linear Step-Load
        tier_1: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10m', target: 1000 },
                { duration: '5m', target: 1000 },
            ],
            startTime: '0s',
        },
        // Tier 2: The "Thundering Herd"
        tier_2: {
            executor: 'ramping-arrival-rate',
            startRate: 0,
            timeUnit: '1s',
            preAllocatedVUs: 500,
            maxVUs: 10000,
            stages: [
                { duration: '5s', target: 10000 }, // Spike
                { duration: '3m', target: 10000 }, // Hold
                { duration: '1s', target: 0 },     // Drop
                { duration: '1m', target: 0 },     // Hold
                { duration: '5s', target: 10000 }, // Repeat 1
                { duration: '3m', target: 10000 },
                { duration: '1s', target: 0 },
                { duration: '1m', target: 0 },
                { duration: '5s', target: 10000 }, // Repeat 2
                { duration: '3m', target: 10000 },
            ],
            startTime: '16m', // Start after Tier 1 finishes
        },
        // Tier 3: The Long-Tail Soak
        tier_3: {
            executor: 'constant-vus',
            vus: 750, // 75% of Tier 1 max
            duration: '6h',
            startTime: '30m', // Starts after Tier 2
        },
        // Tier 4: The Kill Shot
        tier_4: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 100 },
                { duration: '1m', target: 1000 },
                { duration: '1m', target: 5000 },
                { duration: '1m', target: 15000 }, // Exponential ramp
                { duration: '5m', target: 30000 },
            ],
            startTime: '6h35m', // Starts after Tier 3
        }
    },
    thresholds: {
        http_req_failed: ['rate<0.01'], // < 1% error rate
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    },
};

export default function () {
    // Select random token
    const token = tokens[Math.floor(Math.random() * tokens.length)];
    const params = {
        headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
        },
    };

    // Target the heaviest endpoint identified: Delivery Available List
    let res = http.get(`${BASE_URL}/api/v1/delivery/available`, params);

    check(res, {
        'status is 200': (r) => r.status === 200,
        'transaction time OK': (r) => r.timings.duration < 1000,
    });

    sleep(1);
}
