import assert from 'node:assert/strict'
import {chromium,webkit} from '@playwright/test'
import {products} from '../src/data/products.js'
import {formatMoney} from '../src/lib/format.js'
const url=process.env.TEST_URL || 'http://127.0.0.1:4173'
for(const engine of (process.env.TEST_ENGINE ? [process.env.TEST_ENGINE] : ['edge','webkit'])){
 const browser=engine==='edge'?await chromium.launch({channel:'msedge',headless:true}):await webkit.launch({headless:true})
 try{for(const [width,height] of [[1440,900],[1440,640],[1024,768],[390,844]]){
  const p=await browser.newPage({viewport:{width,height}});const errors=[];p.on('pageerror',e=>errors.push(e.message))
  await p.goto(url,{waitUntil:'domcontentloaded'})
  await p.waitForFunction(()=>[...document.querySelectorAll('.loop__img')].every(e=>e.complete&&e.naturalWidth>0))
  await p.waitForFunction(()=>document.querySelector('video')?.readyState>=1 || document.querySelector('video')?.error)
  await p.evaluate(()=>document.fonts.ready)
  const pinned=await p.locator('.collection__track').evaluate(e=>e.classList.contains('is-pinned'))
  if(pinned){await p.locator('.collection__track').evaluate(e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY,behavior:'instant'}))}
  else await p.locator('.loop__stage').scrollIntoViewIfNeeded()
  await p.locator('.loop__dot').nth(0).click()
  if(pinned)await p.waitForFunction(()=>Math.abs(document.querySelector('.collection__track').getBoundingClientRect().top)<1)
  await p.waitForTimeout(800)
  for(let i=0;i<products.length;i++){
   if(i){
    const r=await p.locator('.loop__stage').boundingBox()
    await p.mouse.move(Math.min(width-30,r.x+r.width/2),Math.max(100,Math.min(height-30,r.y+r.height/2)))
    await p.mouse.wheel(0,150)
   }
   await p.waitForFunction(id=>document.querySelector('.panel')?.dataset.productId===id,products[i].id)
   await p.waitForTimeout(650)
   assert.equal(await p.locator('.loop__item[data-focused=true]').getAttribute('id'),'loop-item-'+products[i].id)
   assert.equal(await p.locator('.panel__name').innerText(),products[i].name)
   assert.equal(await p.locator('.panel__desc').innerText(),products[i].description)
   assert.equal(await p.locator('.panel__rateValue').innerText(),formatMoney(products[i].pricePer100g))
   if(width>1100){
    await p.waitForFunction(() => {
     const item=document.querySelector('.loop__item[data-focused=true]')?.getBoundingClientRect()
     const panel=document.querySelector('.panel')?.getBoundingClientRect()
     return item && panel && Math.abs(item.y+item.height/2-panel.y-panel.height/2)<1
    }, {}, {timeout:3000})
    const item=await p.locator('.loop__item[data-focused=true]').boundingBox()
    const panel=await p.locator('.panel').boundingBox()
    assert(Math.abs(item.y+item.height/2-panel.y-panel.height/2)<1,'product is not opposite its details: '+JSON.stringify({engine,width,height,index:i,item,panel,delta:item.y+item.height/2-panel.y-panel.height/2}))
   }
  }
  // Continuing after the last product must release ordinary page scrolling.
  let r=await p.locator('.loop__stage').boundingBox()
  await p.mouse.move(Math.min(width-30,r.x+r.width/2),Math.max(100,Math.min(height-30,r.y+r.height/2)))
  const before=await p.evaluate(()=>scrollY);await p.mouse.wheel(0,150)
  await p.waitForFunction(before=>scrollY>before+20,before)
  // Reverse wheel direction must select the previous product.
  if(pinned)await p.locator('.loop__dot').nth(5).click()
  else await p.locator('.loop__stage').scrollIntoViewIfNeeded()
  await p.waitForTimeout(700)
  r=await p.locator('.loop__stage').boundingBox()
  await p.mouse.move(Math.min(width-30,r.x+r.width/2),Math.max(100,Math.min(height-30,r.y+r.height/2)))
  await p.mouse.wheel(0,-150)
  await p.waitForFunction(()=>document.querySelector('.panel')?.dataset.productId==='almond')
  assert.deepEqual(errors,[])
  console.log('PASS mouse wheel, matching price/description, alignment and boundary release',engine,width+'x'+height)
  await p.close()
 }}finally{await browser.close()}
}
