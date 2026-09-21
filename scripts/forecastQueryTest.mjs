import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
try {
  let staleResolve, freshResolve, aborted = false;
  const observer = new QueryObserver(client, { queryKey: ['forecast', 'user1', 'sede1', 'oct'], queryFn: ({ signal }) => new Promise(resolve => { staleResolve = resolve; signal.addEventListener('abort', () => { aborted = true; }); }) });
  const unsubscribe = observer.subscribe(() => {});
  observer.setOptions({ queryKey: ['forecast', 'user2', 'sede2', 'nov'], queryFn: () => new Promise(resolve => { freshResolve = resolve; }) });
  assert.equal(aborted, true);
  staleResolve('obsolete'); freshResolve('current');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(observer.getCurrentResult().data, 'current');
  assert.equal(client.getQueryData(['forecast', 'user1', 'sede1', 'oct']), undefined);
  unsubscribe();
  let attempts = 0;
  const key = ['forecast', 'user2', 'sede2', 'dec'];
  const options = { queryKey: key, queryFn: async () => { attempts++; if (attempts === 1) throw Error('offline'); return ['one task']; } };
  await assert.rejects(() => client.fetchQuery(options));
  assert.equal(client.getQueryData(key), undefined);
  assert.deepEqual(await client.fetchQuery(options), ['one task']);
  assert.equal(attempts, 2);
  console.log('PASS React Query lifecycle: abandoned response, user/sede/range isolation, failure and retry');
} finally { client.clear(); }
