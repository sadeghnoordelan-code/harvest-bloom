import { ringGeometry } from '../src/hooks/useLoopEngine.js'
import assert from 'node:assert/strict'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { fileURLToPath } from 'node:url'
import devAssetBridge from '../tools/dev-asset-bridge.js'
import { normaliseGrams } from '../src/data/products.js'
import { priceFor } from '../src/lib/format.js'
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)))
const bridge=devAssetBridge({root,originDir:path.join(root,'..','Photos')})
assert.equal(bridge.apply({}, {command:'build',mode:'assets'}),false)
assert.equal(bridge.apply({}, {command:'serve',mode:'development'}),false)
assert.equal(bridge.apply({}, {command:'serve',mode:'assets'}),true)
let middleware
bridge.configureServer({config:{logger:{info(){}}},middlewares:{use(fn){middleware=fn}}})
function request(url,body){
 const req=new EventEmitter();req.url=url;req.method='POST'
 const res={statusCode:200,setHeader(){},end(value){this.body=JSON.parse(value)}}
 middleware(req,res,()=>assert.fail('route unexpectedly skipped'))
 req.emit('data',JSON.stringify(body));req.emit('end')
 return res
}
for(const rel of ['../public-other/escape.webp','../../escape.webp',path.join(root,'..','outside.webp')]){
 const res=request('/__write',{path:rel,b64:'AA=='})
 assert.equal(res.statusCode,400,'out-of-bounds write allowed: '+rel)
 assert.equal(res.body.ok,false)
}
for(const rel of ['../harvest-bloom-other/escape.webp','../../escape.webp']){
 const res=request('/__delete',{paths:[rel]})
 assert.equal(res.statusCode,400,'out-of-bounds delete allowed: '+rel)
 assert.deepEqual(res.body.removed,[])
}
assert.equal(normaliseGrams(255),260)
assert.equal(normaliseGrams(0),100)
assert.equal(normaliseGrams(Infinity),100)
assert.equal(normaliseGrams(99999),5000)
assert.equal(priceFor(1180,normaliseGrams(255)),3068)
console.log('PASS asset route isolation, path boundaries, weight limits and invoice arithmetic')

// Preserve the original design shown in the user's screen recording.
const reference=ringGeometry(1000,760,'ring')
const angle=2*Math.atan((0.105*1000)/(0.4*760))
const radius=(0.4*760)/Math.sin(angle)
assert.equal(reference.step,angle)
assert.equal(reference.rx,radius)
assert.equal(reference.ry,radius)
assert.equal(reference.item,radius*0.52)
assert.equal(reference.band,radius*0.34)
for(const w of [300,400,500,600,700,800]){
 const g=ringGeometry(w,700,'ring')
 assert(w-g.rx-g.item/2>=-1,'original ring focus outside a narrow column')
}
console.log('PASS reference ring radius, pack size, angular spacing, ribbon width and narrow-column bounds')
