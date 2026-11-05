// k6 run -e BASE_URL=https://sige.example.com tests/load.js
// Ejecutar solo sobre el entorno AWS propio de pruebas y vigilar costos.
import http from 'k6/http';
import {check,sleep} from 'k6';
export const options={stages:[{duration:'1m',target:5},{duration:'3m',target:30},{duration:'4m',target:60},{duration:'2m',target:0}],thresholds:{http_req_failed:['rate<0.01'],http_req_duration:['p(95)<2000']}};
export default function(){const base=__ENV.BASE_URL;if(!base)throw new Error('Configura BASE_URL');const r=http.get(`${base}/?load_test=1`,{headers:{'Cache-Control':'no-cache'}});check(r,{'frontend responde 200':r=>r.status===200,'identifica instancia':r=>Boolean(r.headers['X-Sige-Instance'])});sleep(.2);}
