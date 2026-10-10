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

// Position, separation and containment must hold after responsive resizing.
for(const [w,h] of [[110,474],[150,750],[350,660],[485,660],[1000,760],[800,282]]){
 const g=ringGeometry(w,h,'ring'),focus=g.at(0)
 assert(Math.abs(w/2+focus.x-w*(w<220?0.6:0.65))<0.01,'focus drifted away from the right side')
 assert(w/2+focus.x-g.item/2>w*0.3,'pack encroaches on the control lane')
 assert(w/2+focus.x+g.item/2<w,'focused pack clipped at the right edge')
 const chord=2*g.rx*Math.sin(g.step/2)
 assert(chord>=g.item*1.5,'neighbouring packs overlap')
}
console.log('PASS right-side focus, pack separation and responsive containment')
