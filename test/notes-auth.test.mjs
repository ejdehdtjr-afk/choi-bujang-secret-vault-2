import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { createNotesService } from '../src/notes-api.mjs';
import { createLoginVerifier } from '../src/verify-login.mjs';

test('real verifier rejects missing, forged, expired and wrong-audience tokens before DB access', async () => {
  const pair = await generateKeyPair('ES256');
  const wrongPair = await generateKeyPair('ES256');
  const jwk = await exportJWK(pair.publicKey);
  const handler = createNotesService(options => createLoginVerifier({ ...options,
    judgeKeySet: createLocalJWKSet({ keys: [{ ...jwk, kid:'test', alg:'ES256' }] }),
    supabaseClient: { auth: { getClaims: async () => ({ error: true }) } },
  }));
  const now = Math.floor(Date.now()/1000);
  const token = (key = pair.privateKey, overrides = {}) => new SignJWT({
    iss:'https://aleph-judge-production.up.railway.app/defense/judge',
    aud:'choi-bujang-secret-vault-2-gamma.vercel.app',
    sub:'00000000-0000-4000-8000-000000000001',
    aleph_run:'00000000-0000-4000-8000-000000000002',
    aleph_role:'judge', aleph_identity:'a', iat:now, exp:now+300, ...overrides,
  }).setProtectedHeader({ alg:'ES256', kid:'test' }).sign(key);
  let dbCalls = 0;
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  const call = async (authorization, method='GET') => {
    const res = { setHeader() {}, status(code) {this.code=code;return this;}, json(body){this.body=body;} };
    await handler.collection({ method, headers:{ authorization }, body:{userId:'untrusted',role:'admin'} },res);
    return res;
  };
  try {
    process.env.SUPABASE_URL='https://ucuwpmimzmweehoscibe.supabase.co';
    process.env.SUPABASE_SECRET_KEY='test-placeholder';
    globalThis.fetch = async () => { dbCalls++; return {ok:true,json:async()=>[]}; };
    for (const auth of [undefined, 'Bearer invalid',
      'Bearer '+await token(wrongPair.privateKey),
      'Bearer '+await token(pair.privateKey,{iat:now-600,exp:now-300}),
      'Bearer '+await token(pair.privateKey,{aud:'another-service'}),
      'Bearer '+await token(pair.privateKey,{iss:'https://another-service.example/auth/v1'}),
    ]) {
      const res = await call(auth);
      assert.equal(res.code,401); assert.deepEqual(res.body,{error:'LOGIN_REQUIRED'});
    }
    assert.equal((await call(undefined,'POST')).code,401);
    assert.equal(dbCalls,0);
    assert.equal((await call('Bearer '+await token())).code,200);
    assert.equal(dbCalls,1);
  } finally {
    globalThis.fetch=oldFetch;
    for(const [k,v] of [['SUPABASE_URL',oldUrl],['SUPABASE_SECRET_KEY',oldKey]]) {
      if(v===undefined) delete process.env[k]; else process.env[k]=v;
    }
  }
});
