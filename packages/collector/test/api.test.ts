import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { ingestBatch } from '../src/api';
test('New collector refuses old server before uploading partitions that would duplicate legacy totals', async()=>{
 let uploads=0;
 const server=createServer((req,res)=>{if(req.url==='/api/collector/ingest')uploads++;res.writeHead(404,{'content-type':'application/json'});res.end('{}');});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try { const port=(server.address() as {port:number}).port;
  await assert.rejects(ingestBatch(`http://127.0.0.1:${port}`, 'test-token', 'test', []), /server needs the accounting update/);
  assert.equal(uploads,0);
 } finally { server.close(); }
});
